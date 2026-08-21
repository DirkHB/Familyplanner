"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TabBar } from "./TabBar";
import {
  rememberScroll,
  resumeScrollMemory,
  takeScrollToRestore,
  viewKey,
} from "@/lib/ui/scroll-memory";

// Beim Server-Rendern gibt es kein Layout, useLayoutEffect würde nur warnen.
// Im Browser brauchen wir es aber: Die Position muss vor dem ersten Bild
// stehen, sonst sieht man den Sprung von oben nach unten.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * App-Hülle: Die Seite selbst scrollt nie — nur der Inhaltsbereich.
 *
 * Warum: In installierten iOS-PWAs löst sich `position: fixed` beim
 * Gummiband-Scrollen regelmäßig vom Viewport; Tab-Leiste und Aktionsknopf
 * rutschen dann mitten ins Bild. Mit einer fixen Hülle plus eigenem
 * Scrollcontainer liegen beide außerhalb des scrollenden Bereichs und
 * können sich nicht mehr bewegen — so machen es native Apps auch.
 *
 * Weil hier der Inhaltsbereich scrollt und nicht das Dokument, führt die Hülle
 * auch selbst Buch über die Scrollposition (siehe scroll-memory).
 */
export function AppShell({
  children,
  floating,
  bottomBar,
  contentClassName = "",
}: {
  children: React.ReactNode;
  /** Schwebender Knopf (z. B. „+"), liegt über dem Inhalt, scrollt nicht mit. */
  floating?: React.ReactNode;
  /** Fester Leistenbereich direkt über der Tab-Bar (z. B. Eingabefeld). */
  bottomBar?: React.ReactNode;
  contentClassName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const scrollerRef = useRef<HTMLDivElement>(null);
  // „Nach oben": erscheint erst, wenn man wirklich unterwegs ist.
  const [zurueckSichtbar, setZurueckSichtbar] = useState(false);
  /**
   * Die Tab-Leiste macht sich beim Runterscrollen klein und wächst beim
   * ersten Zug nach oben wieder — wie bei Instagram. Lesen braucht Platz,
   * Navigieren braucht die Leiste; die Scrollrichtung verrät, was gerade
   * dran ist.
   */
  const [leisteKlein, setLeisteKlein] = useState(false);
  const letzterTop = useRef(0);

  /**
   * Beim Zurückkommen in die App die Server-Daten neu holen. Die Seiten sind
   * serverseitig gerendert — was der andere inzwischen entschieden hat
   * („Dirk ist bei Nicolas"), stünde sonst erst nach einer eigenen Navigation
   * da. Gerade die iOS-PWA friert beim App-Wechsel komplett ein und zeigt
   * beim Aufwachen erstmal den alten Stand.
   */
  useEffect(() => {
    let zuletzt = Date.now();
    const auffrischen = () => {
      if (document.visibilityState !== "visible") return;
      // Nicht bei jedem kurzen Fokuswechsel — alle 15 s reicht.
      if (Date.now() - zuletzt < 15_000) return;
      zuletzt = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", auffrischen);
    window.addEventListener("focus", auffrischen);
    return () => {
      document.removeEventListener("visibilitychange", auffrischen);
      window.removeEventListener("focus", auffrischen);
    };
  }, [router]);

  useBrowserLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const key = viewKey(pathname);
    resumeScrollMemory();

    const target = takeScrollToRestore(key);
    if (target != null) {
      // Der Inhalt kann nach dem ersten Bild noch wachsen (Schriften, Bilder).
      // Deshalb ein paar Anläufe, bis die Position wirklich sitzt.
      let tries = 0;
      const apply = () => {
        const node = scrollerRef.current;
        if (!node) return;
        node.scrollTop = target;
        if (++tries < 5 && Math.abs(node.scrollTop - target) > 2) requestAnimationFrame(apply);
      };
      apply();
    }

    // Neue Seite, voller Auftritt der Leiste.
    setLeisteKlein(false);
    letzterTop.current = el.scrollTop;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const node = scrollerRef.current;
        if (node) {
          rememberScroll(key, node.scrollTop);
          setZurueckSichtbar(node.scrollTop > 600);
          // Richtung mit kleiner Schwelle, damit das Gummiband am Rand und
          // Zitterbewegungen die Leiste nicht flackern lassen.
          const delta = node.scrollTop - letzterTop.current;
          letzterTop.current = node.scrollTop;
          if (node.scrollTop < 80) setLeisteKlein(false);
          else if (delta > 6) setLeisteKlein(true);
          else if (delta < -6) setLeisteKlein(false);
        }
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg text-ink">
      {/* touch-action: pan-y — der Browser darf nur senkrecht schieben. Waagerechte
          Gesten gehören den Wisch-Zeilen und dem Monatsblättern; ohne diese Ansage
          hat der Browser nebenher die ganze Seite mitgezogen. */}
      <div
        ref={scrollerRef}
        /* Die Marke macht diesen Container auffindbar, ohne ihn durch drei
           Ebenen zu reichen. Wer etwas zieht, muss ihn scrollen können —
           das Dokument selbst scrollt hier nicht. */
        data-scroller
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
        style={{ touchAction: "pan-y" }}
      >
        <div className={`mx-auto max-w-md px-5 pb-24 pt-8 ${contentClassName}`}>{children}</div>
      </div>

      {/* Zurück nach oben — links, der Erfassen-Knopf wohnt rechts. Auf der
          Woche heißt oben „Heute", überall sonst genügt der Pfeil. */}
      {zurueckSichtbar && (
        <button
          onClick={() => scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          className="absolute left-5 z-30 flex h-11 items-center gap-1.5 rounded-pill bg-surface/85 px-3.5 text-sm font-medium text-ink shadow-hero"
          style={{
            bottom: "calc(6rem + env(safe-area-inset-bottom))",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {/* Woche und Monat beginnen beide beim Jetzt — dort heißt oben „Heute". */}
          {pathname === "/woche" || pathname === "/termine" ? "Heute" : null}
        </button>
      )}

      {floating}
      {bottomBar}
      <TabBar klein={leisteKlein} />
    </div>
  );
}
