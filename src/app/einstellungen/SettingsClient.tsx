"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { EnableNotifications } from "@/components/push/EnableNotifications";
import {
  connectAction,
  toggleCalendarAction,
  setSchreibKalenderAction,
  syncNowAction,
  disconnectAction,
  sendTestPushAction,
  setCareBlocksAction,
  bloeckeNeuSchreibenAction,
  setPushPrefAction,
  setHaushaltNamenAction,
  setTagesfensterAction,
  createTodoListAction,
  renameTodoListAction,
  deleteTodoListAction,
  createStoreAction,
  renameStoreAction,
  deleteStoreAction,
} from "./actions";
import { FaecherEditor, type Fach } from "@/components/settings/FaecherEditor";
import { RemindersImport } from "@/components/settings/RemindersImport";
import { ConnectForm } from "@/components/settings/ConnectForm";
import { PartnerEinladen } from "@/components/settings/PartnerEinladen";
import { AboForm } from "@/components/settings/AboForm";
import { GoogleForm } from "@/components/settings/GoogleForm";

/**
 * Einstellungen als gruppierte Liste mit einem einzigen Aufklapp-Muster.
 *
 * Vorher stand hier alles als gleichrangige, gleich schwere Karte
 * untereinander — acht Themen, keine Ordnung, viel Text. Einstellungen werden
 * selten besucht; wer herkommt, sucht genau eine Sache. Deshalb: drei
 * benannte Gruppen, jede Zeile eine Zeile, Details erst nach dem Antippen.
 * Das ist das Einstellungs-Idiom, das Constanze und Dirk vom iPhone kennen.
 */

type Cal = {
  id: string;
  name: string;
  isSynced: boolean;
  lastSyncedLabel: string | null;
  lastSyncOk: boolean;
  lastError: string | null;
};
type Account = {
  id: string;
  username: string;
  calendars: Cal[];
  /** Der Kalender, in den die App für mich schreibt. Leer = erstbester. */
  schreibKalenderId: string | null;
} | null;

export type Diagnose = {
  name: string;
  isSynced: boolean;
  termine: number;
  mitOrganizer: number;
  mitAttendee: number;
  ersteller: { mail: string; anzahl: number }[];
  titelMitName: number;
};

