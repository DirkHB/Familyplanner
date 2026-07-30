"use client";

import { useRef, useState } from "react";

/**
 * Zeile mit Wisch-Gesten: nach rechts = erledigt, nach links = löschen.
 * Einhändig bedienbar (Baby im Arm) — der Griff ist die ganze Zeile, aber erst
 * ab ~12 px horizontaler Bewegung; vertikales Scrollen bleibt unangetastet.
 */
export function SwipeRow({
  onSwipeRight,
  onSwipeLeft,
  rightLabel = "Erledigt",
  leftLabel = "Löschen",
  children,
}: {
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  rightLabel?: string;
  leftLabel?: string;
  children: React.ReactNode;
}) {
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState<"l" | "r" | null>(null);
  const startRef = useRef<{ x: number; y: number; lock: "?" | "x" | "y" } | null>(null);

  const THRESHOLD = 72;

  function onTouchStart(e: React.TouchEvent) {
    startRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, lock: "?" };
  }
  function onTouchMove(e: React.TouchEvent) {
    const s = startRef.current;
    if (!s) return;
    const dX = e.touches[0].clientX - s.x;
    const dY = e.touches[0].clientY - s.y;
    if (s.lock === "?") {
      if (Math.abs(dX) < 12 && Math.abs(dY) < 12) return;
      s.lock = Math.abs(dX) > Math.abs(dY) ? "x" : "y";
    }
    if (s.lock !== "x") return;
    // Nur in Richtungen ziehen, für die es eine Aktion gibt.
    if ((dX > 0 && !onSwipeRight) || (dX < 0 && !onSwipeLeft)) return;
    setDx(Math.max(-140, Math.min(140, dX)));
  }
  function onTouchEnd() {
    const d = dx;
    startRef.current = null;
    if (d > THRESHOLD && onSwipeRight) {
      setGone("r");
      onSwipeRight();
      return;
    }
    if (d < -THRESHOLD && onSwipeLeft) {
      setGone("l");
      onSwipeLeft();
      return;
    }
    setDx(0);
  }

  if (gone) return null;

  const active = Math.abs(dx) > THRESHOLD;
  return (
    <div className="relative overflow-hidden rounded-card">
      {/* Hintergrund-Hinweise */}
      <div className="absolute inset-0 flex items-center justify-between px-5 text-sm font-medium">
        <span style={{ color: "var(--color-accent)", opacity: dx > 12 ? 1 : 0 }}>{rightLabel}</span>
        <span style={{ color: "var(--color-signal)", opacity: dx < -12 ? 1 : 0 }}>{leftLabel}</span>
      </div>
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => { startRef.current = null; setDx(0); }}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dx === 0 ? "transform 180ms cubic-bezier(0.16,1,0.3,1)" : "none",
          opacity: active ? 0.85 : 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
