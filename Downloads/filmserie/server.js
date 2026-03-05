/**
 * server.js — Local dev server for Fidelix
 * Serves static files + proxies /.netlify/functions/* to local handlers
 * Usage: node server.js
 */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

// ── Load .env ──────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) process.env[key] = val;
  });
}

// ── MIME types ─────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

// ── Server ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // ── Netlify function proxy ────────────────────────────────────────────────
  if (urlPath.startsWith('/.netlify/functions/')) {
    const fnName = urlPath.replace('/.netlify/functions/', '').split('/')[0];
    const fnPath = path.join(__dirname, 'functions', `${fnName}.js`);

    if (!fs.existsSync(fnPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Function '${fnName}' not found` }));
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        // Clear module cache so edits are picked up on each request
        delete require.cache[require.resolve(fnPath)];
        const { handler } = require(fnPath);

        const result = await handler({
          httpMethod: req.method,
          body: body || null,
          headers: req.headers,
          queryStringParameters: Object.fromEntries(
            new URLSearchParams(req.url.split('?')[1] || '')
          ),
        });

        const respHeaders = {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          ...(result.headers || {}),
        };
        res.writeHead(result.statusCode ?? 200, respHeaders);
        res.end(result.body ?? '');
      } catch (err) {
        console.error(`[function:${fnName}]`, err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // ── Static file serving ───────────────────────────────────────────────────
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);

  // SPA fallback: if file not found serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'text/plain; charset=utf-8';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  ✦ FIDELIX dev server\n  → http://localhost:${PORT}\n`);
});
