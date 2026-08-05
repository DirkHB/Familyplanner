/**
 * Der Satz für den Aufgaben-Anstoß, ohne KI.
 *
 * Er ist nicht der Notnagel, sondern die Untergrenze: Was hier steht, kommt
 * auch dann an, wenn kein Schlüssel gesetzt ist oder der Dienst schweigt.
 * Deshalb reine Logik ohne Netz und ohne Datenbank.
 */

export type VorschlagKontext = {
  /** „14:00–16:30" oder null, wenn heute kein Fenster mehr kommt. */
  fenster: string | null;
  fensterMinuten: number | null;
  /** Offene Aufgaben, die dieser Person gehören — Titel plus Fälligkeit. */
  aufgaben: { titel: string; faellig: string | null; liste: string | null }[];
  /** Freie Blöcke von morgen, falls heute nichts mehr geht. */
  morgenFrei: string[];
};

export function nuechternerVorschlag(k: VorschlagKontext): string {
  const erste = k.aufgaben[0]?.titel;
  if (!erste) return "Nichts Offenes — der Tag gehört euch.";
  if (k.fenster) {
    const weitere = k.aufgaben.length - 1;
    return `Jetzt ist Luft bis ${k.fenster.split("–")[1]} — Zeit für „${erste}"${
      weitere > 0 ? ` und ${weitere} weitere` : ""
    }.`;
  }
  if (k.morgenFrei.length) return `Heute wird es eng. Morgen ${k.morgenFrei[0]} wäre Zeit für „${erste}".`;
  return `Noch offen: „${erste}".`;
}

/** Was die KI als Lage vorgelegt bekommt — knapp und ohne Deutung. */
export function kontextText(k: VorschlagKontext): string {
  const zeilen: string[] = [];
  zeilen.push(
    k.fenster
      ? `FREIES FENSTER JETZT: ${k.fenster} (${k.fensterMinuten} Minuten)`
      : "HEUTE KEIN FREIES FENSTER MEHR",
  );
  if (!k.fenster) {
    zeilen.push(`FREIE BLÖCKE MORGEN: ${k.morgenFrei.length ? k.morgenFrei.join(", ") : "keine"}`);
  }
  zeilen.push("OFFENE AUFGABEN:");
  for (const a of k.aufgaben) {
    zeilen.push(`- ${a.titel}${a.faellig ? ` (${a.faellig})` : ""}${a.liste ? ` [${a.liste}]` : ""}`);
  }
  return zeilen.join("\n");
}
