"use client";

import { forwardRef } from "react";

// Minimal, premium slide templates assembled in code (not AI-generated).
// Hard rule: nothing must ever overflow the canvas. Each layout has fixed
// vertical zones (header/main/footer) and the main zone clips its content.
// Headlines use dynamic font scaling based on text length.

const ROLE_LAYOUTS = {
  hook: "hero",
  tension: "split",
  false_premise: "stamp",
  core: "centered",
  explanation: "label",
  example: "quote",
  implication: "split",
  mistake: "stamp",
  synthesis: "centered",
  question: "hero",
};

const ROLE_KICKER = {
  hook: "01 · gancio",
  tension: "02 · tensione",
  false_premise: "03 · falso presupposto",
  core: "04 · concetto",
  explanation: "05 · spiegazione",
  example: "06 · esempio",
  implication: "07 · implicazione",
  mistake: "08 · errore",
  synthesis: "09 · sintesi",
  question: "10 · domanda",
};

// Per-role hard caps for body (defensive — the AI is told the limits, this is fallback).
const MAX_BODY = {
  hook: 140,
  tension: 220,
  false_premise: 220,
  core: 110,
  explanation: 230,
  example: 230,
  implication: 230,
  mistake: 220,
  synthesis: 100,
  question: 160,
};
const MAX_TITLE = 60;

function clamp(s, max) {
  if (!s) return "";
  const t = String(s).trim();
  if (t.length <= max) return t;
  // Soft cut at word boundary
  const cut = t.slice(0, max).replace(/[\s,;:.\-—]+\S*$/, "");
  return (cut || t.slice(0, max - 1)) + "…";
}

// Headline font scale (in container-query units) based on character count.
// Tuned so that a typical mobile canvas (~480px tall) yields >=18px body
// and >=22px headlines — comfortably readable without zoom.
function headlineScale(len, big) {
  const base = big ? 1.12 : 1.0;
  if (len <= 28) return 9.0 * base;
  if (len <= 50) return 7.0 * base;
  if (len <= 80) return 5.5 * base;
  if (len <= 120) return 4.5 * base;
  if (len <= 180) return 3.7 * base;
  return 3.2 * base;
}

// Body font scale — never goes below ~16px on a 480px-tall canvas.
function bodyScale(len) {
  if (len <= 100) return 4.2;
  if (len <= 160) return 3.8;
  if (len <= 220) return 3.4;
  return 3.1;
}

