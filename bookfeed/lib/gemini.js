"use client";

// Gemini API wrapper using REST directly (no SDK = smaller bundle, no quirks).
// All calls are client-side; key is read from localStorage in the UI layer.
// Groq (llama-3.3-70b-versatile) is used as automatic fallback when Gemini fails.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
// Best Groq model for structured creative output — matches Gemini Flash quality
const GROQ_MODEL = "llama-3.3-70b-versatile";

export const MODELS = {
  economy: "gemini-2.5-flash",
  deep: "gemini-2.5-pro",
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

export async function generateChapterCarousel({ keys, groqKeys, model, bookMeta, chapter, candidates, language = "it" }) {
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

  // Try Gemini first; fall back to Groq if Gemini exhausts all retries
  let raw;
  const geminiKeys = (keys || []).filter(Boolean);
  const hasGroq = (groqKeys || []).some(Boolean);
  if (geminiKeys.length > 0) {
    try {
      raw = await callWithRotation({ model, system, prompt, jsonMode: true, temperature: 0.8 }, geminiKeys);
    } catch (geminiErr) {
      if (!hasGroq) throw geminiErr;
      console.info("Gemini failed — switching to Groq fallback:", geminiErr.message);
      raw = await callGroqWithRotation({ system, prompt, temperature: 0.8 }, groqKeys);
    }
  } else if (hasGroq) {
    // Only Groq keys configured
    raw = await callGroqWithRotation({ system, prompt, temperature: 0.8 }, groqKeys);
  } else {
    throw new Error("Aggiungi almeno una API key (Gemini o Groq) nelle Impostazioni.");
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
