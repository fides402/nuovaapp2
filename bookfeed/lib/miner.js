// Local concept miner — runs entirely in the browser, no AI calls.
// Purpose: scan the full book and surface the most concept-rich candidate
// passages, so we send only a tiny, hand-picked payload to the AI.

const STOPWORDS = new Set((
  "the of and to a in is it that for on with as this be by are or an at from " +
  "we you he she they them its which but not have has had been was were can will " +
  "would could should may might do does did so if then than too very also more most " +
  "into about over under between through during without within while because just our us " +
  "their your his her my me i one two three any all some such only own same other " +
  "il lo la i gli le un uno una di a da in con su per tra fra e o ma se che chi cui non " +
  "è sono essere stato sarà ho hai ha abbiamo avete hanno suo sua loro questo quello " +
  "come quando dove perché molto più meno anche solo già ancora però quindi inoltre"
).split(/\s+/));

export function splitSentences(text) {
  // Robust sentence split with European punctuation handling.
  // Avoids breaking common abbreviations.
  const protect = (s) => s
    .replace(/\b(Dr|Mr|Mrs|Ms|St|vs|etc|e\.g|i\.e|cap|sig|prof|ing|dott|art|fig|cf|ca)\./gi, "$1∯")
    .replace(/(\b[A-Z])\.(\s+[A-Z])/g, "$1∯$2");
  const restore = (s) => s.replace(/∯/g, ".");
  const out = [];
  const paragraphs = text.split(/\n{2,}/);
  for (const p of paragraphs) {
    const protectedP = protect(p);
    const parts = protectedP.split(/(?<=[.!?…])\s+(?=[A-ZÀ-ÖØ-Ý«"'(])/g);
    for (const part of parts) {
      const clean = restore(part).replace(/\s+/g, " ").trim();
      if (clean.length >= 30 && clean.length <= 600) out.push(clean);
    }
  }
  return out;
}

export function chunkText(text, target = 1800, overlap = 150) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + target, text.length);
    if (end < text.length) {
      // back off to nearest paragraph/sentence boundary
      const slice = text.slice(i, end);
      const lastPara = slice.lastIndexOf("\n\n");
      const lastDot = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
      const cut = lastPara > target * 0.5 ? lastPara : (lastDot > target * 0.5 ? lastDot + 1 : slice.length);
      end = i + cut;
    }
    chunks.push({ start: i, end, text: text.slice(i, end).trim() });
    if (end >= text.length) break;
    i = Math.max(0, end - overlap);
  }
  return chunks;
}

function tokens(s) {
  return s.toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t && t.length > 2 && !STOPWORDS.has(t));
}

export function computeIdf(sentences) {
  const df = new Map();
  for (const s of sentences) {
    const seen = new Set(tokens(s));
    for (const t of seen) df.set(t, (df.get(t) || 0) + 1);
  }
  const N = sentences.length || 1;
  const idf = new Map();
  for (const [t, d] of df) idf.set(t, Math.log(1 + N / d));
  return idf;
}

const DEF_PATTERNS = [
  /\b(?:is|are|means|refers to|consists of|can be defined as|è|sono|significa|si definisce|consiste in)\b/i,
  /\b(?:in other words|that is|cioè|ovvero|in altre parole)\b/i,
];
const TRANSFORM_MARKERS = [
  /\b(however|therefore|thus|nevertheless|paradoxically|surprisingly|crucially|fundamentally|the key insight|the main point|what matters)\b/i,
  /\b(tuttavia|quindi|perciò|paradossalmente|sorprendentemente|fondamentalmente|in realtà|il punto è)\b/i,
];
const ENUMERATION = /\b(first|second|third|finally|primo|secondo|terzo|infine)\b/i;

function scoreSentence(s, idf, freq) {
  const tks = tokens(s);
  if (tks.length < 6) return 0;
  let score = 0;
  // Information density via average idf
  let idfSum = 0;
  for (const t of tks) idfSum += idf.get(t) || 0;
  const avgIdf = idfSum / tks.length;
  score += avgIdf * 1.4;

  // Recurrence: presence of high-frequency content words boosts importance
  let recur = 0;
  for (const t of tks) recur += Math.log(1 + (freq.get(t) || 0));
  score += (recur / tks.length) * 0.6;

  // Pattern boosts
  for (const re of DEF_PATTERNS) if (re.test(s)) { score += 1.6; break; }
  for (const re of TRANSFORM_MARKERS) if (re.test(s)) { score += 1.2; break; }
  if (ENUMERATION.test(s)) score += 0.4;

  // Length sweet-spot 70-280 chars
  const L = s.length;
  if (L >= 70 && L <= 280) score += 0.6;
  if (L > 380) score -= 0.4;

  // Penalize all-caps / heading-ish
  const upperRatio = (s.replace(/[^A-ZÀ-Ý]/g, "").length) / s.length;
  if (upperRatio > 0.35) score -= 0.8;

  // Penalize numeric-heavy lines (TOC, references)
  const numRatio = (s.replace(/[^0-9]/g, "").length) / s.length;
  if (numRatio > 0.15) score -= 0.6;

  return score;
}

