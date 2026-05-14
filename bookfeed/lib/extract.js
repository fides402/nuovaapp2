"use client";

// PDF + EPUB text extraction, client-side.
// Returns: { text, pages: [{page, text}], meta: {title, author, totalChars, format} }

let pdfjsLib = null;
async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import("pdfjs-dist/build/pdf.mjs");
  // Use unpkg CDN worker matching the pinned version
  const ver = mod.version || "4.7.76";
  mod.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${ver}/build/pdf.worker.min.mjs`;
  pdfjsLib = mod;
  return mod;
}

export async function extractFromFile(file, onProgress = () => {}) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".epub") || file.type === "application/epub+zip") {
    return extractEpub(file, onProgress);
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdf(file, onProgress);
  }
  // Best-effort sniff
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const isPk = head[0] === 0x50 && head[1] === 0x4b;
  if (isPk) return extractEpub(file, onProgress);
  return extractPdf(file, onProgress);
}

async function extractPdf(file, onProgress) {
  const pdfjs = await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const total = pdf.numPages;
  const pages = [];
  let meta = { title: file.name?.replace(/\.[^.]+$/, "") || "Untitled", author: "", format: "pdf" };
  try {
    const m = await pdf.getMetadata();
    if (m?.info?.Title) meta.title = String(m.info.Title);
    if (m?.info?.Author) meta.author = String(m.info.Author);
  } catch {}

  for (let i = 1; i <= total; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    const items = tc.items || [];
    // Reconstruct simple line flow
    let lastY = null;
    let line = [];
    const lines = [];
    for (const it of items) {
      const y = it.transform?.[5];
      const s = (it.str || "").trim();
      if (!s && it.hasEOL) {
        if (line.length) { lines.push(line.join(" ")); line = []; }
        continue;
      }
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (line.length) { lines.push(line.join(" ")); line = []; }
      }
      line.push(it.str);
      lastY = y;
      if (it.hasEOL) {
        if (line.length) { lines.push(line.join(" ")); line = []; }
      }
    }
    if (line.length) lines.push(line.join(" "));
    const text = cleanText(lines.join("\n"));
    pages.push({ page: i, text });
    onProgress({ phase: "extract", current: i, total });
  }
  const text = pages.map((p) => p.text).join("\n\n");
  return { text, pages, meta: { ...meta, totalChars: text.length } };
}

async function extractEpub(file, onProgress) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  // Find content.opf
  let opfPath = null;
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (containerXml) {
    const m = containerXml.match(/full-path="([^"]+)"/i);
    if (m) opfPath = m[1];
  }
  if (!opfPath) {
    // Fallback: any .opf
    for (const f of Object.keys(zip.files)) {
      if (f.toLowerCase().endsWith(".opf")) { opfPath = f; break; }
    }
  }
  if (!opfPath) throw new Error("EPUB non valido: manca content.opf");

  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const opfXml = await zip.file(opfPath).async("string");
  const doc = new DOMParser().parseFromString(opfXml, "application/xml");

  const title = doc.querySelector("metadata > *[*|title], metadata > title, dc\\:title, *[lang] > title")?.textContent
    || doc.getElementsByTagName("dc:title")[0]?.textContent
    || (file.name || "Untitled").replace(/\.[^.]+$/, "");
  const author = doc.getElementsByTagName("dc:creator")[0]?.textContent || "";

  // Manifest id -> href
  const manifest = {};
  doc.querySelectorAll("manifest > item").forEach((it) => {
    manifest[it.getAttribute("id")] = {
      href: it.getAttribute("href"),
      mediaType: it.getAttribute("media-type"),
    };
  });
  // Spine order
  const spine = [];
  doc.querySelectorAll("spine > itemref").forEach((ir) => {
    const id = ir.getAttribute("idref");
    if (manifest[id]) spine.push(manifest[id]);
  });

  const items = spine.filter((it) => /xhtml|html|xml/i.test(it.mediaType || ""));
  const pages = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const path = (opfDir + it.href).replace(/\\/g, "/");
    const file2 = zip.file(decodeURIComponent(path)) || zip.file(path);
    if (!file2) continue;
    const html = await file2.async("string");
    const text = cleanText(htmlToText(html));
    pages.push({ page: i + 1, text });
    onProgress({ phase: "extract", current: i + 1, total: items.length });
  }
  const text = pages.map((p) => p.text).join("\n\n");
  return {
    text,
    pages,
    meta: { title, author, format: "epub", totalChars: text.length },
  };
}

function htmlToText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Replace block elements with newlines
  const blocks = doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, br, div, section, article");
  blocks.forEach((el) => {
    el.appendChild(doc.createTextNode("\n"));
  });
  const text = (doc.body?.innerText || doc.body?.textContent || "").trim();
  return text;
}

export function cleanText(s) {
  return s
    .replace(/\r/g, "")
    .replace(/­/g, "")
    .replace(/[​-‍﻿]/g, "")
    // Join hyphenated line-breaks (e.g. "transi-\ntion" -> "transition")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    // Collapse single newlines inside paragraphs to spaces, keep paragraph breaks
    .replace(/([^\n])\n([^\n])/g, "$1 $2")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

// Stable hash for caching by file content
export async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
