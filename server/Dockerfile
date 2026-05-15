FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV DISPLAY=:99
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ── System packages ────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget gnupg ca-certificates \
    xvfb x11vnc \
    novnc \
    xclip \
    && rm -rf /var/lib/apt/lists/*

# ── Node.js 20 ─────────────────────────────────────────────────────────────────
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── npm install (playwright + deps) ───────────────────────────────────────────
COPY package.json ./
RUN npm install

# ── Playwright: install Chromium + all OS deps ────────────────────────────────
RUN npx playwright install chromium --with-deps

# ── Copy app ──────────────────────────────────────────────────────────────────
COPY . .
RUN chmod +x /app/start.sh

# ── Persistent data dir ───────────────────────────────────────────────────────
RUN mkdir -p /data

EXPOSE 10000

CMD ["/app/start.sh"]
