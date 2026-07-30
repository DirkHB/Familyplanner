"use client";

/**
 * Merkt sich pro Ansicht, wie weit gescrollt war, und stellt das beim
 * Zurückgehen wieder her.
 *
 * Warum selbst gebaut: Die Wiederherstellung des Browsers greift nur beim
 * Dokument. Bei uns steht das Dokument fest und es scrollt der Inhaltsbereich
 * der App-Hülle (siehe AppShell) — davon weiß der Browser nichts.
 *
 * Wiederhergestellt wird ausschließlich bei Zurück/Vorwärts. Ein normaler
 * Wechsel über die Tab-Leiste fängt oben an, sonst wirkt die App sprunghaft.
 */

const PREFIX = "scrollpos:";

let navigatedBack = false;
let paused = false;

if (typeof window !== "undefined") {
  // Deckt beides ab: den Zurück-Pfeil (router.back) und die Wischgeste am iPhone.
  window.addEventListener("popstate", () => {
    navigatedBack = true;
  });

  // Ein Klick heißt meistens: gleich wird navigiert. Beim Seitenwechsel setzt
  // Next den Inhaltsbereich auf 0 zurück, und das ist ein echtes Scroll-
  // Ereignis — es würde die gerade gemerkte Position überschreiben. Also ab
  // dem Klick nichts mehr mitschreiben.
  window.addEventListener("click", () => {
    paused = true;
  }, true);

  // … es sei denn, die Seite wird erneut angefasst. Dann war der Klick keine
  // Navigation (Häkchen, Knopf, Filter) und wir schreiben wieder mit.
  for (const type of ["pointerdown", "touchstart", "wheel", "keydown"]) {
    window.addEventListener(type, () => {
      paused = false;
    }, true);
  }
}

/** Schlüssel bewusst nur der Pfad — eine Position je Ansicht reicht. */
export function viewKey(pathname: string): string {
  return PREFIX + pathname;
}

/** Beim Betreten einer Ansicht wieder scharf schalten. */
export function resumeScrollMemory(): void {
  paused = false;
}

export function rememberScroll(key: string, top: number): void {
  if (paused) return;
  try {
    window.sessionStorage.setItem(key, String(Math.round(top)));
  } catch {
    // Privater Modus o. Ä. — dann eben ohne Gedächtnis, kein Grund zu scheitern.
  }
}

/** Gemerkte Position — aber nur, wenn wir gerade zurückgegangen sind. */
export function takeScrollToRestore(key: string): number | null {
  if (!navigatedBack) return null;
  navigatedBack = false;
  try {
    const raw = window.sessionStorage.getItem(key);
    const top = Number(raw);
    return raw != null && Number.isFinite(top) && top > 0 ? top : null;
  } catch {
    return null;
  }
}
