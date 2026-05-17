"use client";

// Gemini API wrapper using REST directly (no SDK = smaller bundle, no quirks).
// All calls are client-side; key is read from localStorage in the UI layer.
// Groq (llama-3.3-70b-versatile) is used as automatic fallback when Gemini fails.
// ChatGPT (web automation via Render server) is an optional third provider.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
// Best Groq model for structured creative output — matches Gemini Flash quality
const GROQ_MODEL = "llama-3.3-70b-versatile";

export const MODELS = {
  economy: "gemini-2.5-flash",
  deep: "gemini-2.5-pro",
  chatgpt: "chatgpt", // routed through Render server
};

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function callGemini({ apiKey, model, system, prompt, jsonMode = true, temperature = 0.7 }) {
  if (!apiKey) throw new Error("API key Gemini mancante. Aprila nelle Impostazioni.");
  const url = `${ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    systemInstruction: system ? { role: "system", parts: [{ text: system }] } : undefined,
    generationConfig: {
      temperature,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: jsonMode ? "application/json" : "text/plain",
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };
  // 90s hard timeout so a hung request never blocks the batch forever
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 280)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  if (!text) throw new Error("Risposta Gemini vuota.");
  if (!jsonMode) return text;
  try { return JSON.parse(text); }
  catch (e) {
    // Try to salvage JSON inside fences
    const m = text.match(/\{[\s\S]*\}$/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new Error("JSON Gemini non valido: " + text.slice(0, 200));
  }
}

// Rotate through keys; on 429/5xx/timeout retry with exponential backoff.
// With 1 key: up to 5 attempts at 2 s → 4 s → 8 s → 16 s.
// With N keys: cycles through all keys on each attempt.
async function callWithRotation(options, keys) {
  const list = keys.filter(Boolean);
  if (list.length === 0) throw new Error("Aggiungi almeno una API key nelle Impostazioni.");
  const MAX_ATTEMPTS = 5;
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const key = list[attempt % list.length];
    try {
      return await callGemini({ ...options, apiKey: key });
    } catch (e) {
      lastErr = e;
      const m = String(e.message || "");
      const isAbort = e.name === "AbortError";
      // Retry on rate limits, server errors, network failures, and background-tab fetch aborts
      const transient = isAbort || /429|RATE|quota|exhaust|503|500|fetch|network|connect|failed/i.test(m);
      if (!transient) throw e; // auth errors, invalid key, etc. — fail immediately
      if (attempt < MAX_ATTEMPTS - 1) {
        const delay = Math.min(32000, 2000 * Math.pow(2, attempt)); // 2 s, 4 s, 8 s, 16 s
        await sleep(delay);
      }
    }
  }
  throw lastErr || new Error("Tutte le API key hanno fallito dopo più tentativi.");
}

// ── OpenRouter fallback ───────────────────────────────────────────────────────
// OpenAI-compatible API that aggregates many models. We try free models in
// quality order; each has independent daily limits so chaining them multiplies
// total free capacity without any cost.
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
// "openrouter/free" è il router automatico di OpenRouter: sceglie sempre
// il miglior modello gratuito disponibile al momento — non richiede aggiornamenti.
// I modelli a pagamento dopo sono economicissimi (~$0.05-0.10 per libro intero).
const OPENROUTER_FREE_MODELS = [
  "openrouter/free",                           // router automatico free (sempre aggiornato)
  "meta-llama/llama-3.3-70b-instruct:free",   // fallback esplicito Llama
  "google/gemma-3-27b-it:free",               // fallback esplicito Gemma
  "meta-llama/llama-3.1-8b-instruct",         // pagamento micro (~$0.01/libro) se free esauriti
];

async function callOpenRouter({ apiKey, system, prompt, temperature = 0.8, modelIndex = 0 }) {
  if (!apiKey) throw new Error("OpenRouter API key mancante.");
  const model = OPENROUTER_FREE_MODELS[modelIndex % OPENROUTER_FREE_MODELS.length];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  let res;
  try {
    res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://bookfeed-4suu.vercel.app",
        "X-Title": "BookFeed",
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: 8192,
        // NON forzare json_object: molti modelli free non lo supportano e restituiscono vuoto.
        // Il JSON viene estratto dal testo con regex nel parser sotto.
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenRouter[${model}] ${res.status}: ${t.slice(0, 280)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error(`Risposta OpenRouter[${model}] vuota.`);
  // Prova parse diretto, poi estrai da blocchi ```json...``` o primo { ... } nel testo
  try { return JSON.parse(text); } catch { /* not clean JSON */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch {} }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch {} }
  throw new Error(`JSON OpenRouter non valido: ${text.slice(0, 200)}`);
}

async function callOpenRouterWithRotation(options, keys) {
  const list = keys.filter(Boolean);
  if (!list.length) throw new Error("Nessuna OpenRouter API key configurata.");
  // Try each free model in order across all keys
  const totalAttempts = Math.min(OPENROUTER_FREE_MODELS.length * list.length, 8);
  let lastErr;
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const key = list[attempt % list.length];
    const modelIndex = Math.floor(attempt / list.length);
    try {
      return await callOpenRouter({ ...options, apiKey: key, modelIndex });
    } catch (e) {
      lastErr = e;
      const m = String(e.message || "");
      const isAbort = e.name === "AbortError";
      // 404 = model removed/renamed on OpenRouter → skip to next model immediately
      const is404 = /404|no endpoint|not found/i.test(m);
      const transient = isAbort || is404 || /429|RATE|quota|exhaust|503|502|500|fetch|network|connect|failed/i.test(m);
      if (!transient) throw e;
      // For 404 (model gone) don't wait — just move to next model immediately
      if (!is404 && attempt < totalAttempts - 1) {
        await sleep(Math.min(16000, 2000 * Math.pow(2, attempt % 3)));
      }
    }
  }
  throw lastErr || new Error("OpenRouter: tutti i modelli esauriti.");
}

// ── Groq fallback ─────────────────────────────────────────────────────────────
// Uses OpenAI-compatible chat completions API with llama-3.3-70b-versatile.
// Same prompt as Gemini — Llama 3.3 70B follows complex JSON instructions well.
async function callGroq({ apiKey, system, prompt, temperature = 0.8 }) {
  if (!apiKey) throw new Error("Groq API key mancante.");
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);
  let res;
  try {
    res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          ...(system ? [{ role: "system", content: system }] : []),
          { role: "user", content: prompt },
        ],
        temperature,
        max_tokens: 8192,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq ${res.status}: ${t.slice(0, 280)}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Risposta Groq vuota.");
  try { return JSON.parse(text); } catch {
    const m = text.match(/\{[\s\S]*\}$/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new Error("JSON Groq non valido: " + text.slice(0, 200));
  }
}

async function callGroqWithRotation(options, keys) {
  const list = keys.filter(Boolean);
  if (!list.length) throw new Error("Nessuna Groq API key configurata.");
  const MAX_ATTEMPTS = 4;
  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const key = list[attempt % list.length];
    try {
      return await callGroq({ ...options, apiKey: key });
    } catch (e) {
      lastErr = e;
      const m = String(e.message || "");
      const isAbort = e.name === "AbortError";
      const transient = isAbort || /429|RATE|quota|exhaust|503|500|fetch|network|connect|failed/i.test(m);
      if (!transient) throw e;
      if (attempt < MAX_ATTEMPTS - 1) {
        const delay = Math.min(32000, 3000 * Math.pow(2, attempt)); // 3 s, 6 s, 12 s
        await sleep(delay);
      }
    }
  }
  throw lastErr || new Error("Groq: tutti i tentativi esauriti.");
}

export async function selectConcepts({ keys, model, bookMeta, brief, candidates, targetCount = 6, language = "it" }) {
  const system = `Sei un editor di idee: tagliente, profondo, sintetico. Lavori in ${language === "it" ? "italiano" : "inglese"}.
Non riassumi: identifichi i concetti più potenti e poco banali di un libro.
Eviti luoghi comuni. Preferisci tesi, principi operativi, riformulazioni controintuitive, distinzioni nette.
Rispondi SEMPRE in JSON valido aderente allo schema richiesto.`;

  const numbered = candidates.map((c, i) => `[${i + 1}|sec ${c.section}] ${c.text}`).join("\n");
  const prompt = `Libro: "${bookMeta.title || "Senza titolo"}"${bookMeta.author ? " — " + bookMeta.author : ""}
Termini ricorrenti: ${brief.topTerms.join(", ")}
Espressioni ricorrenti: ${brief.topBigrams.join(", ")}

Ho selezionato algoritmicamente passaggi candidati (ordinati per sezione). Scegli i ${targetCount} concetti più potenti, non sovrapposti, che danno una visione d'insieme del libro. Devono essere idee, non frasi: riformulale tu in modo netto.

CANDIDATI:
${numbered}

Rispondi SOLO con questo JSON:
{
  "concepts": [
    {
      "title": "titolo del concetto, max 7 parole, tagliente",
      "thesis": "1 frase: cosa afferma esattamente, in modo che resti in mente",
      "why_it_matters": "1 frase: perché è non banale, cosa cambia se lo capisci",
      "evidence_idx": [numeri dei candidati che supportano questo concetto],
      "section_pct": numero 0-100 indicante dove appare nel libro,
      "depth": 1-5
    }
  ]
}
Non includere altro. Niente commenti.`;

  const data = await callWithRotation({ model, system, prompt, jsonMode: true, temperature: 0.5 }, keys);
  if (!Array.isArray(data?.concepts)) throw new Error("Concept selection: JSON inatteso.");
  // Attach evidence text for the next step
  for (const c of data.concepts) {
    c.evidence = (c.evidence_idx || []).map((n) => candidates[n - 1]?.text).filter(Boolean);
  }
  return data.concepts;
}

// ── ChatGPT (Render server) ────────────────────────────────────────────────────
// Sends the combined system+user prompt to /api/ai/generate (Next.js proxy)
// and parses JSON from ChatGPT's response (which may be in a markdown code block).

async function callChatGPT({ system, prompt }) {
  const combined = `${system}\n\n---\n\n${prompt}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 160000);
  let res;
  try {
    res = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: combined }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ChatGPT proxy ${res.status}: ${t.slice(0, 280)}`);
  }
  const data = await res.json();
  if (!data.ok) throw new Error(`ChatGPT: ${data.error || "risposta non valida."}`);
  const text = data.response || "";
  if (!text) throw new Error("Risposta ChatGPT vuota.");
  // Parse JSON — may be wrapped in ```json ... ```
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = jsonMatch ? jsonMatch[1].trim() : text.trim();
  try {
    return JSON.parse(raw);
  } catch {
    // Last resort: find the outermost {...}
    const objMatch = raw.match(/\{[\s\S]*\}/);
    if (objMatch) {
      try { return JSON.parse(objMatch[0]); } catch {}
    }
    throw new Error("JSON ChatGPT non valido: " + raw.slice(0, 200));
  }
}

export async function generateChapterCarousel({ keys, groqKeys, openRouterKeys, model, bookMeta, chapter, candidates, language = "it" }) {
  const lang = language === "it" ? "italiano" : "English";

  const system = `Sei il ghostwriter di un creator Instagram da 500k follower nel settore della conoscenza trasformativa.
