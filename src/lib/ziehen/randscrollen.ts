/**
 * Mitscrollen, während man etwas zieht.
 *
 * Wer eine Aufgabe am Griff anfasst, hält den Finger auf einem Element, das
 * `touch-action: none` trägt — der Browser scrollt dann absichtlich nicht,
 * weil wir die Geste selbst auswerten. Nur hat das bisher niemand übernommen:
 * Wer die Aufgabe in eine Liste ziehen wollte, die gerade nicht auf dem
 * Bildschirm stand, kam nicht hin. Auf einem Telefon mit ein paar Listen ist
 * das der Normalfall, nicht die Ausnahme.
 *
 * Also übernehmen wir es. Kommt der Finger nah an den oberen oder unteren
 * Rand, schiebt der Inhalt nach — je näher am Rand, desto schneller.
 */

/** Wie tief die empfindliche Zone an jedem Rand reicht. */
const ZONE = 88;

/** Höchstgeschwindigkeit am äußersten Rand, in Bildpunkten je Bild. */
const TEMPO = 14;

/**
 * Wie weit in diesem Bild geschoben wird — negativ nach oben, positiv nach
 * unten, 0 in der Mitte.
 *
 * Der eigentliche Kern, und deshalb hier ohne DOM: Er hängt nur von der
 * Fingerposition und den beiden Rändern ab.
 */
export function schrittFuer(y: number, oben: number, unten: number): number {
  if (unten - oben < 2 * ZONE) return 0; // zu flach für zwei Zonen
  if (y < oben + ZONE) {
    const tiefe = Math.min(1, (oben + ZONE - y) / ZONE);
    return -Math.ceil(tiefe * TEMPO);
  }
  if (y > unten - ZONE) {
    const tiefe = Math.min(1, (y - (unten - ZONE)) / ZONE);
    return Math.ceil(tiefe * TEMPO);
  }
  return 0;
}

export type RandScrollen = {
  /** Bei jeder Bewegung aufrufen. */
  bewege(x: number, y: number): void;
  /** Am Ende des Ziehens aufrufen. */
  stoppe(): void;
};

/**
 * Startet die Nachführung.
 *
 * `beiSchritt` wird nach jedem Schub mit der unveränderten Fingerposition
 * aufgerufen. Das ist kein Beiwerk: Wer den Finger am Rand ruhig hält, löst
 * keine weiteren Bewegungsereignisse aus — der Inhalt zieht trotzdem vorbei,
 * und ohne diesen Rückruf bliebe die hervorgehobene Liste die von vorhin.
 */
export function randScrollen(beiSchritt: (x: number, y: number) => void): RandScrollen {
  const scroller = document.querySelector<HTMLElement>("[data-scroller]");
  let x = 0;
  let y = 0;
  let laeuft = false;
  let bild = 0;

  function schritt() {
    if (!laeuft || !scroller) return;
    const r = scroller.getBoundingClientRect();
    const um = schrittFuer(y, r.top, r.bottom);
    if (um !== 0) {
      const vorher = scroller.scrollTop;
      scroller.scrollTop += um;
      // Nur melden, wenn sich wirklich etwas bewegt hat — am Anschlag wäre es
      // ein Rückruf ohne Anlass.
      if (scroller.scrollTop !== vorher) beiSchritt(x, y);
    }
    bild = requestAnimationFrame(schritt);
  }

  return {
    bewege(neuX, neuY) {
      x = neuX;
      y = neuY;
      if (!laeuft && scroller) {
        laeuft = true;
        bild = requestAnimationFrame(schritt);
      }
    },
    stoppe() {
      laeuft = false;
      if (bild) cancelAnimationFrame(bild);
      bild = 0;
    },
  };
}
