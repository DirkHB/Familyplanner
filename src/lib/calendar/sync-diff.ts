import type { RemoteObject } from "./caldav";

/**
 * Pure Reconciliation-Logik für den Pull. Trennt sauber, was hinzugefügt/geändert/gelöscht
 * werden muss — ohne DB, damit gut testbar. Die DB-Anwendung ist eine dünne Schicht darüber.
 */

export type LocalState = {
  /** href → bekanntes ETag der lokal gespeicherten Events. */
  etagByHref: Map<string, string>;
};

export type PullDiff = {
  /** Neu oder ETag geändert → .ics neu parsen und upserten. */
  toUpsert: RemoteObject[];
  /** Lokal vorhanden, aber remote weg → löschen. */
  hrefsToDelete: string[];
};

/**
 * @param remote Liste der aktuellen Remote-Objekte (href + etag; ics nur bei geänderten nötig).
 * @param local Bekannter lokaler Stand.
 * @param remoteIsComplete true = `remote` enthält ALLE Objekte des Kalenders (voller Abgleich,
 *   Löschungen ableitbar). false = nur ein Delta (sync-collection) — dann nicht löschen.
 */
export function diffPull(
  remote: RemoteObject[],
  local: LocalState,
  remoteIsComplete: boolean,
): PullDiff {
  const toUpsert: RemoteObject[] = [];
  const seen = new Set<string>();

  for (const obj of remote) {
    seen.add(obj.href);
    const knownEtag = local.etagByHref.get(obj.href);
    if (knownEtag !== obj.etag) toUpsert.push(obj);
  }

  const hrefsToDelete: string[] = [];
  if (remoteIsComplete) {
    for (const href of local.etagByHref.keys()) {
      if (!seen.has(href)) hrefsToDelete.push(href);
    }
  }

  return { toUpsert, hrefsToDelete };
}

/**
 * Konfliktstrategie beim Push (Abschnitt 4): iCloud ist Wahrheit für Kalenderfelder.
 * Vor dem Schreiben prüfen, ob unser bekanntes ETag noch dem Remote-ETag entspricht.
 * Bei Abweichung: nicht blind überschreiben, sondern Konflikt melden (last-write-wins wird
 * bewusst von der aufrufenden Schicht mit Protokolleintrag entschieden).
 */
export function detectPushConflict(
  knownEtag: string | null | undefined,
  currentRemoteEtag: string | null | undefined,
): boolean {
  if (!knownEtag || !currentRemoteEtag) return false;
  return knownEtag !== currentRemoteEtag;
}