const SlideRenderer = forwardRef(function SlideRenderer(
  { slide, index, total = 10, bookTitle = "", bookAuthor = "", invert = false, accentSlide = false },
  ref
) {
  const role = slide.role || "core";
  const layout = ROLE_LAYOUTS[role] || "centered";
  const kicker = ROLE_KICKER[role] || `${String(index + 1).padStart(2, "0")} · slide`;
  const isAccent = accentSlide || role === "core" || role === "synthesis";

  const title = clamp(slide.title, MAX_TITLE);
  const body = clamp(slide.body, MAX_BODY[role] || 220);
  const note = clamp(slide.note, 60);

  return (
    <div
      ref={ref}
      className={`slide-canvas ${invert ? "light" : ""}`}
      style={{ containerType: "size" }}
    >
      <div className="absolute inset-0 flex flex-col p-[6cqh] pb-[5cqh]">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between text-[2.2cqh] tracking-[0.18em] uppercase opacity-75">
          <span className="truncate max-w-[60%]">{kicker}</span>
          <span>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </div>

        {/* Main */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center mt-[3.5cqh] mb-[3cqh]">
          {layout === "hero" && <Hero title={title} body={body} note={note} />}
          {layout === "split" && <Split title={title} body={body} note={note} />}
          {layout === "stamp" && <Stamp title={title} body={body} note={note} role={role} />}
          {layout === "centered" && <Centered title={title} body={body} note={note} big={isAccent} />}
          {layout === "label" && <Labeled title={title} body={body} note={note} />}
          {layout === "quote" && <QuoteLike title={title} body={body} note={note} />}
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between text-[2cqh] tracking-[0.18em] uppercase opacity-65 gap-3">
          <span className="truncate max-w-[60%]">{bookTitle || "—"}</span>
          <span className="truncate max-w-[40%] text-right">{bookAuthor || "BookFeed"}</span>
        </div>
      </div>
    </div>
  );
});

export default SlideRenderer;

/* --- Layouts. All font sizes are in cqh (container-query height) so they
   scale identically across mobile viewing and fixed-size export. --- */

function Hero({ title, body, note }) {
  const titleSize = headlineScale(title.length, false);
  return (
    <div className="flex flex-col gap-[2.6cqh] overflow-hidden">
      <h2 className="font-serif leading-[1.05] tracking-tightish" style={{ fontSize: `${titleSize}cqh` }}>
        {title}
      </h2>
      <div className="h-px w-[10cqh] bg-current opacity-60 shrink-0" />
      <p className="leading-[1.55] opacity-95" style={{ fontSize: `${bodyScale(body.length)}cqh` }}>
        {body}
      </p>
      {note ? (
        <div className="mt-[1cqh] text-[2cqh] uppercase tracking-[0.18em] opacity-65">{note}</div>
      ) : null}
    </div>
  );
}

function Split({ title, body, note }) {
  const titleSize = headlineScale(title.length, false) * 0.86;
  const bodySize = bodyScale(body.length);
  return (
    <div className="flex flex-col gap-[3cqh] overflow-hidden">
      <h2 className="font-serif leading-[1.06]" style={{ fontSize: `${titleSize}cqh` }}>
        {title}
      </h2>
      <div className="flex gap-[3cqh] overflow-hidden">
        <div className="w-[3px] bg-current opacity-40 shrink-0" />
        <div className="flex flex-col gap-[1.8cqh] overflow-hidden">
          <p className="leading-[1.55] opacity-95" style={{ fontSize: `${bodySize}cqh` }}>
            {body}
          </p>
          {note ? (
            <div className="text-[2cqh] uppercase tracking-[0.18em] opacity-65">{note}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stamp({ title, body, note, role }) {
  const titleSize = headlineScale(title.length, false) * 0.92;
  return (
    <div className="flex flex-col gap-[2.6cqh] overflow-hidden">
      <div className="inline-block self-start border border-current/70 px-[1.8cqh] py-[0.8cqh] text-[2cqh] uppercase tracking-[0.22em]">
        {note || (role === "mistake" ? "errore" : role === "false_premise" ? "falso presupposto" : "attenzione")}
      </div>
      <h2 className="font-serif leading-[1.07]" style={{ fontSize: `${titleSize}cqh` }}>
        {title}
      </h2>
      <p className="leading-[1.55] opacity-95" style={{ fontSize: `${bodyScale(body.length)}cqh` }}>
        {body}
      </p>
    </div>
  );
}

function Centered({ title, body, note, big }) {
  const bodySize = headlineScale(body.length, big);
  return (
    <div className="flex flex-col items-center justify-center text-center gap-[3cqh] overflow-hidden mx-auto max-w-[90%]">
      <div className="text-[2.2cqh] uppercase tracking-[0.24em] opacity-65">{title}</div>
      <p className="font-serif leading-[1.08]" style={{ fontSize: `${bodySize}cqh` }}>
        {body}
      </p>
      {note ? (
        <div className="text-[2cqh] uppercase tracking-[0.2em] opacity-70">{note}</div>
      ) : null}
    </div>
  );
}

function Labeled({ title, body, note }) {
  const bodySize = bodyScale(body.length) * 1.05;
  return (
    <div className="flex flex-col gap-[2.4cqh] overflow-hidden">
      <div className="text-[2.2cqh] uppercase tracking-[0.22em] opacity-65">{title}</div>
      <p className="leading-[1.55] opacity-95" style={{ fontSize: `${bodySize}cqh` }}>
        {body}
      </p>
      {note ? (
        <div className="text-[2cqh] uppercase tracking-[0.18em] opacity-65">↳ {note}</div>
      ) : null}
    </div>
  );
}

function QuoteLike({ title, body, note }) {
  const bodySize = headlineScale(body.length, false) * 0.82;
  return (
    <div className="flex flex-col gap-[2cqh] overflow-hidden">
      <div className="font-serif leading-none opacity-55" style={{ fontSize: "9cqh" }}>“</div>
      <p className="font-serif leading-[1.28] -mt-[2cqh]" style={{ fontSize: `${bodySize}cqh` }}>
        {body}
      </p>
      <div className="text-[2cqh] uppercase tracking-[0.22em] opacity-70">
        {title}{note ? " · " + note : ""}
      </div>
    </div>
  );
}
