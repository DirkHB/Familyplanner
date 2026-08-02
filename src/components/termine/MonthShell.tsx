"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Hülle um den Monatskopf: bleibt beim Scrollen oben stehen (sticky),
 * Wischen links/rechts blättert den Monat, und beim Öffnen des aktuellen
 * Monats springt die Liste automatisch zum heutigen Tag.
 */
export function MonthShell({
  prevHref,
  nextHref,
  todayId,
  children,
}: {
  prevHref: string;
  nextHref: string;
  todayId: string | null; // Tages-Anker, nur im aktuellen Monat gesetzt
  children: React.ReactNode;
}) {
  const router = useRouter();
  const shellRef = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);

  // Einmalig zum heutigen Tag scrollen (unter dem sticky Kopf positioniert).
  // Gescrollt wird der Container der App-Hülle, nicht das Fenster.
  useEffect(() => {
    if (!todayId) return;
    const el = document.getElementById(todayId);
    const shell = shellRef.current;
    if (!el) return;
    const scroller = shell?.closest(".overflow-y-auto") as HTMLElement | null;
    const offset = (shell?.offsetHeight ?? 0) + 12;
    if (scroller) {
      // Steht schon eine Position (Zurückgehen hat sie wiederhergestellt),
      // dann nicht darüberbügeln — sonst landet man doch wieder beim heutigen Tag.
      if (scroller.scrollTop > 0) return;
      const y = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - offset;
      if (y > 10) scroller.scrollTo({ top: y });
    } else {
      const y = el.getBoundingClientRect().top + window.scrollY - offset;
      if (y > 10) window.scrollTo({ top: y });
    }
  }, [todayId]);

  function onTouchStart(e: React.TouchEvent) {
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      router.push(dx < 0 ? nextHref : prevHref);
    }
  }

  return (
    <div
      ref={shellRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      // Waagerecht blättern wir selbst — der Browser soll nicht mitschieben.
      style={{ touchAction: "pan-y" }}
      data-monatskopf
      className="sticky top-0 z-20 -mx-5 bg-bg px-5 pb-3 pt-2"
    >
      {children}
    </div>
  );
}
