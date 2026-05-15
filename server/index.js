/**
 * index.js — Express server for BookFeed ChatGPT automation.
 *
 * Endpoints (all require X-Api-Token header except /viewer and /novnc/static/*):
 *   GET  /status          — browser + login state
 *   POST /login/start     — navigate to ChatGPT login page (for noVNC user)
 *   POST /login/save      — confirm session (with persistent context it's automatic)
 *   POST /generate        — send prompt to ChatGPT, return response text
 *   GET  /viewer          — noVNC HTML viewer page
 *   GET  /novnc/static/*  — serve noVNC static files
 *   WS   /websockify      — WebSocket ↔ VNC TCP bridge (no auth, LAN only)
 */

const express = require("express");
const http = require("http");
const net = require("net");
const WebSocket = require("ws");
const path = require("path");
const {
  initBrowser,
  navigateToLogin,
  confirmSession,
  generateWithChatGPT,
  getStatus,
} = require("./browser");

const app = express();
const server = http.createServer(app);

const PORT = parseInt(process.env.PORT || "10000", 10);
const API_TOKEN = process.env.API_TOKEN || "";
const VNC_PORT = 5900; // x11vnc listens here (localhost only)
const NOVNC_STATIC = "/usr/share/novnc"; // installed by apt

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

// CORS — allow the Vercel frontend
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Auth middleware — applied per route (not to /viewer or static files)
function auth(req, res, next) {
  if (!API_TOKEN) return next(); // No token set: open (dev only)
  const token = req.headers["x-api-token"] || req.query.token;
  if (token === API_TOKEN) return next();
  res.status(401).json({ error: "Unauthorized: x-api-token non valido." });
}

// ── REST routes ────────────────────────────────────────────────────────────────

// Health / status
app.get("/status", auth, async (req, res) => {
  try {
    const s = await getStatus();
    res.json({ ok: true, ...s });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Open ChatGPT login page in the automated browser
app.post("/login/start", auth, async (req, res) => {
  try {
    await navigateToLogin();
    res.json({ ok: true, message: "Naviga alla pagina di login nel viewer VNC." });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Confirm session saved (persistent context auto-saves cookies)
app.post("/login/save", auth, async (req, res) => {
  try {
    const result = await confirmSession();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// Generate — main endpoint, called from Vercel proxy
app.post("/generate", auth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ ok: false, error: "Campo 'prompt' mancante o non valido." });
  }
  if (prompt.length > 20000) {
    return res.status(400).json({ ok: false, error: "Prompt troppo lungo (max 20000 caratteri)." });
  }
  try {
    const response = await generateWithChatGPT(prompt);
    res.json({ ok: true, response });
  } catch (e) {
    console.error("[generate] Error:", e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── noVNC viewer ───────────────────────────────────────────────────────────────
// A minimal HTML page that connects to the VNC WebSocket on this same server.
app.get("/viewer", (req, res) => {
  const wsPath = "/websockify";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BookFeed — VNC Viewer</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; overflow: hidden; }
    #screen { width: 100vw; height: 100vh; }
    #status {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,.7); color: #fff; font: 13px/1.5 sans-serif;
      padding: 4px 14px; border-radius: 20px; z-index: 99;
      transition: opacity .5s;
    }
    #status.hide { opacity: 0; pointer-events: none; }
  </style>
</head>
<body>
  <div id="status">Connessione VNC in corso…</div>
  <div id="screen"></div>
  <script type="module">
    import RFB from '/novnc/static/core/rfb.js';
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = proto + '//' + location.host + '${wsPath}';
    const status = document.getElementById('status');
    let rfb;
    try {
      rfb = new RFB(document.getElementById('screen'), url);
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.viewOnly = false;
      rfb.addEventListener('connect', () => {
        status.textContent = 'Connesso ✓';
        setTimeout(() => status.classList.add('hide'), 2000);
      });
      rfb.addEventListener('disconnect', (e) => {
        status.classList.remove('hide');
        status.textContent = 'Disconnesso' + (e.detail?.reason ? ': ' + e.detail.reason : '');
      });
    } catch(e) {
      status.textContent = 'Errore: ' + e.message;
    }
  </script>
</body>
</html>`);
});

// Serve noVNC static files (core/rfb.js and deps)
app.use("/novnc/static", express.static(NOVNC_STATIC));

// ── WebSocket ↔ VNC TCP bridge ─────────────────────────────────────────────────
// Proxies /websockify WebSocket connections to x11vnc on localhost:5900.
const wss = new WebSocket.Server({ noServer: true, perMessageDeflate: false });

wss.on("connection", (ws) => {
  const tcp = net.createConnection(VNC_PORT, "127.0.0.1");

  tcp.on("connect", () => {
    console.log("[vnc] TCP connection to x11vnc established.");
  });
  tcp.on("data", (chunk) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(chunk);
  });
  tcp.on("end", () => ws.close());
  tcp.on("error", (e) => {
    console.error("[vnc] TCP error:", e.message);
    ws.close();
  });

  ws.on("message", (msg) => {
    if (tcp.writable) tcp.write(msg instanceof Buffer ? msg : Buffer.from(msg));
  });
  ws.on("close", () => tcp.destroy());
  ws.on("error", (e) => console.error("[vnc] WS error:", e.message));
});

server.on("upgrade", (req, socket, head) => {
  if (req.url === "/websockify") {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  } else {
    socket.destroy();
  }
});

// ── Startup ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
  // Init browser after server is up (non-blocking)
  initBrowser().then(() => {
    console.log("[server] Browser initialized successfully.");
  }).catch((e) => {
    console.error("[server] Browser init failed:", e.message);
  });
});
