"use client";

import { useEffect, useRef, useState } from "react";

// Instagram-like pinch-to-zoom wrapper for a single slide.
// - 2-finger pinch: zoom 1x→4x, snap back to 1 if released below 1.05
// - 1-finger drag while zoomed (>1): pan, clamped so the slide can't be
//   pushed entirely off the canvas
// - 1-finger drag while not zoomed: forwarded as horizontal swipe to
//   navigate slides (existing CarouselViewer behavior)
// - Double-tap: toggle 1 ↔ 2.4
// - Resets to neutral when `resetKey` changes (e.g. user changes slide)
//
// Native event listeners with `passive: false` so preventDefault works on
// mobile Chrome/Safari during pinch/pan.

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_DOUBLE = 2.4;

export default function Pinchable({ children, onSwipeLeft, onSwipeRight, resetKey }) {
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const stateRef = useRef({
    mode: null, // 'pinch' | 'pan' | 'swipe' | null
    initialDistance: 0,
    initialScale: 1,
    initialTx: 0,
    initialTy: 0,
    panStartX: 0,
    panStartY: 0,
    swipeStartX: 0,
    swipeStartY: 0,
    lastTap: 0,
    lastTapX: 0,
    lastTapY: 0,
  });
  const transformRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const [, setTick] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  function apply(next, animate = false) {
    transformRef.current = next;
    setAnimating(animate);
    setZoomed(next.scale > 1.01);
    setTick((t) => t + 1);
    const inner = innerRef.current;
    if (inner) {
      inner.style.transition = animate ? "transform 0.22s ease" : "none";
      inner.style.transform = `translate3d(${next.tx}px, ${next.ty}px, 0) scale(${next.scale})`;
    }
  }

  function clamp(scale, tx, ty) {
    const el = containerRef.current;
    if (!el) return { tx, ty };
    const w = el.clientWidth, h = el.clientHeight;
    const maxX = ((scale - 1) * w) / 2;
    const maxY = ((scale - 1) * h) / 2;
    return {
      tx: Math.max(-maxX, Math.min(maxX, tx)),
      ty: Math.max(-maxY, Math.min(maxY, ty)),
    };
  }

  // Reset on slide change
  useEffect(() => {
    apply({ scale: 1, tx: 0, ty: 0 }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e) {
      const s = stateRef.current;
      const cur = transformRef.current;
      if (e.touches.length >= 2) {
        const t1 = e.touches[0], t2 = e.touches[1];
        const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        s.mode = "pinch";
        s.initialDistance = d || 1;
        s.initialScale = cur.scale;
        s.initialTx = cur.tx;
        s.initialTy = cur.ty;
        return;
      }
      if (e.touches.length === 1) {
        const t = e.touches[0];
        // Double-tap detection
        const now = Date.now();
        const near = Math.abs(t.clientX - s.lastTapX) < 30 && Math.abs(t.clientY - s.lastTapY) < 30;
        if (now - s.lastTap < 280 && near) {
          s.lastTap = 0;
          s.mode = null;
          if (cur.scale > 1.05) apply({ scale: 1, tx: 0, ty: 0 }, true);
          else apply({ scale: ZOOM_DOUBLE, tx: 0, ty: 0 }, true);
          e.preventDefault();
          return;
        }
        s.lastTap = now;
        s.lastTapX = t.clientX;
        s.lastTapY = t.clientY;

        if (cur.scale > 1.05) {
          s.mode = "pan";
          s.panStartX = t.clientX;
          s.panStartY = t.clientY;
          s.initialTx = cur.tx;
          s.initialTy = cur.ty;
        } else {
          s.mode = "swipe";
          s.swipeStartX = t.clientX;
          s.swipeStartY = t.clientY;
        }
      }
    }

    function onTouchMove(e) {
      const s = stateRef.current;
      const cur = transformRef.current;
      if (s.mode === "pinch" && e.touches.length >= 2) {
        e.preventDefault();
        const t1 = e.touches[0], t2 = e.touches[1];
        const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const ratio = d / s.initialDistance;
        let newScale = Math.max(ZOOM_MIN * 0.85, Math.min(ZOOM_MAX, s.initialScale * ratio));
        // Soft clamp at min so user feels resistance, but don't go below 1
        if (newScale < ZOOM_MIN) newScale = ZOOM_MIN;
        const c = clamp(newScale, cur.tx, cur.ty);
        apply({ scale: newScale, tx: c.tx, ty: c.ty }, false);
      } else if (s.mode === "pan" && e.touches.length === 1) {
        e.preventDefault();
        const t = e.touches[0];
        const tx = s.initialTx + (t.clientX - s.panStartX);
        const ty = s.initialTy + (t.clientY - s.panStartY);
        const c = clamp(cur.scale, tx, ty);
        apply({ scale: cur.scale, tx: c.tx, ty: c.ty }, false);
      } else if (s.mode === "swipe" && e.touches.length === 1) {
        // Don't preventDefault here so vertical page scroll still works
      }
    }

    function onTouchEnd(e) {
      const s = stateRef.current;
      const cur = transformRef.current;
      if (s.mode === "swipe" && e.changedTouches.length === 1) {
        const t = e.changedTouches[0];
        const dx = t.clientX - s.swipeStartX;
        const dy = t.clientY - s.swipeStartY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) onSwipeLeft?.();
          else onSwipeRight?.();
        }
      }
      if (e.touches.length === 0) {
        s.mode = null;
        // Snap back to 1 if very close
        if (cur.scale < 1.05 && (cur.scale !== 1 || cur.tx !== 0 || cur.ty !== 0)) {
          apply({ scale: 1, tx: 0, ty: 0 }, true);
        }
      }
    }

    function onTouchCancel() {
      stateRef.current.mode = null;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [onSwipeLeft, onSwipeRight]);

  // Desktop: trackpad pinch (ctrl+wheel) and double-click
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const cur = transformRef.current;
      const factor = Math.pow(1.0035, -e.deltaY);
      let newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cur.scale * factor));
      const c = clamp(newScale, cur.tx, cur.ty);
      apply({ scale: newScale, tx: c.tx, ty: c.ty }, false);
    }
    function onDblClick(e) {
      const cur = transformRef.current;
      if (cur.scale > 1.05) apply({ scale: 1, tx: 0, ty: 0 }, true);
      else apply({ scale: ZOOM_DOUBLE, tx: 0, ty: 0 }, true);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-[22px] select-none"
      style={{
        touchAction: zoomed ? "none" : "pan-y",
        cursor: zoomed ? "grab" : "default",
        background: "#0a0a0a",
      }}
    >
      <div
        ref={innerRef}
        style={{
          transform: "translate3d(0,0,0) scale(1)",
          transformOrigin: "center",
          transition: animating ? "transform 0.22s ease" : "none",
          willChange: "transform",
        }}
      >
        {children}
      </div>
      {zoomed && (
        <button
          onClick={() => apply({ scale: 1, tx: 0, ty: 0 }, true)}
          className="absolute top-2 right-2 z-10 text-[10px] uppercase tracking-[0.2em] bg-paper/70 backdrop-blur px-2 py-1 rounded-full border border-line"
          aria-label="Riduci zoom"
        >
          1×
        </button>
      )}
    </div>
  );
}
