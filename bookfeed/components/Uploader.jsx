"use client";

import { useRef, useState } from "react";

export default function Uploader({ onFile, busy }) {
  const fileRef = useRef(null);
  const [drag, setDrag] = useState(false);

  function pick() { fileRef.current?.click(); }

  function onDrop(e) {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={`card p-7 sm:p-10 text-center transition-colors ${drag ? "border-ink" : ""}`}
    >
      <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Step 1</div>
      <h3 className="font-serif text-2xl sm:text-3xl mt-2">Carica un libro</h3>
      <p className="text-muted mt-2 max-w-[40ch] mx-auto">
        PDF o EPUB. Tutto resta sul tuo dispositivo: l'analisi parte solo quando lo chiedi tu.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row gap-3 items-center justify-center">
        <button onClick={pick} disabled={busy} className="btn">
          {busy ? "Sto leggendo…" : "Scegli file"}
        </button>
        <span className="text-xs text-muted">o trascina qui</span>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.epub,application/pdf,application/epub+zip"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
      />
    </div>
  );
}
