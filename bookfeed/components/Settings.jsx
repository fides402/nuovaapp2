"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, SettingsStore } from "../lib/storage";

export default function Settings({ open, onClose, onSaved }) {
  const [s, setS] = useState(DEFAULT_SETTINGS);
  const [reveal, setReveal] = useState(false);

  function setGroqKey(i, val) {
    const next = [...(s.groqApiKeys || [""])];
    while (next.length <= i) next.push("");
    next[i] = val.trim();
    update({ groqApiKeys: next });
  }

  useEffect(() => {
    if (open) setS(SettingsStore.load());
  }, [open]);

  if (!open) return null;

  function update(patch) { setS((v) => ({ ...v, ...patch })); }
  function setKey(i, val) {
    const next = [...(s.apiKeys || ["", ""])];
    while (next.length < 2) next.push("");
    next[i] = val.trim();
    update({ apiKeys: next });
  }
  function save() {
    SettingsStore.save(s);
    onSaved?.(s);
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-40 bg-paper/90 backdrop-blur-md overflow-y-auto rise">
      <div className="max-w-xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-2xl">Impostazioni</h2>
          <button onClick={onClose} className="btn btn-ghost px-3 py-1.5 text-sm">Chiudi</button>
        </div>

        <div className="card p-5 space-y-5">
          <div>
            <label className="label">Google AI API key · primaria</label>
            <input
              className="input font-mono text-[13px]"
              type={reveal ? "text" : "password"}
              value={s.apiKeys?.[0] || ""}
              onChange={(e) => setKey(0, e.target.value)}
              placeholder="AIza…"
            />
          </div>
          <div>
            <label className="label">Google AI API key · backup (opzionale)</label>
            <input
              className="input font-mono text-[13px]"
              type={reveal ? "text" : "password"}
              value={s.apiKeys?.[1] || ""}
              onChange={(e) => setKey(1, e.target.value)}
              placeholder="AIza…"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
            Mostra le chiavi
          </label>
          <p className="text-xs text-muted leading-relaxed">
            Chiavi Gemini — crea le tue su <a className="underline" href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">aistudio.google.com</a>.
            Salvate solo nel browser, non lasciano mai il dispositivo.
          </p>
        </div>

        <div className="hr" />

        <div>
          <div className="flex items-baseline justify-between mb-3">
            <label className="label mb-0">Groq API key · fallback automatico</label>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted">llama-3.3-70b</span>
          </div>
          <input
            className="input font-mono text-[13px]"
            type={reveal ? "text" : "password"}
            value={s.groqApiKeys?.[0] || ""}
            onChange={(e) => setGroqKey(0, e.target.value)}
            placeholder="gsk_…"
          />
          <p className="text-xs text-muted leading-relaxed mt-2">
            Se Gemini fallisce o va in timeout, la generazione continua automaticamente su Groq.
            Ottieni una chiave gratuita su <a className="underline" href="https://console.groq.com/keys" target="_blank" rel="noreferrer">console.groq.com</a>.
          </p>
        </div>

        <div className="card p-5 space-y-5 mt-4">
          <div>
            <label className="label">Modalità di analisi</label>
            <div className="grid grid-cols-2 gap-2">
              <Choice active={s.mode === "economy"} onClick={() => update({ mode: "economy" })} title="Economica" subtitle="gemini-2.5-flash · meno crediti" />
              <Choice active={s.mode === "deep"} onClick={() => update({ mode: "deep" })} title="Profonda" subtitle="gemini-2.5-pro · più qualità" />
            </div>
          </div>

          <div>
            <label className="label">Concetti da estrarre</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={3} max={12} value={s.conceptCount}
                onChange={(e) => update({ conceptCount: parseInt(e.target.value, 10) })}
                className="flex-1"
              />
              <span className="w-10 text-right font-mono">{s.conceptCount}</span>
            </div>
            <p className="text-xs text-muted mt-1">Più concetti = più caroselli da generare, più crediti.</p>
          </div>

          <div>
            <label className="label">Lingua dei caroselli</label>
            <select className="select" value={s.language} onChange={(e) => update({ language: e.target.value })}>
              <option value="it">Italiano</option>
              <option value="en">Inglese</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="btn btn-ghost">Annulla</button>
          <button onClick={save} className="btn">Salva</button>
        </div>
      </div>
    </div>
  );
}

function Choice({ active, onClick, title, subtitle }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border transition-colors ${active ? "border-ink bg-white/5" : "border-line"}`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-xs text-muted mt-0.5">{subtitle}</div>
    </button>
  );
}