Il tuo standard: ogni carosello che pubblichi fa pensare "non avevo mai visto questa cosa da quest'angolo."

REGOLA 1 — SPECIFICITÀ: l'insight deve essere esclusivo di questo libro/capitolo.
Se si troverebbe in qualsiasi libro sull'argomento, è sbagliato. Cerca quello sotto.
Priorità: tecniche con nome proprio, distinzioni "X non è Y ma Z", principi controintuitivi, regole operative precise.

REGOLA 2 — STILE: frasi da 3-12 parole. Verbi forti. Niente accademia.
Vietato: "pertanto", "al fine di", "in quanto", "considerando che", "in questo capitolo".
Permesso: affermazioni nette, pause drammatiche, il paradosso detto in piano.

REGOLA 3 — IMPATTO: ogni slide deve poter essere screenshottata da sola.
La hook ferma lo scroll. La synthesis fa dire "lo salvo". La question resta in testa per ore.

Niente emoji. Niente hashtag nelle slide. Lavori in ${lang} impeccabile.
Rispondi SEMPRE in JSON valido aderente allo schema.`;

  const numbered = (candidates || []).map((c, i) => `[${i + 1}] ${c.text}`).join("\n");

  const prompt = `Libro: "${bookMeta.title || "Senza titolo"}"${bookMeta.author ? " — " + bookMeta.author : ""}
