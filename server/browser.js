/**
 * browser.js — Playwright browser manager for ChatGPT automation.
 *
 * Architecture:
 * - One persistent Chromium context (survives restarts via profile dir on disk).
 * - Single shared page — only one ChatGPT session at a time.
 * - Simple promise-based queue: requests wait their turn, never run in parallel.
 */

const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const PROFILE_DIR = process.env.PROFILE_DIR || "/data/chrome-profile";
const CHATGPT_URL = "https://chatgpt.com";
const GENERATE_TIMEOUT_MS = 150_000; // 2.5 min max per generation

// ── Module-level state ────────────────────────────────────────────────────────
let context = null;
let page = null;
let initError = null;
let ready = false;

// ── Simple sequential queue ────────────────────────────────────────────────────
let queueRunning = false;
const queue = [];

function enqueue(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    drain();
  });
}

async function drain() {
  if (queueRunning || queue.length === 0) return;
  queueRunning = true;
  const { fn, resolve, reject } = queue.shift();
  try {
    resolve(await fn());
  } catch (e) {
    reject(e);
  } finally {
    queueRunning = false;
    drain();
  }
}

// ── Browser init ───────────────────────────────────────────────────────────────
async function initBrowser() {
  console.log("[browser] Launching persistent context at:", PROFILE_DIR);
  fs.mkdirSync(PROFILE_DIR, { recursive: true });

  context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [
      "--display=:99",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--disable-extensions",
      "--window-size=1280,900",
    ],
    viewport: { width: 1280, height: 900 },
    locale: "it-IT",
    timezoneId: "Europe/Rome",
    acceptDownloads: false,
    ignoreHTTPSErrors: false,
  });

  // Stealth: remove webdriver property
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    delete window.navigator.__proto__.webdriver;
  });

  // Grant clipboard permissions for chatgpt.com
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: CHATGPT_URL,
  });

  page = context.pages()[0] || (await context.newPage());
  ready = true;
  console.log("[browser] Browser ready.");
}

// ── Login helpers ─────────────────────────────────────────────────────────────

/**
 * Navigate to the ChatGPT login page so the user can authenticate via noVNC.
 */
async function navigateToLogin() {
  if (!ready) throw new Error("Browser non ancora pronto.");
  await page.goto(CHATGPT_URL + "/auth/login", { waitUntil: "domcontentloaded", timeout: 30000 });
}

/**
 * Check whether the current page indicates the user is logged in.
 * We look for the presence of the prompt textarea or the "New chat" link.
 */
async function checkLoggedIn() {
  if (!ready) return false;
  try {
    const url = page.url();
    if (url.includes("/auth/login") || url.includes("/auth/")) return false;
    // Look for the chat input or nav elements present only when logged in
    const found = await page
      .locator(
        '#prompt-textarea, [data-testid="send-button"], nav[aria-label="Chat history"], [role="navigation"]'
      )
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    return found;
  } catch {
    return false;
  }
}

/**
 * Confirm session saved (with persistent context, cookies are saved automatically).
 * Just returns the login state.
 */
async function confirmSession() {
  if (!ready) throw new Error("Browser non ancora pronto.");
  const loggedIn = await checkLoggedIn();
  if (!loggedIn) throw new Error("Non sei loggato — completa il login prima.");
  return { ok: true, loggedIn: true };
}

// ── Status ─────────────────────────────────────────────────────────────────────
async function getStatus() {
  if (initError) return { ready: false, loggedIn: false, error: initError.message, busy: queueRunning };
  if (!ready) return { ready: false, loggedIn: false, busy: false };
  const loggedIn = await checkLoggedIn().catch(() => false);
  return { ready: true, loggedIn, busy: queueRunning, queue: queue.length };
}

// ── Generation ─────────────────────────────────────────────────────────────────

/**
 * Locate the prompt textarea using multiple fallback selectors.
 */
async function findTextarea() {
  const candidates = [
    "#prompt-textarea",
    'div[contenteditable="true"][data-id="prompt-textarea"]',
    'div[contenteditable="true"]',
    "textarea",
  ];
  for (const sel of candidates) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
      return el;
    }
  }
  throw new Error("Textarea non trovata — ChatGPT potrebbe aver cambiato layout.");
}

