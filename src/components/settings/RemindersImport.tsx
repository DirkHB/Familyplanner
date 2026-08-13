"use client";

import { useState, useTransition } from "react";
import {
  discoverRemindersAction,
  importRemindersAction,
  importPastedListAction,
} from "@/app/einstellungen/actions";
import { MAX_NAME_LAENGE } from "@/lib/names";

/**
 * Erinnerungen übernehmen — einmalig.
 *
 * Hauptweg ist Kopieren und Einfügen: Apple gibt modernisierte
 * Erinnerungslisten (seit iOS 13) über CalDAV nicht mehr heraus, und eine
 * andere Schnittstelle gibt es nicht. Die Zwischenablage geht immer — auch
 * aus jeder anderen Listen-App. Der CalDAV-Blick bleibt als zweiter Weg für
 * alte, nie umgestellte Listen.
 */

type Liste = {
  url: string;
  name: string;
  offen: number;
  erledigt: number;
  schonUebernommen: boolean;
};

export function RemindersImport() {
  // Kein eigener Karten-Rahmen: Die Einstellungen stellen die Zeile.
  return (
    <div>
      <p className="text-sm text-ink-muted">
        Aus Apple Erinnerungen oder jeder anderen App: Liste öffnen, alle markieren, kopieren
        — und hier einfügen. Eine Zeile wird eine Aufgabe.
      </p>
      <PasteImport />
      <CaldavImport />
    </div>
  );
}

function PasteImport() {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [meldung, setMeldung] = useState<{ gut: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const zeilen = text.split(/\r?\n/).filter((z) => z.trim()).length;

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setMeldung(null);
        }}
        maxLength={MAX_NAME_LAENGE}
        placeholder="Name der Liste — z. B. To Do C&D"
        className="rounded-card border border-surface-muted bg-bg px-4 py-2.5 text-[15px] outline-none focus:border-accent"
      />
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setMeldung(null);
        }}
        rows={6}
        placeholder={"Hier einfügen …\nWindeln bestellen\nKindergeld beantragen\n…"}
        className="rounded-card border border-surface-muted bg-bg px-4 py-3 text-[15px] outline-none focus:border-accent"
      />
      <button
        disabled={pending || !name.trim() || !text.trim()}
        onClick={() =>
          start(async () => {
            const r = await importPastedListAction(name, text);
            if (r.ok) {
              setText("");
              setMeldung({
                gut: true,
                text: `${r.uebernommen} übernommen${r.uebersprungen ? `, ${r.uebersprungen} waren schon da` : ""}.`,
              });
            } else {
              setMeldung({ gut: false, text: r.grund ?? "Hat nicht geklappt." });
            }
          })
        }
        className="rounded-pill bg-accent px-5 py-3 font-medium text-surface disabled:opacity-50"
      >
        {pending
          ? "Übernehme …"
          : zeilen > 0
            ? `${zeilen} ${zeilen === 1 ? "Zeile" : "Zeilen"} als Liste übernehmen`
            : "Als Liste übernehmen"}
      </button>
      {meldung && (
        <p className={`text-sm font-medium ${meldung.gut ? "text-accent" : "text-signal"}`}>
          {meldung.text}
        </p>
      )}
    </div>
  );
}

/** Zweiter Weg: alte, nie auf das neue Format umgestellte Listen via CalDAV. */
function CaldavImport() {
  const [listen, setListen] = useState<Liste[] | null>(null);
  const [ergebnis, setErgebnis] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <div className="mt-5 border-t border-surface-muted/60 pt-4">
      {listen === null ? (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await discoverRemindersAction();
              setListen(r.listen);
            })
          }
          className="text-sm font-medium text-accent disabled:opacity-60"
        >
          {pending ? "Suche …" : "Alte Erinnerungslisten direkt aus iCloud holen"}
        </button>
      ) : listen.length === 0 || listen.every((l) => l.offen + l.erledigt === 0) ? (
        <p className="text-sm text-ink-muted">
          {listen.length === 0
            ? "Über iCloud ist keine Erinnerungsliste erreichbar."
            : "Die über iCloud erreichbaren Listen sind leer."}{" "}
          Das ist normal: Apple gibt modernisierte Erinnerungen (seit iOS 13) nach außen nicht
          mehr heraus. Der Weg oben über Einfügen geht immer.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {listen.map((l) => (
            <li key={l.url} className="rounded-card bg-bg p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{l.name}</p>
                  <p className="text-sm text-ink-muted">
                    {l.offen} offen
                    {l.erledigt > 0 && ` · ${l.erledigt} erledigt (bleiben drüben)`}
                  </p>
                </div>
                <button
                  disabled={pending || l.offen === 0}
                  onClick={() =>
                    start(async () => {
                      const r = await importRemindersAction(l.url);
                      setErgebnis((e) => ({
                        ...e,
                        [l.url]: r.ok
                          ? `${r.uebernommen} übernommen${r.uebersprungen ? `, ${r.uebersprungen} waren schon da` : ""}.`
                          : (r.grund ?? "Hat nicht geklappt."),
                      }));
                    })
                  }
                  className="shrink-0 rounded-pill bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-50"
                >
                  Übernehmen
                </button>
              </div>
              {l.schonUebernommen && !ergebnis[l.url] && (
                <p className="mt-1.5 text-xs text-ink-muted">
                  Eine Liste mit diesem Namen gibt es hier schon. Nochmal übernehmen legt
                  nichts doppelt an.
                </p>
              )}
              {ergebnis[l.url] && (
                <p className="mt-1.5 text-sm font-medium text-accent">{ergebnis[l.url]}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