Capitolo: "${chapter.title}"
${chapter.synthetic ? "(Sezione senza titolo originale.)" : ""}

PASSAGGI SALIENTI:
${numbered || "(nessun candidato — parti dal titolo del capitolo)"}

Trova L'INSIGHT più specifico e sorprendente di questo capitolo.
Se il primo che ti viene in mente è ovvio (es. "bisogna praticare", "ascoltare aiuta", "la struttura conta"), scarta e cerca quello sottostante.

Costruisci ESATTAMENTE 10 slide che sviluppano una narrativa su quell'unico insight:

1. hook — ferma lo scroll. Una frase contropiedista, provocatoria o sorprendente. Non iniziare con "Scopri" o "Impara".
2. tension — il problema specifico che il 90% delle persone ha e non sa nominare.
3. false_premise — la credenza sbagliata da smontare. Netta. Senza ammortizzatori.
4. core — l'insight in UNA frase scolpita. Come un'equazione. Max 15 parole.
5. explanation — il meccanismo: perché funziona esattamente così. Piano, diretto.
6. example — scenario iper-specifico dove vedi l'idea in azione. Concreto al massimo.
7. implication — cosa cambia concretamente in chi capisce questo. Diretto.
8. mistake — nomina la trappola precisa. Quella che tutti fanno senza saperlo.
9. synthesis — LA frase del carosello. Quella che fa dire "lo salvo". Max 12 parole.
10. question — una domanda che resta in testa. Apre, non chiude. Cambia come guardi qualcosa.

