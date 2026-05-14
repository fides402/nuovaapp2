"use client";

import { useEffect, useState } from "react";
import { getCandidates, saveCandidates, saveCarousel, listCarousels } from "../lib/storage";
import { buildCorpusBrief, mineCandidates } from "../lib/miner";
import { MODELS, generateCarousel, selectConcepts } from "../lib/gemini";

// Workflow panel: shown after upload (or when reopening a book).
// 1) Local scan -> candidates
// 2) "Genera caroselli" button -> AI concept selection + 10-slide generation per concept.

export default function BookPanel({ book, settings, onClose, onCarouselReady }) {
  const [phase, setPhase] = useState("idle"); // idle | scanning | ready | selecting | generating | done | error
  const [error, setError] = useState("");
  const [candidates, setCandidates] = useState(null);
  const [brief, setBrief] = useState(null);
  const [concepts, setConcepts] = useState([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, label: "" });
  const [existing, setExisting] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPhase("scanning");
        const cached = await getCandidates(book.id);
        const list = await listCarousels(book.id);
        if (!cancelled) setExisting(list);
        if (cached?.candidates?.length) {
          if (!cancelled) {
            setCandidates(cached.candidates);
            setBrief(cached.brief);
            setPhase("ready");
          }
          return;
        }
        // Local scan
        const cand = mineCandidates(book.text, { perSection: 6, maxCandidates: 70 });
        const br = buildCorpusBrief(book.text);
        if (cancelled) return;
        await saveCandidates(book.id, { candidates: cand, brief: br, when: Date.now() });
        setCandidates(cand);
        setBrief(br);
        setPhase("ready");
      } catch (e) {
        if (!cancelled) { setError(e.message); setPhase("error"); }
      }
    })();
    return () => { cancelled = true; };
  }, [book.id, book.text]);

  async function handleGenerate() {
    setError("");
    if (!settings.apiKeys?.[0] && !settings.apiKeys?.[1]) {
      setError("Aggiungi una API key Gemini nelle Impostazioni.");
      return;
    }
    try {
      setPhase("selecting");
      setProgress({ current: 0, total: settings.conceptCount, label: "Sto scegliendo i concetti…" });
      const model = MODELS[settings.mode] || MODELS.economy;
      const chosen = await selectConcepts({
        keys: settings.apiKeys,
        model,
        bookMeta: { title: book.title, author: book.author },
        brief,
        candidates,
        targetCount: settings.conceptCount,
        language: settings.language,
      });
      setConcepts(chosen);
      setPhase("generating");

      const created = [];
      for (let i = 0; i < chosen.length; i++) {
        setProgress({ current: i, total: chosen.length, label: `Carosello ${i + 1}/${chosen.length}: ${chosen[i].title}` });
        try {
          const car = await generateCarousel({
            keys: settings.apiKeys,
            model,
            bookMeta: { title: book.title, author: book.author },
            concept: chosen[i],
            language: settings.language,
          });
          const saved = await saveCarousel(book.id, {
            ...car,
            concept_id: i,
            depth: car.depth || chosen[i].depth || 3,
            quality: car.quality || 3,
          });
          created.push(saved);
          onCarouselReady?.(saved);
        } catch (e) {
          // Continue with the others, surface partial errors
          console.warn("Carousel failed:", e);
        }
      }
      setProgress({ current: chosen.length, total: chosen.length, label: "Completato." });
      const updated = await listCarousels(book.id);
      setExisting(updated);
      setPhase("done");
    } catch (e) {
      setError(e.message);
      setPhase("error");
    }
  }

  return (
    <div className="fixed inset-0 z-40 bg-paper/95 backdrop-blur-md overflow-y-auto rise">
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="btn btn-ghost px-3 py-1.5 text-sm">← Indietro</button>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted">
            {book.format?.toUpperCase()} · {Math.round((book.totalChars || 0) / 1000)}k caratteri
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
            {phase === "scanning" && "Sto leggendo e scandagliando il libro…"}
            {phase !== "scanning" && candidates && (
              <>Identificati <b>{candidates.length}</b> passaggi candidati su tutto il libro. Nessun dato è stato ancora inviato all'AI.</>
            )}
          </div>
        </div>

        <div className="card p-5 mt-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted">
            <span className="dot" /> Generazione caroselli
          </div>
          <p className="text-sm mt-2 text-ink/90">
            Premi il pulsante per inviare a Gemini solo i candidati selezionati. Verranno creati{" "}
            <b>{settings.conceptCount}</b> caroselli da 10 slide ciascuno (modalità: {settings.mode === "deep" ? "profonda" : "economica"}).
          </p>
          {(phase === "selecting" || phase === "generating") && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="loading-dot">●</span>
                <span className="loading-dot" style={{ animationDelay: ".15s" }}>●</span>
                <span className="loading-dot" style={{ animationDelay: ".3s" }}>●</span>
                <span className="ml-2">{progress.label}</span>
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
          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={phase === "scanning" || phase === "selecting" || phase === "generating"}
              className="btn"
            >
              {phase === "selecting" || phase === "generating" ? "Generazione…" : "Genera caroselli"}
            </button>
            <span className="text-xs text-muted">
              I crediti consumati dipendono dalla modalità e dal numero di concetti.
            </span>
          </div>
        </div>

        {concepts.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted mb-3">Concetti selezionati dall'AI</div>
            <div className="space-y-2">
              {concepts.map((c, i) => (
                <div key={i} className="card p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <h4 className="font-serif text-lg">{c.title}</h4>
                    {typeof c.section_pct === "number" && (
                      <span className="text-[10px] uppercase tracking-widest text-muted">~{c.section_pct}% del libro</span>
                    )}
                  </div>
                  {c.thesis && <p className="text-sm mt-1 text-ink/90">{c.thesis}</p>}
                  {c.why_it_matters && <p className="text-xs mt-1 text-muted">{c.why_it_matters}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {existing.length > 0 && (
          <div className="mt-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted mb-3">Caroselli già esistenti ({existing.length})</div>
            <div className="text-sm text-muted">Chiudi e aprili dal feed principale.</div>
          </div>
        )}
      </div>
    </div>
  );
}
