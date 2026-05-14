"use client";

import { useEffect, useRef, useState } from "react";

// Instagram-like pinch-to-zoom wrapper for a single slide.
// - 2-finger pinch: zoom 1x → 4x, snap back to 1 if released near 1
// - 1-finger drag while zoomed: pan (clamped to slide bounds)
// - 1-finger drag while not zoomed: forwarded as horizontal swipe
// - Double-tap: toggle 1 ↔ 2.4
// - Resets to neutral when `resetKey` changes
//
// transform state is held in a ref (for sync reads inside touch handlers
// without stale closures) AND mirrored to React state so the JSX `style`
// is the source of truth on render — otherwise React would clobber any
// imperative style writes on the next re-render.

const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_DOUBLE = 2.4;
const SNAP_THRESHOLD = 1.05;

export default function Pinchable({ children, onSwipeLeft, onSwipeRight, resetKey }) {
  const containerRef = useRef(null);
  const stateRef = useRef({
    mode: null,
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

  const tRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const [t, setT] = useState({ scale: 1, tx: 0, ty: 0 });
  const [animating, setAnimating] = useState(false);

  function applyT(next, animate = false) {
    tRef.current = next;
    setAnimating(animate);
    setT(next);
  }

  function clampTr(scale, tx, ty) {
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

  // Reset when the slide changes
  useEffect(() => {
    applyT({ scale: 1, tx: 0, ty: 0 }, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e) {
      const s = stateRef.current;
      const cur = tRef.current;
      if (e.touches.length >= 2) {
        const t1 = e.touches[0], t2 = e.touches[1];
        const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        s.mode = "pinch";
        s.initialDistance = d || 1;
        s.initialScale = cur.scale;
        s.initialTx = cur.tx;
        s.initialTy = cur.ty;
        e.preventDefault();
        return;
      }
      if (e.touches.length === 1) {
        const tt = e.touches[0];
        // Double-tap
        const now = Date.now();
        const near = Math.abs(tt.clientX - s.lastTapX) < 36 && Math.abs(tt.clientY - s.lastTapY) < 36;
        if (now - s.lastTap < 280 && near) {
          s.lastTap = 0;
          s.mode = null;
          if (cur.scale > SNAP_THRESHOLD) applyT({ scale: 1, tx: 0, ty: 0 }, true);
          else applyT({ scale: ZOOM_DOUBLE, tx: 0, ty: 0 }, true);
          e.preventDefault();
          return;
        }
        s.lastTap = now;
        s.lastTapX = tt.clientX;
        s.lastTapY = tt.clientY;

        if (cur.scale > SNAP_THRESHOLD) {
          s.mode = "pan";
          s.panStartX = tt.clientX;
          s.panStartY = tt.clientY;
          s.initialTx = cur.tx;
          s.initialTy = cur.ty;
        } else {
          s.mode = "swipe";
          s.swipeStartX = tt.clientX;
          s.swipeStartY = tt.clientY;
        }
      }
    }

    function onTouchMove(e) {
      const s = stateRef.current;
      const cur = tRef.current;
      if (s.mode === "pinch" && e.touches.length >= 2) {
        e.preventDefault();
        const t1 = e.touches[0], t2 = e.touches[1];
        const d = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const ratio = d / s.initialDistance;
        let newScale = s.initialScale * ratio;
        if (newScale < ZOOM_MIN) newScale = ZOOM_MIN;
        if (newScale > ZOOM_MAX) newScale = ZOOM_MAX;
        const c = clampTr(newScale, cur.tx, cur.ty);
        applyT({ scale: newScale, tx: c.tx, ty: c.ty }, false);
      } else if (s.mode === "pan" && e.touches.length === 1) {
        e.preventDefault();
        const tt = e.touches[0];
        const tx = s.initialTx + (tt.clientX - s.panStartX);
        const ty = s.initialTy + (tt.clientY - s.panStartY);
        const c = clampTr(cur.scale, tx, ty);
        applyT({ scale: cur.scale, tx: c.tx, ty: c.ty }, false);
      }
      // swipe: don't preventDefault, allow vertical page scroll
    }

    function onTouchEnd(e) {
      const s = stateRef.current;
      const cur = tRef.current;
      if (s.mode === "swipe" && e.changedTouches.length === 1) {
        const tt = e.changedTouches[0];
        const dx = tt.clientX - s.swipeStartX;
        const dy = tt.clientY - s.swipeStartY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) onSwipeLeft?.();
          else onSwipeRight?.();
        }
      }
      if (e.touches.length === 0) {
        s.mode = null;
        if (cur.scale < SNAP_THRESHOLD && (cur.scale !== 1 || cur.tx !== 0 || cur.ty !== 0)) {
          applyT({ scale: 1, tx: 0, ty: 0 }, true);
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

  // Desktop: trackpad pinch (ctrl + wheel) and double-click
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const cur = tRef.current;
      const factor = Math.pow(1.0035, -e.deltaY);
      let newScale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, cur.scale * factor));
      const c = clampTr(newScale, cur.tx, cur.ty);
      applyT({ scale: newScale, tx: c.tx, ty: c.ty }, false);
    }
    function onDblClick() {
      const cur = tRef.current;
      if (cur.scale > SNAP_THRESHOLD) applyT({ scale: 1, tx: 0, ty: 0 }, true);
      else applyT({ scale: ZOOM_DOUBLE, tx: 0, ty: 0 }, true);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("dblclick", onDblClick);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, []);

  const zoomed = t.scale > 1.01;

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-[22px] select-none"
      style={{
        // Always intercept gestures inside the slide so pinch and pan are
        // never stolen by the browser. The page itself remains scrollable
        // by touching outside the slide.
        touchAction: "none",
        cursor: zoomed ? "grab" : "default",
        background: "#0a0a0a",
      }}
    >
      <div
        style={{
          transform: `translate3d(${t.tx}px, ${t.ty}px, 0) scale(${t.scale})`,
          transformOrigin: "center",
          transition: animating ? "transform 0.22s ease" : "none",
          willChange: "transform",
        }}
      >
        {children}
      </div>
      {zoomed && (
        <button
          onClick={() => applyT({ scale: 1, tx: 0, ty: 0 }, true)}
          className="absolute top-2 right-2 z-10 text-[11px] uppercase tracking-[0.2em] bg-paper/80 backdrop-blur px-2.5 py-1 rounded-full border border-line"
          aria-label="Reset zoom"
        >
          1×
        </button>
      )}
    </div>
  );
}
