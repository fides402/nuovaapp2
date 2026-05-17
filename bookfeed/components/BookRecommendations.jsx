"use client";

import { useState } from "react";
import { generateBookRecommendations } from "../lib/gemini";

export default function BookRecommendations({ likedCarousels, books, settings }) {
  const [recs, setRecs] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const count = likedCarousels.length;

  async function generate() {
    setError("");
    setLoading(true);
    try {
      // books come { id → { title, author } } map
      const booksMap = Object.fromEntries((books || []).map((b) => [b.id, { title: b.title, author: b.author }]));
      const result = await generateBookRecommendations({
        likedCarousels,
        books: booksMap,
        keys: settings.apiKeys,
        groqKeys: settings.groqApiKeys,
        openRouterKeys: settings.openRouterKeys,
        language: settings.language,
      });
      setRecs(result);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function bookUrl(title, author) {
    return `https://1lib.sk/s/${encodeURIComponent(`${title} ${author}`)}`;
  }

  return (
    <section className="rise">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-serif text-2xl">Consigli di lettura</h2>
        {count > 0 && (
          <span className="text-[11px] uppercase tracking-[0.22em] text-muted">
            {count} ♥ preferit{count !== 1 ? "i" : "o"}
          </span>
        )}
      </div>

      {count === 0 ? (
        <div className="card p-5 text-sm text-muted leading-relaxed">
          Metti <span className="text-red-400">♥</span> ai caroselli che ti interessano per ricevere consigli di lettura personalizzati basati sui tuoi temi preferiti.
        </div>
      ) : (
        <>
          <div className="card p-5 mb-4">
            <p className="text-sm text-muted mb-4 leading-relaxed">
              Basato su {count} carosell{count !== 1 ? "i" : "o"} preferit{count !== 1 ? "i" : "o"}.
              L&apos;AI analizzerà i temi e suggerirà libri che li espandono.
            </p>
            <button onClick={generate} disabled={loading} className="btn">
              {loading ? "Generazione in corso…" : recs ? "Rigenera consigli" : "Genera consigli"}
            </button>
            {error && <p className="text-sm text-red-300 mt-3 leading-relaxed">{error}</p>}
          </div>

          {recs && (
            <div className="space-y-3">
              {recs.map((r, i) => (
                <a
                  key={i}
                  href={bookUrl(r.title, r.author)}
                  target="_blank"
                  rel="noreferrer"
                  className="card p-4 flex items-start justify-between gap-3 hover:border-ink transition-colors group"
                >
                  <div className="min-w-0">
                    <h4 className="font-serif text-lg leading-snug group-hover:underline underline-offset-4 decoration-1">
                      {r.title}
                    </h4>
                    <div className="text-sm text-muted mt-0.5">{r.author}</div>
                    <p className="text-sm text-muted mt-2 leading-relaxed">{r.reason}</p>
                    {Array.isArray(r.topics) && r.topics.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {r.topics.map((t) => (
                          <span key={t} className="text-[10px] uppercase tracking-widest border border-line rounded-full px-2 py-0.5 text-muted">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-muted shrink-0 text-sm mt-1 group-hover:text-ink transition-colors">↗</span>
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
