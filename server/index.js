/**
 * index.js — Express server for BookFeed ChatGPT automation.
 *
 * Endpoints:
 *   GET  /status          — browser + login state
 *   POST /login/start     — navigate to ChatGPT login page (for noVNC user)
 *   POST /login/save      — confirm session (with persistent context it's automatic)
 *   POST /generate        — send prompt to ChatGPT, return response text
 *   GET  /viewer          — noVNC HTML viewer page
 *   GET  /novnc/static/*  — serve noVNC static files
 *   WS   /websockify      — raw TCP proxy → websockify:6080 → x11vnc:5900
 */

const express = require("express");
const http = require("http");
const net = require("net");
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
const NOVNC_STATIC = "/usr/share/novnc";
const WEBSOCKIFY_PORT = 6080; // websockify runs here internally

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ── REST routes ────────────────────────────────────────────────────────────────

app.get("/status", async (req, res) => {
  try {
    const s = await getStatus();
    res.json({ ok: true, ...s });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/login/start", async (req, res) => {
  try {
    await navigateToLogin();
    res.json({ ok: true, message: "Naviga alla pagina di login nel viewer VNC." });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post("/login/save", async (req, res) => {
  try {
    const result = await confirmSession();
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

app.post("/generate", async (req, res) => {
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
app.get("/viewer", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>BookFeed — VNC</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #111; overflow: hidden; }
    #screen { width: 100vw; height: 100vh; }
    #status {
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,.75); color: #fff; font: 13px/1.5 sans-serif;
      padding: 5px 16px; border-radius: 20px; z-index: 99;
      transition: opacity .5s;
    }
    #status.hide { opacity: 0; pointer-events: none; }
  </style>
</head>
<body>
  <div id="status">Connessione VNC in corso...</div>
  <div id="screen"></div>
  <script type="module">
    import RFB from '/novnc/static/core/rfb.js';
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = proto + '//' + location.host + '/websockify';
    const status = document.getElementById('status');

    let rfb;
    try {
      rfb = new RFB(document.getElementById('screen'), wsUrl);
      rfb.scaleViewport = true;
      rfb.resizeSession = false;
      rfb.viewOnly = false;
      rfb.addEventListener('connect', () => {
        status.textContent = 'Connesso ✓';
        setTimeout(() => status.classList.add('hide'), 2500);
      });
      rfb.addEventListener('disconnect', (e) => {
        status.classList.remove('hide');
        status.textContent = 'Disconnesso' + (e.detail && e.detail.reason ? ': ' + e.detail.reason : ' — ricarica per riprovare');
      });
      rfb.addEventListener('securityfailure', (e) => {
        status.classList.remove('hide');
        status.textContent = 'Errore autenticazione VNC: ' + (e.detail && e.detail.reason ? e.detail.reason : 'unknown');
      });
    } catch(e) {
      status.textContent = 'Errore init: ' + e.message;
    }
    // Timeout fallback
    setTimeout(() => {
      if (status.textContent === 'Connessione VNC in corso...') {
        status.textContent = 'Connessione lenta — attendi o ricarica';
      }
    }, 20000);
  </script>
</body>
</html>`);
});

app.use("/novnc/static", express.static(NOVNC_STATIC));

// ── WebSocket → websockify raw TCP proxy ───────────────────────────────────────
// Instead of interpreting VNC/WebSocket frames ourselves, we raw-proxy the
// upgrade connection straight to websockify (which handles the VNC bridging).
server.on("upgrade", (req, socket, head) => {
  if (req.url === "/websockify") {
    const proxy = net.connect(WEBSOCKIFY_PORT, "127.0.0.1", () => {
      // Replay the raw HTTP upgrade request to websockify
      let headers = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        headers += `${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`;
      }
      headers += "\r\n";
      proxy.write(headers);
      if (head && head.length > 0) proxy.write(head);
      socket.pipe(proxy);
      proxy.pipe(socket);
    });
    proxy.on("error", (e) => {
      console.error("[ws-proxy] websockify not ready:", e.message);
      socket.destroy();
    });
    socket.on("error", () => proxy.destroy());
    socket.on("end", () => proxy.destroy());
  } else {
    socket.destroy();
  }
});

// ── Startup ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[server] Listening on port ${PORT}`);
  initBrowser().then(() => {
    console.log("[server] Browser initialized successfully.");
  }).catch((e) => {
    console.error("[server] Browser init failed:", e.message);
  });
});
