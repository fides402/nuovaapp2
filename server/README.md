# BookFeed — ChatGPT Server

Server Node.js che automatizza ChatGPT (chatgpt.com) via Playwright all'interno di un browser Chromium reale. Espone una REST API che la webapp BookFeed (su Vercel) usa come AI alternativa a Gemini/Groq.

## Come funziona

```
BookFeed (Vercel)
  └─ /api/ai/generate  ──►  Render Server (questo repo)
                                 └─ Playwright ──►  chatgpt.com
                                 └─ noVNC (viewer VNC)
```

Il server gira su Render.com con:
- **Xvfb** — display virtuale
- **x11vnc** — VNC server sul display virtuale
- **Playwright Chromium** — browser reale che naviga su chatgpt.com
- **noVNC (ws bridge)** — viewer VNC nel browser per il login manuale

---

## Deploy su Render (una volta sola)

### 1. Crea l'account Render

Vai su [render.com](https://render.com) → registrati → piano **Starter** ($7/mese).
*(Necessario per il disco persistente che salva la sessione ChatGPT)*

### 2. Crea il servizio

1. **New → Web Service**
2. Connetti il repository GitHub (contiene la cartella `server/`)
3. Imposta:
   - **Root Directory**: `server`
   - **Runtime**: `Docker`
   - **Instance Type**: Starter
4. Aggiungi le variabili d'ambiente:
   | Chiave | Valore |
   |---|---|
   | `PORT` | `10000` |
   | `PROFILE_DIR` | `/data/chrome-profile` |
   | `API_TOKEN` | *(genera uno random, es. con `openssl rand -hex 32`)* |
5. Aggiungi il disco persistente:
   - **Name**: `chrome-data`
   - **Mount Path**: `/data`
   - **Size**: 2 GB
6. **Deploy**

Il primo deploy richiede ~10 minuti (scarica Chromium e le sue dipendenze).

### 3. Copia URL e token

Dopo il deploy, copia:
- **URL del servizio**: `https://bookfeed-gpt-xxxx.onrender.com`
- **API_TOKEN**: il valore che hai impostato

### 4. Configura Vercel

Nella dashboard Vercel del progetto BookFeed:
**Settings → Environment Variables** → aggiungi:

| Chiave | Valore |
|---|---|
| `RENDER_URL` | `https://bookfeed-gpt-xxxx.onrender.com` |
| `RENDER_API_TOKEN` | il tuo token |

Poi **Redeploy** il progetto Vercel.

---

## Login ChatGPT (una volta sola per sessione)

Dopo il deploy:

1. Vai su `https://tuoapp.vercel.app/admin`
2. Verifica che il server risulti **Online**
3. Clicca **"1. Apri pagina login"** — il browser Playwright navigherà su chatgpt.com
4. Clicca **"2. Apri viewer VNC ↗"** — si apre una nuova tab con la visualizzazione del browser
5. Accedi a ChatGPT normalmente nel viewer (email + password o Google)
6. Torna all'admin e clicca **"3. Salva sessione"**

La sessione è persistita nel profilo Chromium su disco. Rimane valida finché ChatGPT non forza il logout (in genere settimane/mesi).

---

## Utilizzo come AI

Nelle **Impostazioni** della webapp BookFeed:
- Modalità di analisi → **ChatGPT**

Da questo momento, i caroselli vengono generati tramite ChatGPT (senza consumare crediti Gemini/Groq).

**Nota**: La generazione ChatGPT è sequenziale (un capitolo alla volta, ~30-60s ciascuno) e dipende dalla velocità della rete e del modello ChatGPT scelto. GPT-4o dà risultati nettamente migliori di GPT-3.5.

---

## Endpoint API

Tutti gli endpoint richiedono l'header `X-Api-Token: <token>`.

| Metodo | Path | Descrizione |
|---|---|---|
| `GET` | `/status` | Stato server (browser, login, coda) |
| `POST` | `/login/start` | Naviga alla pagina login ChatGPT |
| `POST` | `/login/save` | Verifica e conferma la sessione |
| `POST` | `/generate` | Invia prompt a ChatGPT, restituisce testo risposta |
| `GET` | `/viewer` | Viewer noVNC (no auth richiesta) |

---

## Sviluppo locale

```bash
cd server
npm install
npm run install:browsers   # installa Chromium (una volta sola)
cp .env.example .env       # imposta API_TOKEN=test
node index.js
```

Nota: in locale non c'è Xvfb — il browser si apre normalmente sul tuo desktop.
Per testare senza display, imposta `DISPLAY=:0` o usa un Xvfb locale.
