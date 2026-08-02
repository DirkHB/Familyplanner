/**
 * Die Kopfzeile der Woche — ein Briefing, kein Inhaltsverzeichnis.
 *
 * Der erste Wurf zählte Titel auf („Heute: Physio, Einkauf") und addierte
 * ALLE offenen Aufgaben — beides stand einen Daumen tiefer sowieso da.
 * Ein Briefing sagt, was die Liste nicht auf einen Blick hergibt: was als
 * Nächstes kommt, und was heute noch eine Entscheidung oder Arbeit braucht.
 */

export type BriefingTermin = {
  time: string;
  title: string;
  past: boolean;
  allDay: boolean;
  careOffen: boolean;
};

export function wochenBriefing(input: {
  heute: BriefingTermin[];
  /** Erster Termin des nächsten Tages mit Terminen — für freie Tage. */
  naechster: { tagLabel: string; time: string; title: string } | null;
  /** Heute fällige oder überfällige Aufgaben. */
  aufgabenHeute: number;
}): string {
  const saetze: string[] = [];
  const kommendeMitZeit = input.heute.filter((e) => !e.past && !e.allDay);
  const hatteTermine = input.heute.some((e) => !e.allDay);

  if (kommendeMitZeit.length > 0) {
    const n = kommendeMitZeit[0];
    saetze.push(
      kommendeMitZeit.length === 1
        ? `Heute noch: ${n.time} ${n.title}.`
        : `Heute noch ${kommendeMitZeit.length} Termine — als Nächstes ${n.time} ${n.title}.`,
    );
  } else if (hatteTermine) {
    saetze.push("Die Termine für heute sind geschafft.");
  } else if (input.naechster) {
    saetze.push(
      `Heute ist nichts im Kalender — als Nächstes ${input.naechster.tagLabel} ${input.naechster.time} ${input.naechster.title}.`,
    );
  } else {
    saetze.push("Die nächsten Tage sind frei.");
  }

  const betreuung = kommendeMitZeit.filter((e) => e.careOffen).length;
  if (betreuung > 0) {
    saetze.push(betreuung === 1 ? "Einmal ist die Betreuung noch offen." : `${betreuung}× ist die Betreuung noch offen.`);
  }
  if (input.aufgabenHeute > 0) {
    saetze.push(
      input.aufgabenHeute === 1
        ? "Eine Aufgabe ist heute fällig."
        : `${input.aufgabenHeute} Aufgaben sind heute fällig.`,
    );
  }

  if (saetze.length === 1 && kommendeMitZeit.length === 0) saetze.push("Nichts offen.");
  return saetze.join(" ");
}
