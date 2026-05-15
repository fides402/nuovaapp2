import { NextResponse } from "next/server";

const RENDER_URL = (process.env.RENDER_URL || "").replace(/\/$/, "");

export async function GET() {
  if (!RENDER_URL) {
    return NextResponse.json({
      ok: false,
      configured: false,
      error: "RENDER_URL non configurata nelle variabili d'ambiente Vercel.",
    });
  }

  try {
    const res = await fetch(`${RENDER_URL}/status`, {
      // Server-side fetch — no browser timeout, but set a reasonable one
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return NextResponse.json({
      ok: res.ok,
      configured: true,
      vncViewerUrl: `${RENDER_URL}/viewer`,
      ...data,
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      configured: true,
      error: `Impossibile contattare il server Render: ${e.message}`,
    });
  }
}
