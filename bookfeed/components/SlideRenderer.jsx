"use client";

import { forwardRef } from "react";

// Minimal, premium slide templates assembled in code (not AI-generated).
// 6 layout variants chosen by slide role for visual variety while staying coherent.

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

const SlideRenderer = forwardRef(function SlideRenderer(
  { slide, index, total = 10, bookTitle = "", bookAuthor = "", invert = false, accentSlide = false },
  ref
) {
  const layout = ROLE_LAYOUTS[slide.role] || "centered";
  const kicker = ROLE_KICKER[slide.role] || `${String(index + 1).padStart(2, "0")} · slide`;
  const isAccent = accentSlide || slide.role === "core" || slide.role === "synthesis";

  return (
    <div
      ref={ref}
      className={`slide-canvas ${invert ? "light" : ""}`}
      style={{
        boxShadow: "0 1px 0 #1a1a1a inset, 0 0 0 1px #161616 inset",
      }}
    >
      <div className="absolute inset-0 flex flex-col p-7 sm:p-10">
        {/* Header */}
        <div className="flex items-center justify-between text-[10px] tracking-[0.18em] uppercase opacity-70">
          <span>{kicker}</span>
          <span>{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </div>

        {/* Body — layout switch */}
        <div className="flex-1 flex flex-col justify-center min-h-0">
          {layout === "hero" && <Hero slide={slide} />}
          {layout === "split" && <Split slide={slide} />}
          {layout === "stamp" && <Stamp slide={slide} />}
          {layout === "centered" && <Centered slide={slide} big={isAccent} />}
          {layout === "label" && <Labeled slide={slide} />}
          {layout === "quote" && <QuoteLike slide={slide} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] tracking-[0.18em] uppercase opacity-60">
          <span className="truncate max-w-[70%]">{bookTitle || "—"}</span>
          <span className="truncate">{bookAuthor || "BookFeed"}</span>
        </div>
      </div>
    </div>
  );
});

export default SlideRenderer;

function Hero({ slide }) {
  return (
    <div className="space-y-5">
      <div className="font-serif text-[1.7rem] sm:text-[2.3rem] leading-[1.05] tracking-tightish">
        {slide.title}
      </div>
      <div className="h-px w-12 bg-current opacity-50" />
      <div className="text-[0.98rem] sm:text-[1.05rem] leading-[1.55] opacity-90 max-w-[28ch]">
        {slide.body}
      </div>
      {slide.note ? (
        <div className="mt-2 text-[0.78rem] uppercase tracking-[0.18em] opacity-50">{slide.note}</div>
      ) : null}
    </div>
  );
}

function Split({ slide }) {
  return (
    <div className="grid grid-cols-5 gap-5 items-center">
      <div className="col-span-2 font-serif text-[1.35rem] sm:text-[1.7rem] leading-[1.1]">
        {slide.title}
      </div>
      <div className="col-span-3 border-l border-current/30 pl-4 sm:pl-6 text-[0.98rem] sm:text-[1.05rem] leading-[1.55] opacity-90">
        {slide.body}
        {slide.note ? (
          <div className="mt-3 text-[0.78rem] uppercase tracking-[0.18em] opacity-60">{slide.note}</div>
        ) : null}
      </div>
    </div>
  );
}

function Stamp({ slide }) {
  return (
    <div className="space-y-5">
      <div className="inline-block border border-current/60 px-3 py-1 text-[0.7rem] uppercase tracking-[0.2em]">
        {slide.note || (slide.role === "mistake" ? "errore" : "attenzione")}
      </div>
      <div className="font-serif text-[1.45rem] sm:text-[1.85rem] leading-[1.08] max-w-[24ch]">
        {slide.title}
      </div>
      <div className="text-[0.95rem] sm:text-[1.02rem] leading-[1.6] opacity-90 max-w-[34ch]">
        {slide.body}
      </div>
    </div>
  );
}

function Centered({ slide, big = false }) {
  return (
    <div className="text-center mx-auto max-w-[24ch] space-y-5">
      <div className="text-[0.7rem] uppercase tracking-[0.22em] opacity-50">{slide.title}</div>
      <div className={`font-serif ${big ? "text-[2.1rem] sm:text-[2.8rem]" : "text-[1.6rem] sm:text-[2.1rem]"} leading-[1.05]`}>
        {slide.body}
      </div>
      {slide.note ? (
        <div className="text-[0.78rem] uppercase tracking-[0.18em] opacity-60">{slide.note}</div>
      ) : null}
    </div>
  );
}

function Labeled({ slide }) {
  return (
    <div className="space-y-4">
      <div className="text-[0.72rem] uppercase tracking-[0.22em] opacity-50">{slide.title}</div>
      <div className="text-[1.05rem] sm:text-[1.18rem] leading-[1.55] opacity-95 max-w-[34ch]">
        {slide.body}
      </div>
      {slide.note ? (
        <div className="text-[0.78rem] uppercase tracking-[0.18em] opacity-60">↳ {slide.note}</div>
      ) : null}
    </div>
  );
}

function QuoteLike({ slide }) {
  return (
    <div className="space-y-5">
      <div className="font-serif text-[2.4rem] leading-none opacity-50">“</div>
      <div className="font-serif text-[1.25rem] sm:text-[1.55rem] leading-[1.3] -mt-3 max-w-[30ch]">
        {slide.body}
      </div>
      <div className="text-[0.78rem] uppercase tracking-[0.2em] opacity-60">
        {slide.title}{slide.note ? " · " + slide.note : ""}
      </div>
    </div>
  );
}