OUTPUT JSON ESATTO:
{
  "insight": {
    "title": "titolo dell'insight, max 7 parole, tagliente",
    "thesis": "1 frase: cosa afferma esattamente"
  },
  "title": "titolo del carosello",
  "concept": "1 frase: il cuore dell'idea",
  "tags": ["3-5 tag minuscoli"],
  "depth": 1-5,
  "quality": 1-5,
  "caption": "didascalia 2-4 frasi evocative",
  "slides": [
    {"role": "hook", "title": "...", "body": "...", "note": ""},
    {"role": "tension", "title": "...", "body": "...", "note": ""},
    {"role": "false_premise", "title": "...", "body": "...", "note": ""},
    {"role": "core", "title": "...", "body": "...", "note": ""},
    {"role": "explanation", "title": "...", "body": "...", "note": ""},
    {"role": "example", "title": "...", "body": "...", "note": ""},
    {"role": "implication", "title": "...", "body": "...", "note": ""},
    {"role": "mistake", "title": "...", "body": "...", "note": ""},
    {"role": "synthesis", "title": "...", "body": "...", "note": ""},
    {"role": "question", "title": "...", "body": "...", "note": ""}
  ]
}

LIMITI DI CARATTERI (obbligatori — violazioni rompono il layout):
- "title" di ogni slide: max 6 parole, senza punteggiatura finale.
- "body":
  · hook → max 130 caratteri
  · tension, false_premise, mistake → max 200 caratteri
  · core → max 100 caratteri, una sola frase
  · explanation, example, implication → max 220 caratteri
  · synthesis → max 90 caratteri, una sola frase
  · question → max 150 caratteri, deve finire con "?"
