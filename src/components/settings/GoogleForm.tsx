"use client";

import { useActionState, useState } from "react";
import { verbindeGoogleAction } from "@/app/einstellungen/actions";

/**
 * Einen Google-Kalender verbinden — mit Schreibrecht.
 *
 * Der Weg dorthin führt durch Googles Einstellungen und hat mehr Handgriffe,
 * als uns lieb ist. Das liegt nicht an uns: Google hat CalDAV mit Passwort im
 * März 2025 abgeschaltet, und der bequeme Weg („Mit Google verbinden",
 * Konto wählen, zulassen) setzt eine geprüfte App voraus. Solange die Prüfung
 * nicht durch ist, bleibt dieser hier.
 *
 * Deshalb führt das Formular durch die Schritte, statt zwei Felder hinzustellen
 * und das Beste zu hoffen. Die Dienstadresse steht zum Antippen bereit — sie
 * ist der Schritt, der am ehesten schiefgeht, weil man sie abtippen müsste.
 */
export function GoogleForm({ dienstadresse }: { dienstadresse: string | null }) {
  const [state, action, pending] = useActionState(verbindeGoogleAction, {
    error: null as string | null,
  });
  const [kopiert, setKopiert] = useState(false);

  if (!dienstadresse) {
    return (
      <p className="text-sm text-ink-muted">
        Der Google-Weg ist auf diesem Server noch nicht eingerichtet. Es fehlen die
        Zugangsdaten des Dienstkontos.
      </p>
    );
  }

  if (state?.gefunden !== undefined && !state.error) {
    return (
      <p className="text-sm text-ink-muted">
        Verbunden ✓ <span className="text-ink">{state.name}</span> — {state.gefunden}{" "}
        {state.gefunden === 1 ? "Termin" : "Termine"} gefunden. Neue Termine kannst du ab jetzt
        auch hierher schreiben.
      </p>
    );
  }

  const kopiere = async () => {
    try {
      await navigator.clipboard.writeText(dienstadresse);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      /* Ohne Zwischenablage bleibt die Adresse ja lesbar dastehen. */
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Damit landen deine Termine in deinem Google-Kalender — und du kannst von hier aus welche
        anlegen. Drei Schritte, alle in Google Kalender am Rechner.
      </p>

      <ol className="flex flex-col gap-3 text-sm text-ink-muted">
        <li>
          <span className="font-medium text-ink">1. Kalender freigeben.</span> Einstellungen →
          links auf deinen Kalender → „Für bestimmte Personen oder Gruppen freigeben" → diese
          Adresse eintragen, Berechtigung{" "}
          <span className="text-ink">„Änderungen an Terminen vornehmen"</span>:
          <button
            type="button"
            onClick={kopiere}
            className="mt-2 flex w-full items-center gap-2 rounded-card border border-surface-muted bg-bg px-3 py-2 text-left"
          >
            <code className="min-w-0 flex-1 truncate text-xs text-ink">{dienstadresse}</code>
            <span className="shrink-0 text-xs font-medium text-accent">
              {kopiert ? "kopiert ✓" : "kopieren"}
            </span>
          </button>
        </li>
        <li>
          <span className="font-medium text-ink">2. Kalender-ID holen.</span> Auf derselben Seite
          weiter unten unter „Kalender integrieren". Beim Hauptkalender ist es deine eigene
          Adresse.
        </li>
        <li>
          <span className="font-medium text-ink">3. Geheime iCal-Adresse holen.</span> Ebenfalls
          dort. Sie endet auf <code className="text-xs">.ics</code> — nicht die öffentliche
          Web-Adresse nehmen.
        </li>
      </ol>

      <form action={action} className="flex flex-col gap-2.5">
        <input
          name="kalenderId"
          required
          autoComplete="off"
          placeholder="Kalender-ID (z. B. johanna@gmail.com)"
          className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
        />
        <input
          name="feedUrl"
          inputMode="url"
          required
          autoComplete="off"
          placeholder="Geheime Adresse im iCal-Format (…/basic.ics)"
          className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
        />
        <input
          name="name"
          autoComplete="off"
          placeholder="Wie soll er heißen? (z. B. Johanna)"
          className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-accent px-5 py-3 font-medium text-surface disabled:opacity-60"
        >
          {pending ? "Probiere es aus …" : "Verbinden"}
        </button>
        {state?.error && <p className="text-sm text-signal">{state.error}</p>}
      </form>

      <p className="text-sm text-ink-muted">
        Beim Verbinden wird wirklich ausprobiert: Die App legt einen Termin an und löscht ihn
        sofort wieder. Anders lässt sich nicht feststellen, ob die Freigabe wirklich zum
        Schreiben berechtigt — und ein Fehler soll jetzt auffallen, nicht in drei Tagen.
      </p>
      <p className="text-sm text-ink-muted">
        Die iCal-Adresse ist ein Geheimnis: Wer sie hat, sieht den Kalender. Sie wird
        verschlüsselt gespeichert und nirgends wieder angezeigt.
      </p>
    </div>
  );
}
