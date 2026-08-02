"use client";

import { useState, useTransition } from "react";
import { discoverRemindersAction, importRemindersAction } from "@/app/einstellungen/actions";

/**
 * Erinnerungen aus iCloud übernehmen — einmalig.
 *
 * Bewusst in zwei Schritten: erst nachsehen, was da ist, dann Liste für Liste
 * übernehmen. Ein Knopf „alles holen" würde beim ersten Tippen Hunderte
 * Aufgaben anlegen, und niemand wüsste vorher, welche.
 */

type Liste = {
  url: string;
  name: string;
  offen: number;
  erledigt: number;
  schonUebernommen: boolean;
};

export function RemindersImport() {
  const [listen, setListen] = useState<Liste[] | null>(null);
  const [ergebnis, setErgebnis] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  return (
    <section className="mt-4 rounded-card bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg">Aus iCloud Erinnerungen übernehmen</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Holt eure Erinnerungslisten einmalig als Aufgaben herüber. In iCloud wird nichts
        verändert und nichts gelöscht — abgehaktes bleibt draußen.
      </p>

      {listen === null ? (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await discoverRemindersAction();
              setListen(r.listen);
            })
          }
          className="mt-4 w-full rounded-pill bg-surface-muted px-5 py-3 font-medium text-ink disabled:opacity-60"
        >
          {pending ? "Suche …" : "Nachsehen, was da ist"}
        </button>
      ) : listen.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          Keine Erinnerungslisten gefunden. Prüf in den Einstellungen deines iPhones, ob
          Erinnerungen mit iCloud abgeglichen werden.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
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
                <p className="mt-1.5 text-xs text-ink-muted/80">
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
    </section>
  );
}