- "note": max 28 caratteri (parola chiave, numero, micro-citazione).
- Niente emoji, niente hashtag nelle slide.`;

  // Route to the right AI provider
  let raw;
  const geminiKeys = (keys || []).filter(Boolean);
  const hasGroq = (groqKeys || []).some(Boolean);
  const hasOpenRouter = (openRouterKeys || []).some(Boolean);

  if (model === "chatgpt") {
    raw = await callChatGPT({ system, prompt });
  } else if (geminiKeys.length > 0) {
    try {
      raw = await callWithRotation({ model, system, prompt, jsonMode: true, temperature: 0.8 }, geminiKeys);
    } catch (geminiErr) {
      // Cascade: Gemini → Groq → OpenRouter
      if (hasGroq) {
        try {
          console.info("Gemini failed — trying Groq:", geminiErr.message);
          raw = await callGroqWithRotation({ system, prompt, temperature: 0.8 }, groqKeys);
        } catch (groqErr) {
          if (!hasOpenRouter) throw groqErr;
          console.info("Groq failed — trying OpenRouter:", groqErr.message);
          raw = await callOpenRouterWithRotation({ system, prompt, temperature: 0.8 }, openRouterKeys);
        }
      } else if (hasOpenRouter) {
        console.info("Gemini failed — trying OpenRouter:", geminiErr.message);
        raw = await callOpenRouterWithRotation({ system, prompt, temperature: 0.8 }, openRouterKeys);
      } else {
        throw geminiErr;
      }
    }
  } else if (hasGroq) {
    try {
      raw = await callGroqWithRotation({ system, prompt, temperature: 0.8 }, groqKeys);
    } catch (groqErr) {
      if (!hasOpenRouter) throw groqErr;
      console.info("Groq failed — trying OpenRouter:", groqErr.message);
      raw = await callOpenRouterWithRotation({ system, prompt, temperature: 0.8 }, openRouterKeys);
    }
  } else if (hasOpenRouter) {
    raw = await callOpenRouterWithRotation({ system, prompt, temperature: 0.8 }, openRouterKeys);
  } else {
    throw new Error("Aggiungi almeno una API key nelle Impostazioni (Gemini, Groq o OpenRouter).");
  }

  // Accept 6–13 slides: strict !== 10 caused silent failures when Gemini/Groq returned 9 or 11
  const slides = Array.isArray(raw?.slides) ? raw.slides :
                 Array.isArray(raw) ? raw : null;
  if (!slides || slides.length < 6) {
    throw new Error(`JSON non valido (${slides?.length ?? 0} slide ricevute, min 6).`);
  }
  if (!raw?.slides) raw.slides = slides;
  return raw;
}

export async function generateCarousel({ keys, model, bookMeta, concept, language = "it" }) {
  const system = `Sei un autore di caroselli social per un feed personale di conoscenza.
Stile: minimal premium, asciutto, denso, mai didascalico. Niente emoji. Niente clickbait infantile.
Frasi brevi. Italiano impeccabile. Mai numerare le slide nei titoli.
Pensa a ogni slide come a una pagina di un quaderno elegante: poca grafica, molto pensiero.
Rispondi SEMPRE in JSON valido aderente allo schema.`;

  const evidence = (concept.evidence || []).slice(0, 6).map((e, i) => `• ${e}`).join("\n");
  const prompt = `Libro: "${bookMeta.title}"${bookMeta.author ? " — " + bookMeta.author : ""}
Concetto: ${concept.title}
Tesi: ${concept.thesis}
Perché conta: ${concept.why_it_matters || ""}

Passaggi di riferimento dal libro (usali come spunto, non copiarli letteralmente):
${evidence || "(nessuno)"}

Crea un carosello di ESATTAMENTE 10 slide secondo questa struttura:
1. Hook forte — promessa o frase magnetica, max 12 parole
2. Problema o tensione iniziale — perché senza questo concetto si sbaglia
3. Falso presupposto — l'errore di pensiero da smontare
4. Concetto centrale — l'idea pulita, in 1 frase memorabile
5. Spiegazione semplice — perché funziona, in linguaggio piano
6. Esempio concreto — uno scenario reale o quotidiano
7. Implicazione profonda — cosa cambia in chi lo capisce davvero
8. Errore comune — la trappola classica da evitare
9. Sintesi memorabile — la frase da tatuarsi
10. Domanda finale o insight conclusivo — apre, non chiude

