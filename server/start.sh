#!/bin/bash
set -e

echo "[start] Starting Xvfb on :99..."
Xvfb :99 -screen 0 1280x900x24 -ac +extension GLX +render -noreset &
sleep 2

echo "[start] Starting x11vnc..."
x11vnc -display :99 -nopw -rfbport 5900 \
    -forever -shared -noxdamage -noipv6 &
sleep 2

echo "[start] Starting websockify on 6080 -> VNC 5900..."
websockify 6080 localhost:5900 &
sleep 1

echo "[start] Starting Node.js server..."
exec node /app/index.js
