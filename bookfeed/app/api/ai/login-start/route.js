import { NextResponse } from "next/server";

const RENDER_URL = (process.env.RENDER_URL || "").replace(/\/$/, "");

export async function POST() {
  if (!RENDER_URL) {
    return NextResponse.json({ ok: false, error: "RENDER_URL non configurata." }, { status: 503 });
  }
  try {
    const res = await fetch(`${RENDER_URL}/login/start`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 502 });
  }
}