OUTPUT JSON:
{
  "title": "titolo del carosello (può coincidere con il concetto)",
  "concept": "1 frase: il cuore",
  "tags": ["3-5 tag tematici, minuscoli, parole singole o brevi"],
  "depth": 1-5,
  "quality": 1-5,
  "caption": "didascalia stile social, 2-4 frasi, evocativa ma non vaga",
  "slides": [
    {"role": "hook", "title": "...", "body": "...", "note": "eventuale accento visivo: numero, citazione, parola chiave"},
    {"role": "tension", "title": "...", "body": "...", "note": "..."},
    {"role": "false_premise", "title": "...", "body": "...", "note": "..."},
    {"role": "core", "title": "...", "body": "...", "note": "..."},
    {"role": "explanation", "title": "...", "body": "...", "note": "..."},
    {"role": "example", "title": "...", "body": "...", "note": "..."},
    {"role": "implication", "title": "...", "body": "...", "note": "..."},
    {"role": "mistake", "title": "...", "body": "...", "note": "..."},
    {"role": "synthesis", "title": "...", "body": "...", "note": "..."},
    {"role": "question", "title": "...", "body": "...", "note": "..."}
  ]
}

Regole rigide di forma (rispettarle è obbligatorio, le violazioni rovinano il layout):
- "title": max 6 parole. Niente punteggiatura finale.
- "body" per ruolo (rispetta i CARATTERI, non parole):
  · hook → max 130 caratteri
  · tension, false_premise, mistake → max 200 caratteri
  · core → max 100 caratteri, una sola frase memorabile
  · explanation, example, implication → max 220 caratteri
  · synthesis → max 90 caratteri, una sola frase scolpita
  · question → max 150 caratteri, deve finire con "?"
- "note": opzionale, max 28 caratteri (una parola chiave, un numero, una micro-citazione).
- Frasi brevi. Niente "in conclusione", "in sintesi", "quindi" come incipit.
- Niente emoji. Niente hashtag dentro le slide (solo dentro "tags").
Lingua: ${language === "it" ? "italiano" : "inglese"}.`;

  const data = await callWithRotation({ model, system, prompt, jsonMode: true, temperature: 0.8 }, keys);
  if (!Array.isArray(data?.slides) || data.slides.length !== 10) {
    throw new Error("Carosello: serve esattamente 10 slide.");
  }
  return data;
}

// ── Book recommendations ───────────────────────────────────────────────────────
// Analizza i caroselli con like e suggerisce libri che approfondiscono quei temi.
// books: mappa { id → { title, author } } per arricchire i caroselli col libro di origine.
export async function generateBookRecommendations({ likedCarousels, books = {}, keys, groqKeys, openRouterKeys, language = "it" }) {
  if (!likedCarousels || likedCarousels.length === 0) {
    throw new Error("Nessun carosello preferito. Metti ♥ ad alcuni caroselli prima.");
  }

  // Costruisce un riassunto ricco: libro di origine + concetto + testo reale delle slide chiave
  const summary = likedCarousels.slice(0, 16).map((c, i) => {
    const srcBook = books[c.bookId];
    const srcLine = srcBook ? `Estratto da: "${srcBook.title}"${srcBook.author ? ` di ${srcBook.author}` : ""}` : "";
    // Prendi il corpo delle slide più significative (hook, core, synthesis)
    const keySlides = (c.slides || [])
      .filter((s) => ["hook", "core", "synthesis", "explanation", "tension"].includes(s.role))
      .slice(0, 4)
      .map((s) => `    • [${s.role}] ${s.title ? s.title + ": " : ""}${s.body || ""}`)
      .join("\n");
    return [
      `--- Carosello ${i + 1} ---`,
      srcLine,
      `Titolo: "${c.title}"`,
      c.concept ? `Concetto: ${c.concept}` : "",
      c.tags?.length ? `Tag: ${c.tags.join(", ")}` : "",
      keySlides ? `Contenuto slide:\n${keySlides}` : "",
    ].filter(Boolean).join("\n");
  }).join("\n\n");

  // Estrai i libri già letti per non consigliarli
  const alreadyRead = [...new Set(
    Object.values(books).map((b) => `"${b.title}" di ${b.author}`).filter(Boolean)
  )].join(", ");

  const lang = language === "it" ? "italiano" : "inglese";
  const system = `Sei un bibliotecario specializzato, preciso e curioso. Il tuo compito è consigliare libri SPECIFICI e PERTINENTI basandoti sul contenuto testuale esatto dei caroselli che l'utente ha apprezzato — non sui temi generali. Evita libri famosi e generici se non sono direttamente legati agli argomenti precisi. Privilegia libri di nicchia, accademici, pratici o poco noti ma altamente pertinenti. Rispondi SOLO con JSON valido, nessun testo fuori dal JSON.`;

  const prompt = `L'utente ha messo "mi piace" a questi caroselli. Leggi attentamente il contenuto testuale delle slide per capire gli argomenti PRECISI che lo interessano:

${summary}

${alreadyRead ? `Libri già letti dall'utente (NON consigliare questi): ${alreadyRead}` : ""}

