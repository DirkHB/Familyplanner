/**
 * Rückgängig im Klärungs-Stapel — als Gegenbuchung, nicht als Wartezeit.
 *
 * Der erste Bau hielt jede Antwort 3 Sekunden zurück, damit „Rückgängig" sie
 * abfangen kann. In einer iOS-PWA verliert man so Antworten: Wer nach dem
 * letzten Wisch die App wechselt, friert das JavaScript ein, bevor die
 * Aktion je gefeuert hat — und die App stellt dieselbe Frage später wieder.
 * Genau daran sterben solche Apps.
 *
 * Deshalb jetzt: Die Antwort wird sofort geschrieben, und die Aktion gibt
 * zurück, wie man sie wieder zurücknimmt. „Rückgängig" ist eine zweite
 * Buchung, kein abgebrochener Versand.
 */
export type StapelUndo =
  | { art: "todo-toggle"; todoId: string }
  /** Fälligkeit und Verschiebe-Zähler auf den Stand von vorher. */
  | { art: "todo-stand"; todoId: string; dueISO: string | null; shiftCount: number }
  /**
   * Betreuungsentscheidung auf den Stand von vorher — `vorher: null` heißt:
   * Es gab keine, die Zeile wird wieder gelöscht. Optional dazu: eine
   * Titelregel zurücknehmen („Nicolas ist dabei") oder die gerade erzeugte
   * Anfrage löschen („Ich kann nicht").
   */
  | {
      art: "care-stand";
      uid: string;
      occurrenceISO: string;
      vorher: { status: string; responsibleUserId: string | null } | null;
      titelZurueck?: string;
      anfrageWeg?: string;
    }
  /** Antwort auf eine Anfrage zurücknehmen — die Frage steht wieder offen. */
  | { art: "antwort-zurueck"; requestId: string; eventUid: string | null }
  /** Eine gerade angelegte Aufgabe („Frag ich heute Abend") wieder löschen. */
  | { art: "todo-weg"; todoId: string };
