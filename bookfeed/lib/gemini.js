"use client";

// Gemini API wrapper using REST directly (no SDK = smaller bundle, no quirks).
// All calls are client-side; key is read from localStorage in the UI layer.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

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
      const transient = isAbort || /429|RATE|quota|exhaust|503|500/i.test(m);
      if (!transient) throw e; // auth errors, invalid key, etc. — fail immediately
      if (attempt < MAX_ATTEMPTS - 1) {
        const delay = Math.min(32000, 2000 * Math.pow(2, attempt)); // 2 s, 4 s, 8 s, 16 s
        await sleep(delay);
      }
    }
  }
  throw lastErr || new Error("Tutte le API key hanno fallito dopo più tentativi.");
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

export async function generateChapterCarousel({ keys, model, bookMeta, chapter, candidates, language = "it" }) {
  const lang = language === "it" ? "italiano" : "English";
  const system = `Sei un editor radicale che estrae conoscenza trasformativa dai libri per un feed personale.
Il tuo compito: trovare L'IDEA CHE SOLO QUESTO CAPITOLO CONTIENE — non un riassunto, non una generalità.

REGOLA D'ORO — test di specificità (obbligatorio): prima di scegliere un insight, chiediti
"questo si troverebbe in qualsiasi libro sull'argomento?" — se sì, scarta e scava ancora.

Cosa cercare (in ordine di priorità):
1. Tecniche specifiche con nome proprio introdotte dall'autore
2. Distinzioni non ovvie: "X non è Y, è Z"
3. Principi controintuitivi o sorprendenti
4. Regole operative precise: "fai sempre X", "evita Y perché Z"
5. Il framework concettuale originale del capitolo

Cosa evitare assolutamente:
- Ovvietà del genere ("bisogna praticare", "la melodia deve comunicare emozioni", "ascoltare è importante")
- Riassunti neutri ("in questo capitolo l'autore spiega…")
- Affermazioni che chiunque già conosce

Stile: minimal premium, frasi brevi, denso, niente emoji.
Lavora in ${lang} impeccabile.
Rispondi SEMPRE in JSON valido aderente allo schema richiesto.`;

  const numbered = (candidates || []).map((c, i) => `[${i + 1}] ${c.text}`).join("\n");

  const prompt = `Libro: "${bookMeta.title || "Senza titolo"}"${bookMeta.author ? " — " + bookMeta.author : ""}
Capitolo: "${chapter.title}"
${chapter.synthetic ? "(Sezione del libro senza titolo originale.)" : ""}

PASSAGGI SALIENTI DEL CAPITOLO (selezionati algoritmicamente):
${numbered || "(nessun candidato — usa il titolo del capitolo come spunto)"}

ISTRUZIONI (leggi prima di scrivere):
1. Analizza i passaggi come editor esperto. Cerca specificamente:
   - Qualsiasi tecnica o concetto a cui l'autore dà un nome preciso
   - Qualsiasi affermazione che contraddice l'intuizione comune
   - Qualsiasi regola operativa precisa con un meccanismo specifico
   - Il framework o la distinzione centrale che struttura questo capitolo
2. Scegli UN SOLO insight — il più specifico e meno prevedibile.
   Se il candidato ovvio è generico, scartalo e cerca il secondo livello.
3. Riformula quell'insight in modo tagliente: deve avere senso anche per chi non ha letto il libro.
4. Costruisci un carosello da ESATTAMENTE 10 slide su quell'unico insight, approfondendo sempre LO STESSO concetto.

STRUTTURA DELLE 10 SLIDE:
1. hook — promessa magnetica basata sull'insight specifico (non generica)
2. tension — il problema specifico che questo insight risolve
3. false_premise — l'errore di pensiero comune che il capitolo smonta
4. core — l'insight in 1 frase scolpita, la più precisa possibile
5. explanation — il meccanismo specifico: perché funziona così
6. example — scenario concreto in cui si applica questa idea esatta
7. implication — cosa cambia concretamente in chi lo adotta
8. mistake — la trappola specifica che l'autore avverte di evitare
9. synthesis — la frase memorabile da ricordare tra 6 mesi
10. question — domanda che provoca riflessione a partire dall'insight

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

LIMITI DI CARATTERI (obbligatori, violazioni = layout rotto):
- "title" di ogni slide: max 6 parole, senza punteggiatura finale.
- "body":
  · hook → max 130 caratteri
  · tension, false_premise, mistake → max 200 caratteri
  · core → max 100 caratteri, una sola frase
  · explanation, example, implication → max 220 caratteri
  · synthesis → max 90 caratteri, una sola frase
  · question → max 150 caratteri, deve finire con "?"
- "note": max 28 caratteri (parola chiave, numero, micro-citazione).
- Niente emoji, niente hashtag nelle slide, niente "in conclusione" / "in sintesi" come incipit.`;

  const data = await callWithRotation({ model, system, prompt, jsonMode: true, temperature: 0.75 }, keys);
  if (!Array.isArray(data?.slides) || data.slides.length !== 10) {
    throw new Error("Capitolo: serve esattamente 10 slide.");
  }
  return data;
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
