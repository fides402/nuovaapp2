"use client";

export default function Feed({ books, carousels, onOpenCarousel, onOpenBook, onDeleteBook }) {
  if (!books.length) return null;
  return (
    <div className="space-y-8">
      {books.map((b) => {
        const list = carousels.filter((c) => c.bookId === b.id);
        return (
          <section key={b.id} className="rise">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted">{b.format?.toUpperCase()} · {formatChars(b.totalChars)}</div>
                <h3 className="font-serif text-2xl leading-tight truncate">{b.title}</h3>
                {b.author && <div className="text-muted text-sm">{b.author}</div>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onOpenBook(b)} className="btn btn-ghost px-3 py-1.5 text-sm">Genera</button>
                <button onClick={() => { if (confirm(`Eliminare "${b.title}" e tutti i suoi caroselli?`)) onDeleteBook(b); }} className="btn btn-ghost px-3 py-1.5 text-sm text-muted">×</button>
              </div>
            </div>
            {list.length === 0 ? (
              <div className="card p-5 text-muted text-sm">
                Nessun carosello ancora. Apri il libro e premi <span className="text-ink">Genera</span>.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {list.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onOpenCarousel(c, b)}
                    className="card p-4 text-left hover:border-ink transition-colors group"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-muted">
                      <span>Carosello · {c.slides?.length || 10} slide</span>
                      <span>{relativeTime(c.createdAt)}</span>
                    </div>
                    <h4 className="font-serif text-lg leading-snug mt-2 group-hover:underline underline-offset-4 decoration-1">
                      {c.title}
                    </h4>
                    {c.concept && <p className="text-sm text-muted mt-1 line-clamp-2">{c.concept}</p>}
                    {Array.isArray(c.tags) && c.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {c.tags.slice(0, 4).map((t) => (
                          <span key={t} className="text-[10px] uppercase tracking-widest border border-line rounded-full px-2 py-0.5 text-muted">{t}</span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function formatChars(n) {
  if (!n) return "—";
  if (n > 1_000_000) return (n / 1_000_000).toFixed(1) + "M caratteri";
  if (n > 1_000) return Math.round(n / 1_000) + "k caratteri";
  return n + " caratteri";
}

function relativeTime(ts) {
  if (!ts) return "";
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "ora";
  if (d < 3600) return Math.floor(d / 60) + " min fa";
  if (d < 86400) return Math.floor(d / 3600) + " h fa";
  return Math.floor(d / 86400) + " g fa";
}
