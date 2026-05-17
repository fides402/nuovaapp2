"use client";

import { get, set, del, keys } from "idb-keyval";

const BOOK_PREFIX = "book:";
const FEED_PREFIX = "feed:";
const CANDIDATES_PREFIX = "cand:";

export async function saveBook(book) {
  // book = { id, title, author, format, totalChars, addedAt, text? optional }
  await set(BOOK_PREFIX + book.id, book);
  return book;
}
export async function getBook(id) {
  return (await get(BOOK_PREFIX + id)) || null;
}
export async function listBooks() {
  const all = await keys();
  const out = [];
  for (const k of all) {
    if (typeof k === "string" && k.startsWith(BOOK_PREFIX)) {
      const b = await get(k);
      if (b) out.push(b);
    }
  }
  out.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  return out;
}
export async function deleteBook(id) {
  await del(BOOK_PREFIX + id);
  await del(CANDIDATES_PREFIX + id);
  // delete carousels too
  const all = await keys();
  for (const k of all) {
    if (typeof k === "string" && k.startsWith(FEED_PREFIX + id + ":")) {
      await del(k);
    }
  }
}

export async function saveCandidates(bookId, payload) {
  await set(CANDIDATES_PREFIX + bookId, payload);
}
export async function getCandidates(bookId) {
  return (await get(CANDIDATES_PREFIX + bookId)) || null;
}

export async function saveCarousel(bookId, carousel) {
  carousel.id = carousel.id || cryptoId();
  carousel.bookId = bookId;
  carousel.createdAt = carousel.createdAt || Date.now();
  await set(FEED_PREFIX + bookId + ":" + carousel.id, carousel);
  return carousel;
}
export async function listCarousels(bookId = null) {
  const all = await keys();
  const out = [];
  for (const k of all) {
    if (typeof k === "string" && k.startsWith(FEED_PREFIX)) {
      if (bookId && !k.startsWith(FEED_PREFIX + bookId + ":")) continue;
      const c = await get(k);
      if (c) out.push(c);
    }
  }
  out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return out;
}
export async function deleteCarousel(bookId, carouselId) {
  await del(FEED_PREFIX + bookId + ":" + carouselId);
}
export async function toggleCarouselLike(bookId, carouselId) {
  const key = FEED_PREFIX + bookId + ":" + carouselId;
  const c = await get(key);
  if (!c) return null;
  c.liked = !c.liked;
  await set(key, c);
  return c;
}

function cryptoId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Settings stored in localStorage (small, fine for sync access)
export const SettingsStore = {
  load() {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
      const raw = localStorage.getItem("bookfeed:settings");
      if (!raw) return DEFAULT_SETTINGS;
      const s = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...s };
    } catch { return DEFAULT_SETTINGS; }
  },
  save(s) {
    if (typeof window === "undefined") return;
    localStorage.setItem("bookfeed:settings", JSON.stringify(s));
  },
};

export const DEFAULT_SETTINGS = {
  apiKeys: ["", ""],      // Gemini keys
  groqApiKeys: [""],      // Groq keys (fallback)
  openRouterKeys: [""],   // OpenRouter keys (second fallback, free models)
  mode: "economy", // 'economy' | 'deep' | 'chatgpt'
  conceptCount: 6,
  language: "it",
  theme: "dark",
};
