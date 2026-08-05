/**
 * Der Zeitstrahl eines Tages: Wo liegen Termine, wo ist Luft?
 *
 * Kein maßstäblicher Kalender — freie Blöcke sind bewusst immer gleich groß,
 * egal ob eine halbe oder vier Stunden frei sind. Die Frage im Alltag ist
 * „ist da Luft?", nicht „wie viele Pixel Luft?". Die Dauer steht als Text
 * dran; Termine, die sich überschneiden, bilden eine Gruppe und werden
 * nebeneinander gezeigt.
 *
 * Reine Logik ohne Oberfläche, damit die Fälle prüfbar sind: Überschneidung,
 * Lücke am Morgen, Lücke am Abend, Termin außerhalb des Fensters.
 */

export type TagesFenster = { vonStunde: number; bisStunde: number };

/** Nicolas' Familienalltag: 7 bis 21 Uhr. In den Einstellungen je Person änderbar. */
export const STANDARD_FENSTER: TagesFenster = { vonStunde: 7, bisStunde: 21 };

/** Kürzere Lücken sind keine „freie Zeit", sondern Übergang. */
export const MIN_FREI_MINUTEN = 45;

export type StrahlSegment =
  | { art: "frei"; label: string }
  | { art: "termine"; keys: string[] };

const berlinClock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  hourCycle: "h23",
});

/**
 * Volle Stunde eines Berliner Tages als Zeitpunkt. Erst mit Sommerzeit-Versatz
 * raten, dann nachmessen und bei Winterzeit um eine Stunde schieben — der
 * übliche Mittags-Anker-Trick, nur für eine beliebige Stunde.
 */
export function berlinStunde(tag: string, stunde: number): Date {
  const geraten = new Date(`${tag}T${String(stunde).padStart(2, "0")}:00:00+02:00`);
  const ist = Number(berlinClock.format(geraten));
  if (ist === stunde) return geraten;
  return new Date(geraten.getTime() + (stunde - ist) * 3_600_000);
}

/** „2 Std", „1½ Std", „45 Min" — gerundet auf halbe Stunden. */
export function dauerLabel(minuten: number): string {
  if (minuten < 60) return `${Math.round(minuten / 5) * 5} Min`;
  const halbe = Math.round(minuten / 30) / 2;
  const ganz = Math.floor(halbe);
  const rest = halbe - ganz;
  return `${rest ? `${ganz}½` : ganz} Std`;
}

/** Überschneidende Termine zu einer Gruppe zusammenfassen, zeitlich sortiert. */
function gruppiere(events: { key: string; start: Date; end: Date }[]) {
  const sortiert = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const gruppen: { keys: string[]; start: Date; end: Date }[] = [];
  for (const e of sortiert) {
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && e.start < letzte.end) {
      letzte.keys.push(e.key);
      if (e.end > letzte.end) letzte.end = e.end;
    } else {
      gruppen.push({ keys: [e.key], start: e.start, end: e.end });
    }
  }
  return gruppen;
}

/** Ein Stück freie Zeit mit echten Uhrzeiten. */
export type FreiBlock = { von: Date; bis: Date; minuten: number };

/**
 * Die freien Blöcke eines Tages — dieselbe Rechnung wie im Zeitstrahl, aber
 * mit Uhrzeiten statt Beschriftung. Der Zeitstrahl zeigt sie an; der Worker
 * braucht sie, um im richtigen Moment an die Aufgaben zu erinnern.
 */
export function freieBloecke(
  events: { key: string; start: Date; end: Date }[],
  tag: string,
  fenster: TagesFenster = STANDARD_FENSTER,
): FreiBlock[] {
  const fensterVon = berlinStunde(tag, fenster.vonStunde);
  const fensterBis = berlinStunde(tag, fenster.bisStunde);
  const bloecke: FreiBlock[] = [];

  const nimm = (von: Date, bis: Date) => {
    const minuten = (bis.getTime() - von.getTime()) / 60_000;
    if (minuten >= MIN_FREI_MINUTEN) bloecke.push({ von, bis, minuten });
  };

  let zeiger = fensterVon;
  for (const g of gruppiere(events)) {
    nimm(zeiger, g.start);
    if (g.end > zeiger) zeiger = g.end;
  }
  nimm(zeiger, fensterBis);
  return bloecke;
}

export function buildStrahl(
  events: { key: string; start: Date; end: Date }[],
  tag: string,
  fenster: TagesFenster = STANDARD_FENSTER,
): StrahlSegment[] {
  const segmente: StrahlSegment[] = [];
  const fensterVon = berlinStunde(tag, fenster.vonStunde);
  const fensterBis = berlinStunde(tag, fenster.bisStunde);

  const frei = (von: Date, bis: Date) => {
    const minuten = (bis.getTime() - von.getTime()) / 60_000;
    if (minuten >= MIN_FREI_MINUTEN) segmente.push({ art: "frei", label: `frei · ${dauerLabel(minuten)}` });
  };

  let zeiger = fensterVon;
  for (const g of gruppiere(events)) {
    // Termine vor dem Fenster zählen keine Morgenlücke an; das Fenster
    // begrenzt nur die freie Zeit, nie die Termine selbst.
    frei(zeiger, g.start);
    segmente.push({ art: "termine", keys: g.keys });
    if (g.end > zeiger) zeiger = g.end;
  }
  frei(zeiger, fensterBis);

  return segmente;
}
