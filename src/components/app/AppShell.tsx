"use client";

import { TabBar } from "./TabBar";

/**
 * App-Hülle: Die Seite selbst scrollt nie — nur der Inhaltsbereich.
 *
 * Warum: In installierten iOS-PWAs löst sich `position: fixed` beim
 * Gummiband-Scrollen regelmäßig vom Viewport; Tab-Leiste und Aktionsknopf
 * rutschen dann mitten ins Bild. Mit einer fixen Hülle plus eigenem
 * Scrollcontainer liegen beide außerhalb des scrollenden Bereichs und
 * können sich nicht mehr bewegen — so machen es native Apps auch.
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
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-bg text-ink">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className={`mx-auto max-w-md px-5 pb-24 pt-8 ${contentClassName}`}>{children}</div>
      </div>

      {floating}
      {bottomBar}
      <TabBar />
    </div>
  );
}
