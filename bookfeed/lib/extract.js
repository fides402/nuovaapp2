"use client";

// PDF + EPUB text extraction, client-side.
// Returns: {
//   text, pages: [{page, text}],
//   chapters: [{ index, title, charStart, charEnd, startPage?, synthetic? }],
//   meta: { title, author, totalChars, format }
// }

let pdfjsLib = null;
async function loadPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  const mod = await import("pdfjs-dist/build/pdf.mjs");
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

  // Build full text with explicit char offsets per page
  const parts = [];
  const pageOffsets = [];
  let off = 0;
  for (let i = 0; i < pages.length; i++) {
    pageOffsets.push(off);
    parts.push(pages[i].text);
    off += pages[i].text.length;
    if (i < pages.length - 1) off += 2; // "\n\n" separator
  }
  const text = parts.join("\n\n");

  // Chapter detection
  let chapters = [];
  try {
    const outline = await pdf.getOutline();
    const flat = flattenOutline(outline || []);
    if (flat.length >= 3) {
      chapters = await chaptersFromOutline(pdf, flat, pageOffsets, text.length);
    }
  } catch {}
  if (chapters.length < 2) {
    const detected = detectChaptersFromText(text);
    if (detected.length >= 2) chapters = detected;
  }
  if (chapters.length < 2) {
    chapters = syntheticChapters(text);
  }

  return {
    text,
    pages,
    chapters,
    meta: { ...meta, totalChars: text.length },
  };
}

async function extractEpub(file, onProgress) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  let opfPath = null;
  const containerXml = await zip.file("META-INF/container.xml")?.async("string");
  if (containerXml) {
    const m = containerXml.match(/full-path="([^"]+)"/i);
    if (m) opfPath = m[1];
  }
  if (!opfPath) {
    for (const f of Object.keys(zip.files)) {
      if (f.toLowerCase().endsWith(".opf")) { opfPath = f; break; }
    }
  }
  if (!opfPath) throw new Error("EPUB non valido: manca content.opf");

  const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
  const opfXml = await zip.file(opfPath).async("string");
  const doc = new DOMParser().parseFromString(opfXml, "application/xml");

  const title = doc.getElementsByTagName("dc:title")[0]?.textContent
    || (file.name || "Untitled").replace(/\.[^.]+$/, "");
  const author = doc.getElementsByTagName("dc:creator")[0]?.textContent || "";

  const manifest = {};
  doc.querySelectorAll("manifest > item").forEach((it) => {
    manifest[it.getAttribute("id")] = {
      href: it.getAttribute("href"),
      mediaType: it.getAttribute("media-type"),
    };
  });
  const spine = [];
  doc.querySelectorAll("spine > itemref").forEach((ir) => {
    const id = ir.getAttribute("idref");
    if (manifest[id]) spine.push(manifest[id]);
  });

  const items = spine.filter((it) => /xhtml|html|xml/i.test(it.mediaType || ""));
  const pages = [];
  const chapters = [];
  const textParts = [];
  let offset = 0;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const path = (opfDir + it.href).replace(/\\/g, "/");
    const file2 = zip.file(decodeURIComponent(path)) || zip.file(path);
    if (!file2) continue;
    const html = await file2.async("string");
    const parsed = parseHtmlChunk(html);
    const cleaned = cleanText(parsed.text);
    pages.push({ page: i + 1, text: cleaned });
    if (cleaned.length >= 800) {
      const chTitle = parsed.title || `Capitolo ${chapters.length + 1}`;
      chapters.push({
        index: chapters.length,
        title: chTitle.slice(0, 140),
        charStart: offset,
        charEnd: offset + cleaned.length,
      });
    }
    textParts.push(cleaned);
    offset += cleaned.length + 2; // "\n\n"
    onProgress({ phase: "extract", current: i + 1, total: items.length });
  }
  const text = textParts.join("\n\n");

  // If we still detected too few chapters (most EPUBs have many tiny spine items),
  // try a regex pass over text as well.
  if (chapters.length < 2) {
    const detected = detectChaptersFromText(text);
    if (detected.length >= 2) chapters.splice(0, chapters.length, ...detected);
  }
  if (chapters.length < 2) {
    chapters.splice(0, chapters.length, ...syntheticChapters(text));
  }

  return {
    text,
    pages,
    chapters,
    meta: { title, author, format: "epub", totalChars: text.length },
  };
}

function parseHtmlChunk(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // Title preference: first h1/h2/h3, fallback to <title>
  const heading = doc.querySelector("h1, h2, h3");
  const titleTag = doc.querySelector("title");
  const title = (heading?.textContent || titleTag?.textContent || "").trim().replace(/\s+/g, " ");
  // Block-aware textification
  const blocks = doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, br, div, section, article");
  blocks.forEach((el) => el.appendChild(doc.createTextNode("\n")));
  const text = (doc.body?.innerText || doc.body?.textContent || "").trim();
  return { title, text };
}