export function SettingsClient({
  account,
  diagnose = [],
  abgewinkt = [],
  careBlocks = false,
  todoLists = [],
  stores = [],
  tagVon = null,
  tagBis = null,
  pushPrefs = { requests: true, taskWindow: true },
  fremdeVerbindung = null,
  haushalt = { erwachsene: [], kind: "das Baby" },
  istVerwaltung = false,
  partner = { schonZuZweit: true, eingeladen: null },
  abos = [],
  googles = [],
  dienstadresse = null,
}: {
  account: Account;
  diagnose?: Diagnose[];
  abgewinkt?: string[];
  careBlocks?: boolean;
  todoLists?: Fach[];
  stores?: Fach[];
  tagVon?: number | null;
  tagBis?: number | null;
  /** Welche der beiden selbsttätigen Mitteilungen eingeschaltet sind. */
  pushPrefs?: { requests: boolean; taskWindow: boolean };
  /** Kein eigenes iCloud-Konto, aber der Haushalt hat eins — wessen? */
  fremdeVerbindung?: { name: string } | null;
  /** Die beiden Erwachsenen und der Name des Kindes. */
  haushalt?: { erwachsene: { email: string; name: string }[]; kind: string };
  /** Darf neue Haushalte einladen — sieht genau eine Person. */
  istVerwaltung?: boolean;
  /** Ob die zweite Person schon da ist, und an wen eine Einladung unterwegs ist. */
  partner?: { schonZuZweit: boolean; eingeladen: string | null };
  /** Abonnierte Kalender — nur lesend, deshalb getrennt von der Verbindung. */
  abos?: { id: string; name: string }[];
  /** Verbundene Google-Kalender — lesen UND schreiben. */
  googles?: { id: string; name: string }[];
  /** Die Adresse, die man seinem Google-Kalender freigeben muss. */
  dienstadresse?: string | null;
}) {
  const termineGesamt = diagnose.reduce((n, d) => n + d.termine, 0);

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-16 pt-6">
        <header className="mb-2 flex items-center gap-3">
          <Link
            href="/woche"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card"
            aria-label="Zurück"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="font-display text-3xl">Einstellungen</h1>
        </header>

        <Gruppe titel="Verbindung">
          {/* Ohne Verbindung ist das Formular die ganze Seite wert — dann
              steht die Zeile offen. Verbunden reicht die eine Statuszeile. */}
          <Zeile
            titel="iCloud-Kalender"
            status={
              account ? account.username : fremdeVerbindung ? "Über den Haushalt" : "Nicht verbunden"
            }
            defaultOffen={!account && !fremdeVerbindung}
          >
            {account ? (
              <Connected account={account} />
            ) : fremdeVerbindung ? (
              <>
                <p className="text-sm text-ink-muted">
                  Der gemeinsame Kalender hängt an der Verbindung von{" "}
                  <span className="font-medium text-ink">{fremdeVerbindung.name}</span>. Du siehst
                  alle Termine und kannst welche anlegen — ein eigenes iCloud-Konto brauchst du
                  dafür nicht.
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-medium text-accent">
                    Eigenes Konto verbinden
                  </summary>
                  <div className="mt-3">
                    <ConnectForm />
                  </div>
                </details>
              </>
            ) : (
              <ConnectForm />
            )}
          </Zeile>
          {/* Der zweite Weg mit Rückweg. Steht zwischen iCloud und dem
              Abonnement, weil er beides kann: lesen und schreiben. */}
          <Zeile
            titel="Google-Kalender"
            status={googles.length > 0 ? `${googles.length}` : "Nicht verbunden"}
          >
            {googles.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {googles.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {g.name}
                      <span className="text-ink-muted"> · lesen und schreiben</span>
                    </span>
                    <button
                      onClick={() => disconnectAction(g.id)}
                      className="shrink-0 text-sm text-ink-muted underline"
                    >
                      trennen
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <GoogleForm dienstadresse={dienstadresse} />
          </Zeile>

          {/* Der zweite Weg herein: für Kalender, die die App nicht selbst
              anbinden kann. Steht bewusst hinter dem iCloud-Weg — er ist die
              Ausnahme, nicht die Regel. */}
          <Zeile
            titel="Kalender abonnieren"
            status={abos.length > 0 ? `${abos.length}` : "Google & Co."}
          >
            {abos.length > 0 && (
              <ul className="mb-3 flex flex-col gap-1.5">
                {abos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {a.name}
                      <span className="text-ink-muted"> · nur lesend</span>
                    </span>
                    <button
                      onClick={() => disconnectAction(a.id)}
                      className="shrink-0 text-sm text-ink-muted underline"
                    >
                      entfernen
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <AboForm />
          </Zeile>

          <Zeile titel="Dein Tag" status={`${tagVon ?? 7}–${tagBis ?? 21} Uhr`}>
            <TagesfensterInhalt von={tagVon ?? 7} bis={tagBis ?? 21} />
          </Zeile>
          <Zeile titel="Mitteilungen" status="Ruhe 21–7 Uhr">
            <p className="text-sm text-ink-muted">
              Damit ihr erfahrt, was euch betrifft, ohne die App zu öffnen. Nachts ist Ruhe —
              von 21 bis 7 Uhr wird nichts zugestellt, sondern nachgeholt.
            </p>
            <div className="mt-3">
              <EnableNotifications />
            </div>
            {/* Die beiden Arten, die von selbst etwas verschicken. Alles
                andere hängt an einer Handlung und braucht keinen Schalter. */}
            <div className="mt-3 divide-y divide-surface-muted/60 border-t border-surface-muted/60">
              <SchalterZeile
                flach
                titel="Fragen mit Frist"
                ariaLabel="Mitteilung bei Fragen mit Frist"
                an={pushPrefs.requests}
                onSchalten={(neu) => setPushPrefAction("requests", neu)}
                hinweis="Wenn eine Frage an dich offen ist und der Termin dazu bald beginnt — dann meldet sich die App, statt bis zum nächsten Morgen zu warten."
              />
              <SchalterZeile
                flach
                titel="Aufgaben, wenn Zeit ist"
                ariaLabel="Täglicher Anstoß zu offenen Aufgaben"
                an={pushPrefs.taskWindow}
                onSchalten={(neu) => setPushPrefAction("taskWindow", neu)}
                hinweis="Einmal am Tag, sobald eine echte Lücke in deinem Tag beginnt — mit einem Vorschlag, was jetzt hineinpasst."
              />
            </div>
            <TestPush />
          </Zeile>
        </Gruppe>

        <Gruppe titel="Wer wohnt hier">
          <Zeile titel="Namen" status={haushalt.kind}>
            <NamenInhalt haushalt={haushalt} />
          </Zeile>
          {/* Nur solange jemand fehlt oder unterwegs ist — sind beide da, gibt
              es hier nichts zu entscheiden. */}
          {(!partner.schonZuZweit || partner.eingeladen) && (
            <Zeile
              titel="Zweite Person"
              status={partner.eingeladen ? "unterwegs" : "fehlt noch"}
              defaultOffen={!partner.schonZuZweit && !partner.eingeladen}
            >
              <PartnerEinladen
                schonZuZweit={partner.schonZuZweit}
                eingeladen={partner.eingeladen}
              />
            </Zeile>
          )}
          {istVerwaltung && (
            <Link
              href="/einladungen"
              className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left"
            >
              <span className="min-w-0 flex-1 font-medium">Einladungen</span>
              <span className="shrink-0 text-sm text-ink-muted">Neue Familien</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 text-ink-muted/70" aria-hidden>
                <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          )}
        </Gruppe>

        <Gruppe titel="Betreuung">
          <CareBlocksZeile an={careBlocks} />
          {abgewinkt.length > 0 && (
            <Zeile
              titel="Ohne Betreuungsfrage"
              status={`${abgewinkt.length} ${abgewinkt.length === 1 ? "Terminart" : "Terminarten"}`}
            >
              <p className="text-sm text-ink-muted">
                Bei diesen Terminen fragt die App nicht mehr, wer beim Kind ist:
              </p>
              <p className="mt-2 text-sm">{abgewinkt.join(" · ")}</p>
            </Zeile>
          )}
        </Gruppe>

        <Gruppe titel="Aufgaben & Einkauf">
          <Zeile titel="Aufgabenlisten" status={String(todoLists.length)}>
            <FaecherEditor
              erklaerung="Fächer für eure Aufgaben. Eine Aufgabe braucht keine Liste — der schnelle Eintrag zwischendurch soll nicht erst eine Einordnung verlangen."
              fachWort="Liste"
              restFach="Ohne Liste"
              faecher={todoLists}
              onCreate={createTodoListAction}
              onRename={renameTodoListAction}
              onDelete={deleteTodoListAction}
            />
          </Zeile>
          <Zeile titel="Läden" status={String(stores.length)}>
            <FaecherEditor
              erklaerung="Nach diesen Fächern ist die Einkaufsliste sortiert. Sonstiges ist immer da und fängt alles auf, was keinem Laden zugeordnet ist."
              fachWort="Laden"
              restFach="Sonstiges"
              faecher={stores}
              onCreate={createStoreAction}
              onRename={renameStoreAction}
              onDelete={deleteStoreAction}
            />
          </Zeile>
          <Zeile titel="Liste übernehmen" status="Einfügen">
            <RemindersImport />
          </Zeile>
        </Gruppe>

        {diagnose.length > 0 && (
          <Gruppe titel="Details">
            <Zeile titel="Eure Termine in Zahlen" status={`${termineGesamt} Termine`}>
              <DiagnoseInhalt diagnose={diagnose} />
            </Zeile>
          </Gruppe>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Grundbausteine ------------------------------ */

function Gruppe({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 px-1 text-sm font-medium text-ink-muted">{titel}</h2>
      <div className="divide-y divide-surface-muted/60 rounded-card bg-surface shadow-card">
        {children}
      </div>
    </section>
  );
}

/**
 * Eine Zeile mit Aufklappen — das eine Muster für alles. Der Kopf trägt
 * Titel und Kurzstatus; was mehr braucht, bekommt es erst nach dem Antippen.
 */
function Zeile({
  titel,
  status,
  defaultOffen = false,
  children,
}: {
  titel: string;
  status?: string;
  defaultOffen?: boolean;
  children: ReactNode;
}) {
  const [offen, setOffen] = useState(defaultOffen);
  return (
    <div>
      <button
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1 font-medium">{titel}</span>
        {status && (
          <span className="max-w-[45%] shrink-0 truncate text-sm text-ink-muted">{status}</span>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className="shrink-0 text-ink-muted/70"
          style={{ transform: offen ? "rotate(90deg)" : "none", transition: "transform 180ms" }}
          aria-hidden
        >
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {offen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

/**
 * Ein Schalter mit Beschriftung und Erklärung darunter. Der Schalter IST die
 * Handlung — es gibt nichts aufzuklappen, und er kippt sofort, statt auf den
 * Server zu warten.
 *
 * `flach` lässt den seitlichen Rand weg: Steht der Schalter schon in einer
 * aufgeklappten Zeile, bringt die ihren eigenen mit.
 */
function SchalterZeile({
  titel,
  hinweis,
  an,
  ariaLabel,
  onSchalten,
  flach = false,
}: {
  titel: string;
  hinweis: React.ReactNode;
  an: boolean;
  ariaLabel: string;
  onSchalten: (neu: boolean) => Promise<unknown>;
  flach?: boolean;
}) {
  const [pending, start] = useTransition();
  const [aktiv, setAktiv] = useState(an);
  return (
    <div className={`py-3 ${flach ? "" : "px-4"}`}>
      <div className="flex items-center gap-3">
        <span className="min-w-0 flex-1 font-medium">{titel}</span>
        <button
          role="switch"
          aria-checked={aktiv}
          aria-label={ariaLabel}
          disabled={pending}
          onClick={() => {
            const neu = !aktiv;
            setAktiv(neu);
            start(async () => {
              await onSchalten(neu);
            });
          }}
          className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors ${
            aktiv ? "bg-accent" : "bg-surface-muted"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 34 }}
            className="absolute top-0.5 h-6 w-6 rounded-full bg-surface shadow-card"
            style={{ left: aktiv ? 22 : 2 }}
          />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-muted">{hinweis}</p>
    </div>
  );
}

/**
 * Betreuung als echter Kalendereintrag. Standardmäßig aus: die einzige
 * Funktion, die von sich aus Einträge im gemeinsamen Kalender anlegt.
 */
/**
 * Namen des Haushalts. Sie stehen bewusst ganz oben unter „Wer wohnt hier":
 * Ohne sie spricht die App — und jeder KI-Text — von fremden Leuten.
 */
function NamenInhalt({
  haushalt,
}: {
  haushalt: { erwachsene: { email: string; name: string }[]; kind: string };
}) {
  const [namen, setNamen] = useState(haushalt.erwachsene);
  const [kind, setKind] = useState(haushalt.kind);
  const [pending, start] = useTransition();
  const [gesagt, setGesagt] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        So nennt euch die App — in den Karten, im Kalendereintrag und in jedem Text, den der
        Assistent schreibt.
      </p>
      {namen.map((p, i) => (
        <label key={p.email} className="block">
          <span className="text-xs text-ink-muted">{p.email}</span>
          <input
            value={p.name}
            onChange={(e) => {
              const wert = e.target.value;
              setNamen((alt) => alt.map((x, j) => (j === i ? { ...x, name: wert } : x)));
              setGesagt(null);
            }}
            className="mt-1 w-full rounded-card border border-surface-muted bg-bg px-4 py-2.5 outline-none focus:border-accent"
          />
        </label>
      ))}
      <label className="block">
        <span className="text-xs text-ink-muted">Name des Kindes</span>
        <input
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setGesagt(null);
          }}
          placeholder="wie das Kind heißt"
          className="mt-1 w-full rounded-card border border-surface-muted bg-bg px-4 py-2.5 outline-none focus:border-accent"
        />
      </label>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setHaushaltNamenAction({ kind, namen });
            setGesagt(r.ok ? "Gespeichert ✓" : (r.grund ?? "Hat nicht geklappt."));
          })
        }
        className="rounded-pill bg-accent px-5 py-3 font-medium text-surface disabled:opacity-60"
      >
        {pending ? "Speichere …" : "Namen speichern"}
      </button>
      {gesagt && <p className="text-sm text-ink-muted">{gesagt}</p>}
    </div>
  );
}

function CareBlocksZeile({ an }: { an: boolean }) {
  return (
    <SchalterZeile
      titel="Eintrag im Kalender"
      ariaLabel="Betreuung im Kalender eintragen"
      an={an}
      onSchalten={setCareBlocksAction}
      hinweis={
        <>
          Wer übernimmt, bekommt „👶 Kind · Name" in den gemeinsamen Kalender — sichtbar auf
          dem Sperrbildschirm. Nimmst du eine Zusage zurück, verschwindet der Eintrag.
          Der Schalter wirkt sofort auch auf alles, was schon abgesprochen ist.
          <BloeckeNeuSchreiben />
        </>
      }
    />
  );
}

/**
 * Der Reparaturweg für Blöcke, die schon falsch im Kalender stehen.
 *
 * Ein Kalendereintrag ist geschrieben und bleibt — er merkt nicht, dass die
 * App inzwischen anders rechnet. Was aus früheren Fehlern dort steht (zweimal
 * derselbe Eintrag, ein Platz-Wert statt eines Namens) verschwindet erst,
 * wenn jemand die Blöcke neu schreiben lässt.
 */
function BloeckeNeuSchreiben() {
  const [pending, start] = useTransition();
  const [fertig, setFertig] = useState<string | null>(null);

  return (
    <span className="mt-2 flex items-center gap-3">
      <button
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          start(async () => {
            const r = await bloeckeNeuSchreibenAction();
            setFertig(r.ok ? `${r.tage} Tage geprüft ✓` : "Hat nicht geklappt");
          });
        }}
        className="rounded-pill border border-ink-muted/30 px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-60"
      >
        {pending ? "Schreibe neu …" : "Blöcke neu schreiben"}
      </button>
      {fertig && <span className="text-xs text-ink-muted">{fertig}</span>}
    </span>
  );
}

/**
 * Tagesfenster für den Zeitstrahl der Woche — je Person. Zwischen Anfang und
 * Ende rechnet die Woche freie Blöcke aus; was davor oder danach liegt, ist
 * kein „frei", sondern Schlaf und Feierabend.
 */
function TagesfensterInhalt({ von, bis }: { von: number; bis: number }) {
  const [pending, start] = useTransition();
  const [wahlVon, setWahlVon] = useState(von);
  const [wahlBis, setWahlBis] = useState(bis);
  const [gespeichert, setGespeichert] = useState(false);
  const geaendert = wahlVon !== von || wahlBis !== bis;

  const stunden = (a: number, b: number) =>
    Array.from({ length: b - a + 1 }, (_, i) => a + i);

  return (
    <div>
      <p className="text-sm text-ink-muted">
        Zwischen diesen Stunden zeigt die Woche deinen Zeitstrahl und rechnet freie Blöcke
        aus. Gilt nur für dich.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <select
          value={wahlVon}
          onChange={(e) => { setWahlVon(Number(e.target.value)); setGespeichert(false); }}
          aria-label="Tagesanfang"
          className="min-w-0 flex-1 appearance-none rounded-card border border-surface-muted bg-bg px-3 py-2.5 text-base outline-none focus:border-accent"
        >
          {stunden(5, 12).map((h) => (
            <option key={h} value={h}>{h} Uhr</option>
          ))}
        </select>
        <span className="text-ink-muted">bis</span>
        <select
          value={wahlBis}
          onChange={(e) => { setWahlBis(Number(e.target.value)); setGespeichert(false); }}
          aria-label="Tagesende"
          className="min-w-0 flex-1 appearance-none rounded-card border border-surface-muted bg-bg px-3 py-2.5 text-base outline-none focus:border-accent"
        >
          {stunden(17, 24).map((h) => (
            <option key={h} value={h}>{h} Uhr</option>
          ))}
        </select>
      </div>
      {geaendert && (
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await setTagesfensterAction(wahlVon, wahlBis);
              if (r.ok) setGespeichert(true);
            })
          }
          className="mt-3 w-full rounded-pill bg-accent px-5 py-2.5 text-sm font-medium text-surface disabled:opacity-60"
        >
          {pending ? "Speichere …" : "Übernehmen"}
        </button>
      )}
      {gespeichert && !geaendert && (
        <p className="mt-2 text-sm font-medium text-accent">Gespeichert.</p>
      )}
    </div>
  );
}

/* ------------------------------ iCloud ------------------------------ */

function Connected({ account }: { account: NonNullable<Account> }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  function syncNow() {
    start(async () => {
      const r = await syncNowAction();
      setResult(
        r.ok
          ? `Fertig · ${r.upserted} aktualisiert, ${r.deleted} entfernt${
              r.errorCount ? `, ${r.errorCount} Fehler` : ""
            }`
          : "Sync fehlgeschlagen",
      );
    });
  }

  return (
    <div>
      <ul className="flex flex-col divide-y divide-surface-muted/60">
        {account.calendars.map((cal) => (
          <CalRow
            key={cal.id}
            cal={cal}
            disabled={pending}
            onToggle={(v) => start(() => toggleCalendarAction(cal.id, v))}
          />
        ))}
        {account.calendars.length === 0 && (
          <li className="py-3 text-sm text-ink-muted">Keine Kalender gefunden.</li>
        )}
      </ul>

      <SchreibKalender account={account} disabled={pending} />

      <div className="mt-3 flex items-center justify-between border-t border-surface-muted/60 pt-3">
        <button
          onClick={syncNow}
          disabled={pending}
          className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-60"
        >
          {pending ? "läuft …" : "Jetzt synchronisieren"}
        </button>
        <button
          onClick={() => start(() => disconnectAction(account.id))}
          className="px-2 text-sm text-signal"
        >
          Trennen
        </button>
      </div>
      {result && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-sm text-ink-muted">
          {result}
        </motion.p>
      )}
    </div>
  );
}

