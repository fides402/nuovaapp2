# BookFeed

Tool personale che trasforma un libro (PDF o EPUB) in un feed privato di caroselli social da 10 slide, basati sui concetti più potenti del libro. Tutto gira nel browser; le API key Google AI restano salvate solo in locale.

## Idea

> Carico un libro → il sistema lo scandaglia in locale → premo "Genera" → ottengo caroselli pronti da leggere e salvare.

Non è un riassuntore: è un **Book Concept Miner + Social Carousel Generator** personale.

## Pipeline

1. Upload PDF/EPUB (client-side, niente upload server)
2. Estrazione testo (pdf.js / unzip + DOMParser per EPUB)
3. Chunking + ranking locale dei passaggi (TF/IDF, pattern definitori, marker argomentativi, ricorrenza)
4. **Solo al click su "Genera"**: i candidati top vengono inviati a Gemini
5. Gemini sceglie i concetti globali → poi genera un carosello da 10 slide per ognuno
6. Le slide vengono **assemblate in codice** con template minimal (no AI per la grafica)
7. Tutto salvato in IndexedDB del browser

## Risparmio crediti

- Il libro intero **non viene mai** inviato all'AI
- L'AI riceve solo ~70 candidati pre-selezionati + un breve riassunto di termini frequenti
- 1 chiamata per scegliere i concetti + 1 chiamata per ogni carosello
- Modalità **economica** (`gemini-2.5-flash`) o **profonda** (`gemini-2.5-pro`)
- Risultati cachati per non rigenerare nulla a vuoto

## Setup locale

```bash
cd bookfeed
npm install
npm run dev
```

Apri http://localhost:3000, vai in **Impostazioni** e incolla la tua API key Gemini.

## Deploy su Vercel

1. Pusha il repo su GitHub (privato).
2. Su Vercel → New Project → importa il repo.
3. **Root Directory**: `bookfeed`
4. Framework preset: Next.js (auto).
5. Deploy.

Nessuna variabile d'ambiente è richiesta lato server: le chiavi vengono inserite nelle Impostazioni del browser e restano lì.

## Carosello — struttura

Ogni carosello ha 10 slide nei seguenti ruoli:

1. Hook
2. Tensione
3. Falso presupposto
4. Concetto centrale
5. Spiegazione
6. Esempio concreto
7. Implicazione profonda
8. Errore comune
9. Sintesi memorabile
10. Domanda finale

## Grafica

- Sfondo nero su tutta l'app; slide nere (con toggle "inverti" per esportazione chiara)
- Tipografia: **Fraunces** (serif) + **Inter** (sans) + **JetBrains Mono** (mono)
- 6 layout di slide alternati per varietà coerente
- Export: PNG singolo, ZIP di PNG, PDF intero

## Privacy

- Il libro è in IndexedDB, non lascia mai il browser
- Le API key sono in localStorage, non vengono mai loggate
- Nessun server side: niente endpoint custom, niente database remoto

## Stack

- Next.js 14 (App Router) + React 18
- Tailwind CSS
- pdfjs-dist · jszip · idb-keyval · html2canvas · jspdf
- Gemini API via REST diretta
