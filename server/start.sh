#!/bin/bash
set -e

echo "[start] Starting Xvfb on :99..."
Xvfb :99 -screen 0 1280x900x24 -ac +extension GLX +render -noreset &
XVFB_PID=$!
sleep 1

echo "[start] Starting x11vnc..."
x11vnc -display :99 -nopw -listen 127.0.0.1 -rfbport 5900 \
    -forever -shared -bg -noxdamage -quiet -noipv6 2>/dev/null || true
sleep 0.5

echo "[start] Starting Node.js server..."
exec node /app/index.js