Basandoti sugli argomenti SPECIFICI nel testo delle slide (non sui tag generici), consiglia 8 libri.
REGOLE IMPORTANTI:
- Consiglia libri strettamente legati agli argomenti precisi nel testo, non ai temi generali
- Preferisci libri specifici, accademici o di nicchia rispetto a bestseller generici
- Ogni libro deve essere giustificato citando un argomento specifico trovato nelle slide
- NON consigliare: Sapiens, Il Signore degli Anelli, L'Alchimista, Atomic Habits e simili a meno che non siano davvero pertinenti al contenuto preciso

Rispondi in ${lang} con questo JSON esatto:
{
  "recommendations": [
    {
      "title": "Titolo del libro",
      "author": "Nome Cognome autore",
      "reason": "Spiega il collegamento preciso con un argomento specifico trovato nel testo delle slide.",
      "topics": ["topic specifico 1", "topic specifico 2"]
    }
  ]
}

REGOLA SUL TITOLO: se l'autore non è italiano, usa il titolo in inglese (titolo originale inglese o traduzione inglese). Se l'autore è italiano, usa il titolo italiano.`;

  const geminiKeys = (keys || []).filter(Boolean);
  const hasGroq = (groqKeys || []).some(Boolean);
  const hasOpenRouter = (openRouterKeys || []).some(Boolean);

  let raw;
  if (geminiKeys.length > 0) {
    try {
      raw = await callWithRotation({ model: "gemini-2.5-flash", system, prompt, jsonMode: true, temperature: 0.9 }, geminiKeys);
    } catch (_geminiErr) {
      if (hasGroq) {
        try { raw = await callGroqWithRotation({ system, prompt, temperature: 0.9 }, groqKeys); }
        catch (_groqErr) {
          if (hasOpenRouter) raw = await callOpenRouterWithRotation({ system, prompt, temperature: 0.9 }, openRouterKeys);
          else throw _groqErr;
        }
      } else if (hasOpenRouter) {
        raw = await callOpenRouterWithRotation({ system, prompt, temperature: 0.9 }, openRouterKeys);
      } else {
        throw _geminiErr;
      }
    }
  } else if (hasGroq) {
    try { raw = await callGroqWithRotation({ system, prompt, temperature: 0.9 }, groqKeys); }
    catch (_groqErr) {
      if (hasOpenRouter) raw = await callOpenRouterWithRotation({ system, prompt, temperature: 0.9 }, openRouterKeys);
      else throw _groqErr;
    }
  } else if (hasOpenRouter) {
    raw = await callOpenRouterWithRotation({ system, prompt, temperature: 0.9 }, openRouterKeys);
  } else {
    throw new Error("Nessuna API key configurata. Aggiungila nelle Impostazioni.");
  }

  if (!Array.isArray(raw?.recommendations) || raw.recommendations.length === 0) {
    throw new Error("Formato risposta non valido. Riprova.");
  }
  return raw.recommendations;
}
