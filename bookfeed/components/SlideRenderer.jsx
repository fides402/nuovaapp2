"use client";

import { forwardRef } from "react";

// Minimal, premium slide templates assembled in code (not AI-generated).
//
// Sizing strategy: every font size is `clamp(minPx, Ncqh, maxPx)`.
// - minPx: guarantees readable text on mobile even when the canvas is small
// - Ncqh: scales nicely between mobile (~475px tall) and export (1350px)
// - maxPx: cap so 1080×1350 exports don't blow up
// This way the slide is readable on Android without pinch and still
// looks proportional on social-format exports.

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

const MAX_BODY = {
  hook: 140, tension: 220, false_premise: 220, core: 110,
  explanation: 230, example: 230, implication: 230,
  mistake: 220, synthesis: 100, question: 160,
};
const MAX_TITLE = 60;

function clip(s, max) {
  if (!s) return "";
  const t = String(s).trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max).replace(/[\s,;:.\-—]+\S*$/, "");
  return (cut || t.slice(0, max - 1)) + "…";
}

// font-size helper: clamp(minPx, Ncqh, maxPx)
function fs(min, cqh, max) {
  return `clamp(${min}px, ${cqh}cqh, ${max}px)`;
}

// Body font sizing per text length.
// minPx: floor for smallest canvases — kept low so multi-line text never clips.
// The cqh value does the real work; user can pinch-zoom for detail if needed.
function bodyFs(len) {
  if (len <= 100) return fs(15, 5.8, 70);
  if (len <= 160) return fs(14, 5.2, 64);
  if (len <= 220) return fs(13, 4.7, 58);
  return fs(12, 4.3, 54);
}
function headlineFs(len, big) {
  const k = big ? 1.12 : 1.0;
  if (len <= 28) return fs(Math.round(22 * k), 11.0 * k, Math.round(140 * k));
  if (len <= 50) return fs(Math.round(20 * k), 9.0 * k, Math.round(120 * k));
  if (len <= 80) return fs(Math.round(18 * k), 7.0 * k, Math.round(96 * k));
  if (len <= 120) return fs(Math.round(16 * k), 5.8 * k, Math.round(82 * k));
  if (len <= 180) return fs(Math.round(14 * k), 5.0 * k, Math.round(70 * k));
  return fs(Math.round(13 * k), 4.4 * k, Math.round(64 * k));
}
// Small uppercase labels (kicker, footer, note).
const LABEL_FS = fs(10, 2.8, 28);
const LABEL_FS_MD = fs(11, 3.0, 32);
const LABEL_FS_LG = fs(12, 3.2, 36);

