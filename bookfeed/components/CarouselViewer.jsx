"use client";

import { useEffect, useRef, useState } from "react";
import SlideRenderer from "./SlideRenderer";
import Pinchable from "./Pinchable";
import { exportCarouselAsPdf, exportCarouselAsZipPng, exportSlideAsPng } from "../lib/exporter";

export default function CarouselViewer({ carousel, book, onClose, onDelete }) {
  const [idx, setIdx] = useState(0);
  const [invert, setInvert] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  // Refs to the export-quality (hidden, fixed-size) slides.
  const exportRefs = useRef([]);

  const slides = carousel?.slides || [];

  useEffect(() => {
    function onKey(e) {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(slides.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      else if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length, onClose]);

  function goNext() { setIdx((i) => Math.min(slides.length - 1, i + 1)); }
  function goPrev() { setIdx((i) => Math.max(0, i - 1)); }

  const tags = carousel?.tags || [];

  async function handleExport(kind) {
    setBusy(kind);
    setMenuOpen(false);
    try {
      const nodes = exportRefs.current.filter(Boolean);
      const base = sanitize(carousel.title || "carousel");
      if (kind === "pdf") await exportCarouselAsPdf(nodes, `${base}.pdf`);
      else if (kind === "zip") await exportCarouselAsZipPng(nodes, base);
      else if (kind === "current") {
        const node = exportRefs.current[idx];
        if (node) await exportSlideAsPng(node, `${base}-${String(idx + 1).padStart(2, "0")}.png`);
      }
    } catch (e) {
      alert("Errore export: " + e.message);
    } finally {
      setBusy(null);
    }
  }

  const current = slides[idx];

  return (
    <div className="fixed inset-0 bg-paper/95 backdrop-blur-md z-50 overflow-y-auto rise">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-4 gap-2">
          <button onClick={onClose} className="btn btn-ghost px-3 py-1.5 text-sm">← Chiudi</button>
          <div className="flex items-center gap-2 relative">
            <button onClick={() => setInvert((v) => !v)} className="btn btn-ghost px-3 py-1.5 text-sm" title="Inverti tema slide">
              {invert ? "Tema scuro" : "Tema chiaro"}
            </button>
            <button onClick={() => setMenuOpen((v) => !v)} className="btn btn-ghost px-3 py-1.5 text-sm">Esporta ▾</button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 card p-2 w-56 z-10">
                <button disabled={!!busy} onClick={() => handleExport("current")} className="block w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm">
                  {busy === "current" ? "…" : "Slide corrente · PNG"}
                </button>
                <button disabled={!!busy} onClick={() => handleExport("zip")} className="block w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm">
                  {busy === "zip" ? "…" : "Tutte · PNG (zip)"}
                </button>
                <button disabled={!!busy} onClick={() => handleExport("pdf")} className="block w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-sm">
                  {busy === "pdf" ? "…" : "Carosello · PDF"}
                </button>
              </div>
            )}
            {onDelete && (
              <button onClick={() => { if (confirm("Eliminare questo carosello?")) onDelete(); }} className="btn btn-ghost px-3 py-1.5 text-sm text-muted hover:text-ink">
                Elimina
              </button>
            )}
          </div>
        </div>

        <div className="mb-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted">
            {book?.title || "Libro"}{book?.author ? " · " + book.author : ""}
          </div>
          {carousel.chapter?.title && (
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted mt-1">
              Cap. {String((carousel.chapter.index ?? 0) + 1).padStart(2, "0")} · <span className="text-ink/80 normal-case tracking-normal">{carousel.chapter.title}</span>
            </div>
          )}
          <h2 className="font-serif text-2xl sm:text-3xl leading-tight mt-2">{carousel.title}</h2>
          {carousel.concept && <div className="text-muted mt-1 max-w-[60ch]">{carousel.concept}</div>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {tags.map((t) => (
                <span key={t} className="text-[11px] uppercase tracking-widest border border-line rounded-full px-2 py-1 text-muted">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Visible slide */}
        <div className="relative max-w-[460px] mx-auto">
          <Pinchable resetKey={idx} onSwipeLeft={goNext} onSwipeRight={goPrev}>
            {current && (
              <SlideRenderer
                slide={current}
                index={idx}
                total={slides.length}
                bookTitle={book?.title}
                bookAuthor={book?.author}
                invert={invert}
              />
            )}
          </Pinchable>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: i === idx ? 18 : 6,
                  background: i === idx ? "#f5f5f0" : "#2a2a2a",
                }}
                aria-label={`Vai alla slide ${i + 1}`}
              />
            ))}
          </div>

          <div className="text-center mt-2 text-[10px] uppercase tracking-[0.22em] text-muted">
            <span className="hidden sm:inline">scroll + ctrl o doppio click per zoom · </span>
            <span className="sm:hidden">pinch o doppio tap per zoom · </span>
            swipe o frecce per navigare
          </div>

          {/* Nav arrows (desktop) */}
          <div className="hidden sm:flex absolute inset-y-0 -left-14 items-center">
            <button onClick={goPrev} className="btn btn-ghost w-10 h-10 p-0">←</button>
          </div>
          <div className="hidden sm:flex absolute inset-y-0 -right-14 items-center">
            <button onClick={goNext} className="btn btn-ghost w-10 h-10 p-0">→</button>
          </div>
        </div>

        {carousel.caption && (
          <div className="max-w-[60ch] mx-auto mt-8 text-[0.95rem] leading-[1.65] text-ink/90 whitespace-pre-line">
            {carousel.caption}
          </div>
        )}

        {/* Hidden export-quality stage: fixed 1080×1350 px */}
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            left: "-100000px",
            top: 0,
            width: 1080,
            pointerEvents: "none",
          }}
        >
          {slides.map((s, i) => (
            <div key={"x-" + i} style={{ width: 1080, height: 1350, marginBottom: 20 }}>
              <div
                ref={(el) => (exportRefs.current[i] = el)}
                style={{ width: 1080, height: 1350 }}
              >
                <ExportFrame slide={s} index={i} total={slides.length} bookTitle={book?.title} bookAuthor={book?.author} invert={invert} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ExportFrame({ slide, index, total, bookTitle, bookAuthor, invert }) {
  // Force the canvas to render exactly at 1080x1350 by overriding aspect-ratio.
  // Container queries inside SlideRenderer scale typography automatically.
  return (
    <div className="export-fixed">
      <SlideRenderer
        slide={slide}
        index={index}
        total={total}
        bookTitle={bookTitle}
        bookAuthor={bookAuthor}
        invert={invert}
      />
      <style>{`
        .export-fixed .slide-canvas {
          aspect-ratio: auto !important;
          width: 1080px !important;
          height: 1350px !important;
          border-radius: 36px !important;
        }
      `}</style>
    </div>
  );
}

function sanitize(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "carousel";
}