function flattenOutline(items, depth = 0, out = []) {
  for (const it of items) {
    out.push({ title: it.title, dest: it.dest, depth });
    if (it.items && it.items.length) flattenOutline(it.items, depth + 1, out);
  }
  return out;
}

async function chaptersFromOutline(pdf, flat, pageOffsets, totalChars) {
  const points = [];
  for (const it of flat) {
    if (!it.dest || it.depth > 0) continue; // top-level only
    let dest = it.dest;
    if (typeof dest === "string") {
      try { dest = await pdf.getDestination(dest); } catch { continue; }
    }
    if (!Array.isArray(dest)) continue;
    const ref = dest[0];
    let pageIndex;
    try { pageIndex = await pdf.getPageIndex(ref); } catch { continue; }
    points.push({
      title: (it.title || "").trim() || `Capitolo ${points.length + 1}`,
      page: pageIndex + 1,
    });
  }
  // Dedup + sort by page
  points.sort((a, b) => a.page - b.page);
  const dedup = [];
  for (const p of points) {
    if (!dedup.length || p.page !== dedup[dedup.length - 1].page) dedup.push(p);
  }
  if (dedup.length < 2) return [];
  const chapters = [];
  for (let i = 0; i < dedup.length; i++) {
    const start = pageOffsets[dedup[i].page - 1] || 0;
    const end = i + 1 < dedup.length
      ? (pageOffsets[dedup[i + 1].page - 1] || totalChars)
      : totalChars;
    if (end - start < 1500) continue; // skip tiny "chapters" (TOC, dedication)
    chapters.push({
      index: chapters.length,
      title: dedup[i].title.slice(0, 140),
      charStart: start,
      charEnd: end,
      startPage: dedup[i].page,
    });
  }
  return chapters;
}

const CHAPTER_RE_PATTERNS = [
  /^[ \t]*(?:CAPITOLO|Capitolo|CAP\.?)\s+(?:[IVXLCDM]+|\d+)(?:[\s.:\-—][^\n]{0,140})?$/gm,
  /^[ \t]*(?:CHAPTER|Chapter)\s+(?:[IVXLCDM]+|\d+)(?:[\s.:\-—][^\n]{0,140})?$/gm,
  /^[ \t]*(?:PARTE|Parte|PART|Part)\s+(?:[IVXLCDM]+|\d+)(?:[\s.:\-—][^\n]{0,140})?$/gm,
  // Numbered headings: "1. Titolo della sezione"
  /^[ \t]*\d{1,2}\s*\.\s+[A-ZÀ-ÝÈÉÌÒÙ][^\n]{4,90}$/gm,
];

function detectChaptersFromText(text) {
  const all = [];
  for (const re of CHAPTER_RE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      all.push({ start: m.index, title: m[0].trim() });
    }
  }
  all.sort((a, b) => a.start - b.start);
  // Dedup near-duplicates (likely table of contents): if two matches are within
  // 600 chars, keep only the later — the TOC entry comes first.
  const filtered = [];
  for (const m of all) {
    const prev = filtered[filtered.length - 1];
    if (!prev || m.start - prev.start > 800) filtered.push(m);
    else filtered[filtered.length - 1] = m; // overwrite TOC entry
  }
  if (filtered.length < 3) return [];
  const chapters = [];
  for (let i = 0; i < filtered.length; i++) {
    const start = filtered[i].start;
    const end = i + 1 < filtered.length ? filtered[i + 1].start : text.length;
    if (end - start < 1500) continue;
    chapters.push({
      index: chapters.length,
      title: filtered[i].title.replace(/\s+/g, " ").slice(0, 140),
      charStart: start,
      charEnd: end,
    });
  }
  return chapters;
}

function syntheticChapters(text) {
  const n = Math.max(4, Math.min(12, Math.round(text.length / 25000)));
  const size = Math.ceil(text.length / n);
  const out = [];
  for (let i = 0; i < n; i++) {
    const charStart = i * size;
    const charEnd = Math.min(text.length, (i + 1) * size);
    if (charEnd - charStart < 1500) continue;
    out.push({
      index: out.length,
      title: `Parte ${out.length + 1}`,
      charStart,
      charEnd,
      synthetic: true,
    });
  }
  return out;
}

export function cleanText(s) {
  return s
    .replace(/\r/g, "")
    .replace(/­/g, "")
    .replace(/[​-‍﻿]/g, "")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/([^\n])\n([^\n])/g, "$1 $2")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function hashFile(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