/**
 * Wait for the stop button to appear (generation started) then disappear (done).
 */
async function waitForGenerationComplete() {
  const stopSelectors = [
    '[data-testid="stop-button"]',
    'button[aria-label="Stop streaming"]',
    'button[aria-label="Interrompi risposta"]',
    'button[aria-label="Stop generating"]',
    'button svg[data-icon="stop-circle"]',
  ].join(", ");

  // Wait for stop button to appear (up to 30s — ChatGPT can be slow to start)
  let stopAppeared = false;
  try {
    await page.waitForSelector(stopSelectors, { timeout: 30000 });
    stopAppeared = true;
  } catch {
    // Stop button never appeared — might be a very fast reply or already done
  }

  if (stopAppeared) {
    // Wait for stop button to disappear (generation complete)
    await page.waitForSelector(stopSelectors, {
      state: "hidden",
      timeout: GENERATE_TIMEOUT_MS,
    });
  }

  // Extra buffer for final DOM rendering
  await page.waitForTimeout(1000);
}

/**
 * Extract the last assistant message text from the page.
 */
async function extractLastResponse() {
  const responseSelectors = [
    '[data-message-author-role="assistant"]',
    ".agent-turn",
    '[data-testid="conversation-turn-3"]', // fallback: 3rd turn is usually first reply
  ];

  for (const sel of responseSelectors) {
    const els = page.locator(sel);
    const count = await els.count();
    if (count > 0) {
      // Get the innerText of the last matching element
      const text = await els.last().evaluate((el) => {
        // Remove "copy" buttons and other UI chrome if present
        const clone = el.cloneNode(true);
        clone.querySelectorAll("button, [role='button'], svg").forEach((b) => b.remove());
        return (clone.innerText || clone.textContent || "").trim();
      });
      if (text.length > 0) return text;
    }
  }
  throw new Error("Impossibile estrarre la risposta da ChatGPT.");
}

/**
 * Send a prompt to ChatGPT and return the response text.
 * Queued: only one call runs at a time.
 */
async function generateWithChatGPT(prompt) {
  return enqueue(async () => {
    if (!ready) throw new Error("Browser non pronto.");
    const loggedIn = await checkLoggedIn();
    if (!loggedIn) throw new Error("Non loggato su ChatGPT. Vai a /admin e completa il login.");

    // Navigate to a fresh chat
    await page.goto(CHATGPT_URL, { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for the textarea
    const textarea = await findTextarea();

    // Fill the prompt via clipboard (fastest for long text, avoids keypress events)
    await textarea.click();
    await page.evaluate(async (text) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback: execCommand
        const el =
          document.querySelector("#prompt-textarea") ||
          document.querySelector('[contenteditable="true"]');
        if (el) {
          el.focus();
          document.execCommand("selectAll");
          document.execCommand("insertText", false, text);
          return;
        }
        throw new Error("Clipboard e execCommand non disponibili.");
      }
    }, prompt);

    // Paste (Control+v) — replaces any selected content
    await page.keyboard.press("Control+a");
    await page.keyboard.press("Control+v");
    await page.waitForTimeout(300); // small pause for React state update

    // Click the send button
    const sendSelectors = [
      '[data-testid="send-button"]',
      'button[aria-label="Send prompt"]',
      'button[aria-label="Invia prompt"]',
      'button[aria-label="Send message"]',
    ].join(", ");

    const sendBtn = page.locator(sendSelectors).first();
    if (await sendBtn.count() > 0) {
      await sendBtn.click();
    } else {
      // Fallback: Enter key
      await page.keyboard.press("Enter");
    }

    // Wait for generation to complete
    await waitForGenerationComplete();

    // Extract and return the response
    return await extractLastResponse();
  });
}

// ── Module exports ─────────────────────────────────────────────────────────────
module.exports = {
  initBrowser,
  navigateToLogin,
  confirmSession,
  generateWithChatGPT,
  getStatus,
};
