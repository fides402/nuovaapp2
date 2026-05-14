"use client";

// Gemini API wrapper using REST directly (no SDK = smaller bundle, no quirks).
// All calls are client-side; key is read from localStorage in the UI layer.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const MODELS = {
  economy: "gemini-2.5-flash",
  deep: "gemini-2.5-pro",
};

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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

// Rotate through multiple keys; on 429/RATE_LIMIT advance.
async function callWithRotation(options, keys) {
  const list = keys.filter(Boolean);
  if (list.length === 0) throw new Error("Aggiungi almeno una API key nelle Impostazioni.");
  let lastErr;
  for (let i = 0; i < list.length; i++) {
    try {
      return await callGemini({ ...options, apiKey: list[i] });
    } catch (e) {
      lastErr = e;
      const m = String(e.message || "");
      const transient = /429|RATE|quota|exhaust|503|500/i.test(m);
      if (!transient) throw e;
    }
  }
  throw lastErr || new Error("Tutte le API key hanno fallito.");
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

Regole:
- "title" di ogni slide max 7 parole, tagliente.
- "body" max 280 caratteri, frasi brevi, niente "in conclusione".
- "note" può essere vuota; usala per un numero, una parola chiave, una micro-citazione.
- Niente emoji. Niente hashtag dentro le slide (solo i tag).
Lingua: ${language === "it" ? "italiano" : "inglese"}.`;

  const data = await callWithRotation({ model, system, prompt, jsonMode: true, temperature: 0.8 }, keys);
  if (!Array.isArray(data?.slides) || data.slides.length !== 10) {
    throw new Error("Carosello: serve esattamente 10 slide.");
  }
  return data;
}
