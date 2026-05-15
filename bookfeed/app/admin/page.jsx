"use client";

import { useEffect, useState, useCallback } from "react";

export default function AdminPage() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [testPrompt, setTestPrompt] = useState(
    'Rispondi SOLO con questo JSON: {"ok":true,"msg":"ChatGPT funziona."}'
  );
  const [testResult, setTestResult] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/status");
      const data = await res.json();
      setStatus(data);
    } catch (e) {
      setStatus({ ok: false, configured: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Auto-refresh every 15s to detect login state change
    const t = setInterval(fetchStatus, 15000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  async function handleLoginStart() {
    setStarting(true);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await fetch("/api/ai/login-start", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setActionMsg("Browser aperto su ChatGPT. Accedi nel viewer VNC qui sotto, poi clicca "Salva sessione".");
    } catch (e) {
      setActionErr(e.message);
    } finally {
      setStarting(false);
    }
  }

  async function handleLoginSave() {
    setSaving(true);
    setActionErr("");
    setActionMsg("");
    try {
      const res = await fetch("/api/ai/login-save", { method: "POST" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setActionMsg("Sessione salvata. ChatGPT è ora disponibile come AI.");
      await fetchStatus();
    } catch (e) {
      setActionErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult("");
    setActionErr("");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setTestResult(data.response || "(risposta vuota)");
    } catch (e) {
      setTestResult("");
      setActionErr("Test fallito: " + e.message);
    } finally {
      setTesting(false);
    }
  }

  const isConnected = status?.ok && status?.configured;
  const isLoggedIn = isConnected && status?.loggedIn;
  const vncUrl = status?.vncViewerUrl;

  return (
    <div className="min-h-screen bg-paper text-ink py-10 px-5">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <a href="/" className="text-sm text-muted hover:text-ink">← Feed</a>
          <h1 className="font-serif text-3xl mt-3">Admin — ChatGPT</h1>
          <p className="text-sm text-muted mt-1">
            Configura e gestisci l'integrazione con ChatGPT come AI alternativa.
          </p>
        </div>

        {/* Status card */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Stato connessione</div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="btn btn-ghost px-2.5 py-1 text-xs"
            >
              {loading ? "…" : "Aggiorna"}
            </button>
          </div>

          {loading && !status && (
            <div className="text-sm text-muted">Verifica in corso…</div>
          )}

          {status && (
            <div className="space-y-2">
              {/* Configured */}
              <StatusRow
                label="Server Render"
                ok={status.configured}
                okText="Configurato"
                nokText="RENDER_URL non impostata"
              />
              {status.configured && (
                <StatusRow
                  label="Server raggiungibile"
                  ok={status.ok}
                  okText="Online"
                  nokText={status.error || "Offline"}
                />
              )}
              {status.ok && (
                <>
                  <StatusRow
                    label="Browser Playwright"
                    ok={status.ready}
                    okText="Pronto"
                    nokText="Non inizializzato"
                  />
                  <StatusRow
                    label="Sessione ChatGPT"
                    ok={status.loggedIn}
                    okText="Loggato"
                    nokText="Non loggato — segui le istruzioni sotto"
                  />
                  {typeof status.busy === "boolean" && (
                    <StatusRow
                      label="Generazione"
                      ok={!status.busy}
                      okText={`Libero${status.queue > 0 ? ` (${status.queue} in coda)` : ""}`}
                      nokText="Occupato"
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Setup instructions (shown when not configured) */}
        {status && !status.configured && (
          <div className="card p-5 space-y-3 border-amber-500/30">
            <div className="text-[11px] uppercase tracking-[0.22em] text-amber-400">Configurazione richiesta</div>
            <ol className="text-sm space-y-2 list-decimal list-inside text-muted leading-relaxed">
              <li>Crea un account su <a href="https://render.com" target="_blank" rel="noreferrer" className="underline text-ink">render.com</a> (piano Starter, ~$7/mese)</li>
              <li>Crea un nuovo servizio Web → <strong>Deploy da Git</strong> → punta alla cartella <code className="font-mono text-xs bg-line/30 px-1 rounded">server/</code></li>
              <li>Render genererà automaticamente un <code className="font-mono text-xs">API_TOKEN</code> — copialo</li>
              <li>In Vercel → <strong>Settings → Environment Variables</strong>, aggiungi:
                <ul className="mt-1 ml-4 space-y-0.5 text-xs font-mono">
                  <li>RENDER_URL = https://&lt;tuo-servizio&gt;.onrender.com</li>
                  <li>RENDER_API_TOKEN = &lt;token copiato&gt;</li>
                </ul>
              </li>
              <li>Rideploya su Vercel, poi torna qui</li>
            </ol>
          </div>
        )}

        {/* Login flow */}
        {isConnected && status?.ready && (
          <div className="card p-5 space-y-4">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted">
              {isLoggedIn ? "Sessione attiva" : "Login ChatGPT"}
            </div>

            {!isLoggedIn && (
              <p className="text-sm text-muted leading-relaxed">
                Il browser Playwright deve accedere a ChatGPT una volta sola.
                Apri il viewer VNC, completa il login e salva la sessione.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {!isLoggedIn && (
                <button
                  onClick={handleLoginStart}
                  disabled={starting}
                  className="btn btn-ghost px-3 py-1.5 text-sm"
                >
                  {starting ? "Apertura…" : "1. Apri pagina login"}
                </button>
              )}
              {vncUrl && (
                <a
                  href={vncUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost px-3 py-1.5 text-sm"
                >
                  {isLoggedIn ? "Apri viewer VNC" : "2. Apri viewer VNC ↗"}
                </a>
              )}
              {!isLoggedIn && (
                <button
                  onClick={handleLoginSave}
                  disabled={saving}
                  className="btn px-3 py-1.5 text-sm"
                >
                  {saving ? "Verifica…" : "3. Salva sessione"}
                </button>
              )}
              {isLoggedIn && (
                <button
                  onClick={handleLoginStart}
                  disabled={starting}
                  className="btn btn-ghost px-3 py-1.5 text-sm"
                >
                  {starting ? "…" : "Ri-accedi"}
                </button>
              )}
            </div>

            {actionMsg && (
              <div className="text-sm text-green-400 leading-snug">{actionMsg}</div>
            )}
            {actionErr && (
              <div className="text-sm text-red-400 break-words leading-snug">⚠ {actionErr}</div>
            )}
          </div>
        )}

        {/* Test generation */}
        {isLoggedIn && (
          <div className="card p-5 space-y-3">
            <div className="text-[11px] uppercase tracking-[0.22em] text-muted">Test generazione</div>
            <textarea
              className="input text-xs font-mono leading-relaxed resize-y"
              rows={4}
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
            />
            <button
              onClick={handleTest}
              disabled={testing || !testPrompt.trim()}
              className="btn px-4 py-1.5 text-sm"
            >
              {testing ? "Generazione in corso…" : "Invia a ChatGPT"}
            </button>
            {testResult && (
              <pre className="text-xs bg-line/20 rounded-xl p-4 overflow-auto max-h-60 whitespace-pre-wrap break-words leading-relaxed">
                {testResult}
              </pre>
            )}
          </div>
        )}

        {/* Mode note */}
        {isLoggedIn && (
          <div className="card p-4 text-sm text-muted leading-relaxed">
            <strong className="text-ink">Modalità ChatGPT</strong> è ora disponibile nelle{" "}
            <a href="/" className="underline">Impostazioni</a> dell'app: seleziona{" "}
            <em>ChatGPT</em> nella sezione "Modalità di analisi".
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, ok, okText, nokText }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted">{label}</span>
      <span className={ok ? "text-green-400" : "text-red-400"}>
        {ok ? `✓ ${okText}` : `✗ ${nokText}`}
      </span>
    </div>
  );
}