/**
 * In welchen Kalender die App für mich schreibt.
 *
 * Ohne diese Wahl nimmt sie den erstbesten — und wer selbst kein Konto
 * verbunden hat, schreibt damit in den Kalender des anderen. Das ist der
 * Unterschied zwischen „unser gemeinsamer Plan" und „jemand trägt in meinem
 * Kalender herum".
 *
 * Nur die eigenen Kalender stehen zur Wahl. Den des anderen anzubieten hieße,
 * genau den Fehler wieder einzubauen, den die Wahl verhindern soll.
 */
function SchreibKalender({ account, disabled }: { account: NonNullable<Account>; disabled: boolean }) {
  const [gewaehlt, setGewaehlt] = useState(account.schreibKalenderId);
  const [pending, start] = useTransition();
  const offen = account.calendars.filter((c) => c.isSynced);
  if (offen.length === 0) return null;

  return (
    <div className="mt-4 border-t border-surface-muted/60 pt-4">
      <p className="font-medium">Neue Termine landen in</p>
      <p className="mt-0.5 text-sm text-ink-muted">
        Was du hier anlegst, wird in diesen Kalender geschrieben. Die anderen
        liest die App nur mit.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {offen.map((cal) => {
          const aktiv = gewaehlt === cal.id || (!gewaehlt && cal.id === offen[0].id);
          return (
            <button
              key={cal.id}
              disabled={disabled || pending}
              onClick={() => {
                setGewaehlt(cal.id);
                start(() => setSchreibKalenderAction(cal.id).then(() => undefined));
              }}
              className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                aktiv ? "bg-accent text-surface" : "bg-surface-muted text-ink"
              }`}
            >
              {cal.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalRow({
  cal,
  disabled,
  onToggle,
}: {
  cal: Cal;
  disabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <li className="flex items-center justify-between py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{cal.name}</p>
        <p className="text-xs text-ink-muted">
          {cal.lastError ? (
            <span className="text-signal">Fehler: {cal.lastError}</span>
          ) : cal.lastSyncedLabel ? (
            `zuletzt ${cal.lastSyncedLabel}`
          ) : (
            "noch nicht synchronisiert"
          )}
        </p>
      </div>
      <button
        role="switch"
        aria-checked={cal.isSynced}
        disabled={disabled}
        onClick={() => onToggle(!cal.isSynced)}
        className={`relative h-7 w-12 shrink-0 rounded-pill transition-colors ${
          cal.isSynced ? "bg-accent" : "bg-surface-muted"
        }`}
      >
        <span
          className="absolute top-0.5 h-6 w-6 rounded-full bg-surface transition-all"
          style={{ left: cal.isSynced ? 22 : 2 }}
        />
      </button>
    </li>
  );
}

/* ------------------------------ Mitteilungen ------------------------------ */

function TestPush() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <div className="mt-3 border-t border-surface-muted/60 pt-3">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await sendTestPushAction();
            if (r.devices === 0) {
              setResult(
                "Kein Gerät registriert. Erst oben Benachrichtigungen aktivieren — auf dem iPhone geht das nur in der installierten App (Teilen → Zum Home-Bildschirm).",
              );
            } else {
              setResult(
                `An ${r.sent} von ${r.devices} Gerät${r.devices === 1 ? "" : "en"} gesendet — kam sie an?` +
                  (r.quiet ? " (Hinweis: Gerade sind Ruhezeiten — normale Pushes pausieren 21–7 Uhr, dieser Test nicht.)" : ""),
              );
            }
          })
        }
        className="text-sm font-medium text-accent"
      >
        {pending ? "Sende …" : "Test-Benachrichtigung an mich senden"}
      </button>
      {result && <p className="mt-2 text-sm text-ink-muted">{result}</p>}
    </div>
  );
}

/* ------------------------------ Details ------------------------------ */

/**
 * Was steht in unseren Terminen? Grundlage für die Frage, ob wir „wer ist
 * gebunden?" von Hand pflegen müssen — oder ob iCloud es uns schon verrät.
 */
function DiagnoseInhalt({ diagnose }: { diagnose: Diagnose[] }) {
  const mitErsteller = diagnose.reduce((n, d) => n + d.mitOrganizer, 0);
  const mitName = diagnose.reduce((n, d) => n + d.titelMitName, 0);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Bei {mitErsteller} Terminen steht, wer sie angelegt hat · {mitName} tragen einen Namen
        im Titel.
      </p>
      {diagnose.map((d) => (
        <div key={d.name} className="rounded-card bg-bg p-3">
          <p className="font-medium">
            {d.name}
            {!d.isSynced && <span className="ml-2 text-xs text-ink-muted">(aus)</span>}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {d.termine} Termine · {d.mitOrganizer} mit Ersteller · {d.mitAttendee} mit
            Teilnehmern · {d.titelMitName} mit Namen im Titel
          </p>
          {d.ersteller.length > 0 && (
            <ul className="mt-1.5 flex flex-col gap-0.5">
              {d.ersteller.map((e) => (
                <li key={e.mail} className="truncate text-xs text-ink-muted">
                  {e.mail} — {e.anzahl}×
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <p className="text-xs text-ink-muted/80">
        Steht bei vielen Terminen ein Ersteller, kann die App von allein erkennen, wen ein
        Termin bindet. Sonst fragt sie einmal je Termin-Art nach.
      </p>
    </div>
  );
}
