import { NextResponse } from "next/server";

const RENDER_URL = (process.env.RENDER_URL || "").replace(/\/$/, "");

export async function POST(request) {
  if (!RENDER_URL) {
    return NextResponse.json(
      { ok: false, error: "RENDER_URL non configurata nelle variabili d'ambiente Vercel." },
      { status: 503 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body JSON non valido." }, { status: 400 });
  }

  const { prompt } = body || {};
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "Campo 'prompt' mancante." }, { status: 400 });
  }

  try {
    const res = await fetch(`${RENDER_URL}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
      // ChatGPT can be slow — allow up to 150 seconds
      signal: AbortSignal.timeout(155000),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: data.error || `Server Render ha risposto con ${res.status}` },
        { status: res.status }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Errore comunicazione con Render: ${e.message}` },
      { status: 502 }
    );
  }
}
