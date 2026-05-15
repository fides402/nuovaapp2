"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCandidates, saveCandidates, saveCarousel, listCarousels, saveBook } from "../lib/storage";
import { buildCorpusBrief, buildGlobalIdf, mineChapter } from "../lib/miner";
import { MODELS, generateChapterCarousel } from "../lib/gemini";
import { deriveChaptersFromText } from "../lib/extract";

// Chapter-based workflow: one carousel per selected chapter.
// 1) Detect chapters during extraction.
// 2) Locally mine top candidate sentences PER chapter (using a book-global IDF).
// 3) On click, for each selected chapter, send only its candidates to Gemini.
// 4) Gemini extracts THE insight of that chapter and returns a full 10-slide carousel.

export default function BookPanel({ book: initialBook, settings, onClose, onMinimize, onCarouselReady, onGenerationProgress, open = true }) {
  const [book, setBook] = useState(initialBook);
  const [phase, setPhase] = useState("idle"); // idle | scanning | ready | generating | done | error
  const [error, setError] = useState("");
  const [chapterCands, setChapterCands] = useState({}); // {chapterIdx: [{text, score}]}
  const [brief, setBrief] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [existing, setExisting] = useState([]);
  const cancelRef = useRef({ cancelled: false });

  const chapters = book.chapters || [];

  // Map chapter index -> existing carousel (if any)
  const existingByChapter = useMemo(() => {
    const m = new Map();
    for (const c of existing) {
      if (typeof c?.chapter?.index === "number") m.set(c.chapter.index, c);
    }
    return m;
  }, [existing]);

  useEffect(() => {
    let cancelled = false;
    cancelRef.current = { cancelled: false };
    (async () => {
      try {
        setPhase("scanning");
        const list = await listCarousels(book.id);
        if (cancelled) return;
        setExisting(list);

        // Backfill chapters if missing (book was imported before chapter detection)
        let bk = book;
        if (!bk.chapters || bk.chapters.length === 0) {
          const derived = deriveChaptersFromText(bk.text || "");
          if (derived.length > 0) {
            bk = { ...bk, chapters: derived };
            await saveBook(bk);
            if (cancelled) return;
            setBook(bk);
          }
        }
        const chs = bk.chapters || [];

        const cached = await getCandidates(bk.id);
        if (cached?.chapterCands && cached?.brief && Object.keys(cached.chapterCands).length === chs.length) {
          if (cancelled) return;
          setChapterCands(cached.chapterCands);
          setBrief(cached.brief);
          const done = new Set(list.map((c) => c?.chapter?.index).filter((i) => typeof i === "number"));
          setSelected(new Set(chs.filter((c) => !done.has(c.index)).map((c) => c.index)));
          setPhase("ready");
          return;
        }

        // Compute global IDF once for stable per-chapter weighting
        const globalIdf = buildGlobalIdf(bk.text);
        const br = buildCorpusBrief(bk.text);
        const map = {};
        for (const ch of chs) {
          if (cancelled) return;
          const chText = bk.text.slice(ch.charStart, ch.charEnd);
          map[ch.index] = mineChapter(chText, { globalIdf, maxCandidates: 28 });
        }
        await saveCandidates(bk.id, { chapterCands: map, brief: br, when: Date.now() });
        if (cancelled) return;
        setChapterCands(map);
        setBrief(br);
        const done = new Set(list.map((c) => c?.chapter?.index).filter((i) => typeof i === "number"));
        setSelected(new Set(chs.filter((c) => !done.has(c.index)).map((c) => c.index)));
        setPhase("ready");
      } catch (e) {
        if (!cancelled) { setError(e.message); setPhase("error"); }
      }
    })();
    return () => { cancelled = true; cancelRef.current.cancelled = true; };
  }, [book.id]);

  function toggle(idx) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }
  function selectAll() { setSelected(new Set(chapters.map((c) => c.index))); }
  function selectNone() { setSelected(new Set()); }
  function selectMissing() {
    const done = new Set(existing.map((c) => c?.chapter?.index).filter((i) => typeof i === "number"));
    setSelected(new Set(chapters.filter((c) => !done.has(c.index)).map((c) => c.index)));
  }

  async function handleGenerate() {
    setError("");
    if (!(settings.apiKeys || []).some(Boolean)) {
      setError("Aggiungi una API key Gemini nelle Impostazioni.");
      return;
    }
    const queue = chapters.filter((c) => selected.has(c.index));
    if (queue.length === 0) {
      setError("Seleziona almeno un capitolo.");
      return;
    }
    // Keep screen awake on mobile so background-tab throttling doesn't kill fetches
    let wakeLock = null;
    try { if (navigator?.wakeLock) wakeLock = await navigator.wakeLock.request("screen"); } catch {}
    try {
      setPhase("generating");
      const model = MODELS[settings.mode] || MODELS.economy;
      let failed = 0;
      for (let i = 0; i < queue.length; i++) {
        if (cancelRef.current.cancelled) break;
        const ch = queue[i];
        setProgress({
          current: i,
          total: queue.length,
          label: `Capitolo ${i + 1}/${queue.length}: ${ch.title}`,
        });
        const cands = chapterCands[ch.index] || [];
        try {
          const car = await generateChapterCarousel({
            keys: settings.apiKeys,
            model,
            bookMeta: { title: book.title, author: book.author },
            chapter: ch,
            candidates: cands,
            language: settings.language,
          });
          const saved = await saveCarousel(book.id, {
            ...car,
            chapter: { index: ch.index, title: ch.title, startPage: ch.startPage || null },
            depth: car.depth || 3,
            quality: car.quality || 3,
          });
          onCarouselReady?.(saved);
          onGenerationProgress?.({ current: i + 1, total: queue.length, bookTitle: book.title, done: false });
          const updatedList = await listCarousels(book.id);
          setExisting(updatedList);
        } catch (e) {
          failed++;
          console.warn("Chapter carousel failed:", ch.title, e);
        }
        // Brief pause between chapters — avoids hitting rate limits on long batches
        if (i < queue.length - 1 && !cancelRef.current.cancelled) {
          await new Promise((r) => setTimeout(r, 1200));
        }
      }
      const doneLabel = failed > 0
        ? `Completato. ${failed} capitolo${failed !== 1 ? "i" : ""} non generato${failed !== 1 ? "i" : ""} — riprova selezionandoli.`
        : "Completato.";
      setProgress({ current: queue.length, total: queue.length, label: doneLabel });
      setPhase("done");
      onGenerationProgress?.({ current: queue.length, total: queue.length, bookTitle: book.title, done: true });
    } catch (e) {
      setError(e.message);
      setPhase("error");
    } finally {
      try { wakeLock?.release(); } catch {}
    }
  }

  const totalCandidates = Object.values(chapterCands).reduce((s, arr) => s + (arr?.length || 0), 0);

  return (
    <div
      className="fixed inset-0 z-40 bg-paper/95 backdrop-blur-md overflow-y-auto rise"
      style={!open ? { visibility: "hidden", pointerEvents: "none" } : undefined}
    >
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={phase === "generating" ? onMinimize : onClose}
            className="btn btn-ghost px-3 py-1.5 text-sm"
          >
            {phase === "generating" ? "← Torna al feed" : "← Indietro"}
          </button>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted">
            {book.format?.toUpperCase()} · {Math.round((book.totalChars || 0) / 1000)}k caratteri · {chapters.length} capitoli
          </div>
        </div>

        <h2 className="font-serif text-3xl leading-tight">{book.title}</h2>
        {book.author && <div className="text-muted mt-1">{book.author}</div>}

        <div className="hr my-6" />

        <div className="card p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted">
            <span className="dot" /> Scansione locale
          </div>
          <div className="mt-2 text-sm">
            {phase === "scanning" && "Sto leggendo e scandagliando i capitoli…"}
            {phase !== "scanning" && (
              <>Trovati <b>{chapters.length}</b> capitoli · {totalCandidates} passaggi candidati salvati in locale. Nessun dato è stato ancora inviato all'AI.</>
            )}
          </div>
        </div>

        <div className="card p-5 mt-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted">
              <span className="dot" /> Capitoli da trasformare in caroselli
            </div>
            <div className="flex items-center gap-2">
              <button onClick={selectAll} className="btn btn-ghost px-2.5 py-1 text-xs">Tutti</button>
              <button onClick={selectMissing} className="btn btn-ghost px-2.5 py-1 text-xs">Solo mancanti</button>
              <button onClick={selectNone} className="btn btn-ghost px-2.5 py-1 text-xs">Nessuno</button>
            </div>
          </div>

          <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1 -mr-1">
            <ul className="divide-y divide-line/60">
              {chapters.map((ch) => {
                const done = existingByChapter.has(ch.index);
                const isSelected = selected.has(ch.index);
                const cands = chapterCands[ch.index]?.length || 0;
                return (
                  <li key={ch.index} className="py-2.5 flex items-start gap-3">
                    <label className="flex items-start gap-3 flex-1 cursor-pointer min-w-0">
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={isSelected}
                        onChange={() => toggle(ch.index)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[10px] uppercase tracking-[0.22em] text-muted shrink-0">
                            {String(ch.index + 1).padStart(2, "0")}
                          </span>
                          <span className="text-[0.95rem] leading-snug">{ch.title}</span>
                          {done && (
                            <span className="text-[10px] uppercase tracking-widest border border-ink/40 text-ink/80 rounded-full px-2 py-0.5">
                              fatto
                            </span>
                          )}
                          {ch.synthetic && (
                            <span className="text-[10px] uppercase tracking-widest text-muted">sezione</span>
                          )}
                        </span>
                        <span className="block text-xs text-muted mt-0.5">
                          {Math.round((ch.charEnd - ch.charStart) / 1000)}k caratteri · {cands} candidati
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          {phase === "generating" && (
            <div className="mt-5 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="loading-dot">●</span>
                <span className="loading-dot" style={{ animationDelay: ".15s" }}>●</span>
                <span className="loading-dot" style={{ animationDelay: ".3s" }}>●</span>
                <span className="ml-2 truncate">{progress.label}</span>
              </div>
              <div className="w-full h-1 bg-line rounded-full overflow-hidden">
                <div
                  className="h-full bg-ink transition-all"
                  style={{ width: `${Math.round(((progress.current || 0) / (progress.total || 1)) * 100)}%` }}
                />
              </div>
            </div>
          )}
          {phase === "error" && <div className="mt-3 text-sm text-red-300">{error}</div>}

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-muted">
              Modalità: <b className="text-ink">{settings.mode === "deep" ? "profonda" : "economica"}</b> · {selected.size} capitoli selezionati
            </span>
            <button
              onClick={handleGenerate}
              disabled={phase === "scanning" || phase === "generating" || selected.size === 0}
              className="btn"
            >
              {phase === "generating" ? "Generazione…" : `Genera ${selected.size > 0 ? selected.size : ""} caroselli`}
            </button>
          </div>
        </div>

        {existing.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted mb-3">
              Caroselli esistenti per questo libro ({existing.length})
            </div>
            <div className="text-sm text-muted">Chiudi e aprili dal feed principale.</div>
          </div>
        )}
      </div>
    </div>
  );
}