const SlideRenderer = forwardRef(function SlideRenderer(
  { slide, index, total = 10, bookTitle = "", bookAuthor = "", invert = false, accentSlide = false },
  ref
) {
  const role = slide.role || "core";
  const layout = ROLE_LAYOUTS[role] || "centered";
  const isAccent = accentSlide || role === "core" || role === "synthesis";

  const title = clip(slide.title, MAX_TITLE);
  const body = clip(slide.body, MAX_BODY[role] || 220);
  const note = clip(slide.note, 60);

  return (
    <div
      ref={ref}
      className={`slide-canvas ${invert ? "light" : ""}`}
    >
      <div className="absolute inset-0 flex flex-col p-[5cqh] pb-[4.5cqh]" style={{ paddingInline: "max(18px, 5cqh)" }}>
        {/* Header — just slide counter, no role label */}
        <div
          className="shrink-0 flex items-center justify-end tracking-[0.2em] uppercase opacity-70"
          style={{ fontSize: LABEL_FS_LG }}
        >
          <span>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </div>

        {/* Main */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-center mt-[3cqh] mb-[2.5cqh]">
          {layout === "hero" && <Hero title={title} body={body} note={note} />}
          {layout === "split" && <Split title={title} body={body} note={note} />}
          {layout === "stamp" && <Stamp title={title} body={body} note={note} />}
          {layout === "centered" && <Centered title={title} body={body} note={note} big={isAccent} />}
          {layout === "label" && <Labeled title={title} body={body} note={note} />}
          {layout === "quote" && <QuoteLike title={title} body={body} note={note} />}
        </div>

        {/* Footer */}
        <div
          className="shrink-0 flex items-center justify-between tracking-[0.18em] uppercase opacity-70 gap-3"
          style={{ fontSize: LABEL_FS }}
        >
          <span className="truncate max-w-[60%]">{bookTitle || "—"}</span>
          <span className="truncate max-w-[40%] text-right">{bookAuthor || "BookFeed"}</span>
        </div>
      </div>
    </div>
  );
});

export default SlideRenderer;

function Hero({ title, body, note }) {
  return (
    <div className="flex flex-col gap-[2.6cqh] overflow-hidden">
      <h2
        className="font-serif leading-[1.06] tracking-tightish"
        style={{ fontSize: headlineFs(title.length, false) }}
      >
        {title}
      </h2>
      <div className="h-px w-[10cqh] bg-current opacity-60 shrink-0" />
      <p className="leading-[1.55] opacity-95" style={{ fontSize: bodyFs(body.length) }}>
        {body}
      </p>
      {note ? (
        <div
          className="mt-[1cqh] uppercase tracking-[0.18em] opacity-65"
          style={{ fontSize: LABEL_FS_MD }}
        >
          {note}
        </div>
      ) : null}
    </div>
  );
}

function Split({ title, body, note }) {
  return (
    <div className="flex flex-col gap-[3cqh] overflow-hidden">
      <h2
        className="font-serif leading-[1.07]"
        style={{ fontSize: headlineFs(Math.max(40, title.length), false) }}
      >
        {title}
      </h2>
      <div className="flex gap-[3cqh] overflow-hidden">
        <div className="w-[3px] bg-current opacity-40 shrink-0" />
        <div className="flex flex-col gap-[1.8cqh] overflow-hidden">
          <p className="leading-[1.55] opacity-95" style={{ fontSize: bodyFs(body.length) }}>
            {body}
          </p>
          {note ? (
            <div className="uppercase tracking-[0.18em] opacity-65" style={{ fontSize: LABEL_FS_MD }}>
              {note}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stamp({ title, body, note }) {
  return (
    <div className="flex flex-col gap-[2.6cqh] overflow-hidden">
      {note ? (
        <div
          className="inline-block self-start border border-current/70 px-[1.8cqh] py-[0.8cqh] uppercase tracking-[0.22em]"
          style={{ fontSize: LABEL_FS_MD }}
        >
          {note}
        </div>
      ) : (
        <div className="flex items-center gap-[1.4cqh] opacity-60">
          <div className="h-[3px] w-[6cqh] bg-current" />
          <div className="h-[3px] w-[2cqh] bg-current" />
        </div>
      )}
      <h2 className="font-serif leading-[1.08]" style={{ fontSize: headlineFs(title.length, false) }}>
        {title}
      </h2>
      <p className="leading-[1.55] opacity-95" style={{ fontSize: bodyFs(body.length) }}>
        {body}
      </p>
    </div>
  );
}

function Centered({ title, body, note, big }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-[3cqh] overflow-hidden mx-auto max-w-[92%]">
      <div className="uppercase tracking-[0.24em] opacity-70" style={{ fontSize: LABEL_FS_LG }}>
        {title}
      </div>
      <p
        className="font-serif leading-[1.08]"
        style={{ fontSize: headlineFs(body.length, big) }}
      >
        {body}
      </p>
      {note ? (
        <div className="uppercase tracking-[0.2em] opacity-75" style={{ fontSize: LABEL_FS_MD }}>
          {note}
        </div>
      ) : null}
    </div>
  );
}

function Labeled({ title, body, note }) {
  return (
    <div className="flex flex-col gap-[2.4cqh] overflow-hidden">
      <div className="uppercase tracking-[0.22em] opacity-70" style={{ fontSize: LABEL_FS_LG }}>
        {title}
      </div>
      <p className="leading-[1.55] opacity-95" style={{ fontSize: bodyFs(body.length) }}>
        {body}
      </p>
      {note ? (
        <div className="uppercase tracking-[0.18em] opacity-65" style={{ fontSize: LABEL_FS_MD }}>
          ↳ {note}
        </div>
      ) : null}
    </div>
  );
}

function QuoteLike({ title, body, note }) {
  return (
    <div className="flex flex-col gap-[2cqh] overflow-hidden">
      <div className="font-serif leading-none opacity-55" style={{ fontSize: fs(56, 11, 180) }}>“</div>
      <p
        className="font-serif leading-[1.28] -mt-[2cqh]"
        style={{ fontSize: headlineFs(Math.max(60, body.length), false) }}
      >
        {body}
      </p>
      <div className="uppercase tracking-[0.22em] opacity-75" style={{ fontSize: LABEL_FS_MD }}>
        {title}{note ? " · " + note : ""}
      </div>
    </div>
  );
}