export function mineCandidates(fullText, { perSection = 6, maxCandidates = 70, sections: nSections = 12, globalIdf = null } = {}) {
  // Sectioning: split into N roughly equal sections so we cover the input.
  const sections = sliceSections(fullText, nSections);
  const allSentences = splitSentences(fullText);
  const idf = globalIdf || computeIdf(allSentences);
  // Global term frequency
  const freq = new Map();
  for (const s of allSentences) {
    for (const t of tokens(s)) freq.set(t, (freq.get(t) || 0) + 1);
  }

  const candidates = [];
  sections.forEach((sec, secIdx) => {
    const sents = splitSentences(sec.text);
    const scored = sents.map((s) => ({ s, score: scoreSentence(s, idf, freq) }));
    scored.sort((a, b) => b.score - a.score);
    const taken = [];
    for (const item of scored) {
      if (taken.length >= perSection) break;
      // Dedup: skip if too similar to already-taken in this section
      if (taken.some((t) => jaccard(t.s, item.s) > 0.55)) continue;
      taken.push(item);
    }
    for (const t of taken) {
      candidates.push({
        text: t.s,
        score: t.score,
        section: secIdx + 1,
        sectionPct: Math.round(((secIdx + 0.5) / sections.length) * 100),
      });
    }
  });

  // Global dedup + cap
  candidates.sort((a, b) => b.score - a.score);
  const final = [];
  for (const c of candidates) {
    if (final.length >= maxCandidates) break;
    if (final.some((f) => jaccard(f.text, c.text) > 0.5)) continue;
    final.push(c);
  }
  // Sort by reading order (section) for nicer AI prompt structure
  final.sort((a, b) => a.section - b.section || b.score - a.score);
  return final;
}

function sliceSections(text, n) {
  const len = text.length;
  if (len === 0) return [];
  const size = Math.ceil(len / n);
  const sections = [];
  for (let i = 0; i < n; i++) {
    const start = i * size;
    const end = Math.min(len, start + size);
    if (start >= len) break;
    sections.push({ start, end, text: text.slice(start, end) });
  }
  return sections;
}

function jaccard(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const uni = A.size + B.size - inter;
  return inter / uni;
}

// Mine candidates for one chapter — fewer sections, fewer per section,
// reuses the book-global IDF for stable term weighting.
export function mineChapter(chapterText, { globalIdf = null, maxCandidates = 28 } = {}) {
  if (!chapterText || chapterText.length < 400) return [];
  const nSections = Math.max(3, Math.min(6, Math.round(chapterText.length / 4000)));
  const perSection = Math.max(3, Math.ceil(maxCandidates / nSections));
  return mineCandidates(chapterText, {
    perSection,
    maxCandidates,
    sections: nSections,
    globalIdf,
  });
}

// Pre-compute the book-global IDF once so per-chapter mining uses consistent term weights.
export function buildGlobalIdf(fullText) {
  const sents = splitSentences(fullText);
  return computeIdf(sents);
}

// Build a compact corpus brief: top terms + bigrams. Used as context for the AI.
export function buildCorpusBrief(fullText) {
  const sents = splitSentences(fullText);
  const tf = new Map();
  const bg = new Map();
  for (const s of sents) {
    const ts = tokens(s);
    for (let i = 0; i < ts.length; i++) {
      tf.set(ts[i], (tf.get(ts[i]) || 0) + 1);
      if (i < ts.length - 1) {
        const k = ts[i] + " " + ts[i + 1];
        bg.set(k, (bg.get(k) || 0) + 1);
      }
    }
  }
  const topTerms = [...tf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map((x) => x[0]);
  const topBigrams = [...bg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map((x) => x[0]);
  return { topTerms, topBigrams, sentenceCount: sents.length };
}
