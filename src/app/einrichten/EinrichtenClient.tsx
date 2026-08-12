"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { ConnectForm } from "@/components/settings/ConnectForm";
import { GoogleForm } from "@/components/settings/GoogleForm";
import { NeuesFachChip } from "@/components/ui/NeuesFachChip";
import {
  setHaushaltNamenAction,
  createTodoListAction,
  createStoreAction,
  importPastedListAction,
} from "@/app/einstellungen/actions";
import {
  ladePartnerEinAction,
  ziehPartnerEinladungZurueckAction,
  einrichtungFertigAction,
} from "./actions";
import { LinkZumWeitergeben } from "@/components/ui/LinkZumWeitergeben";
import type { EinrichtungStatus, SchrittName } from "@/lib/haushalt/einrichtung";

/**
 * Der Einrichtungs-Assistent — einmal, beim ersten Mal.
 *
 * Ein Schritt je Bild, weil Einrichtung am Handy stattfindet und eine lange
 * Seite mit fünf Formularen dort niemand ausfüllt. Jeder Schritt ist
 * überspringbar: Wer nur den Kalender will, soll nicht an einer Einkaufsliste
 * scheitern. Was schon erledigt ist, erkennt der Assistent selbst und hakt es
 * ab, statt danach zu fragen.
 */

const TITEL: Record<SchrittName, string> = {
  namen: "Wer seid ihr?",
  kalender: "Euer Kalender",
  partner: "Die zweite Person",
  aufgaben: "Was steht an?",
  faecher: "Listen und Läden",
};

const REIHENFOLGE: SchrittName[] = ["namen", "kalender", "partner", "aufgaben", "faecher"];

export function EinrichtenClient({
  status,
  meineEmail,
  dienstadresse = null,
}: {
  status: EinrichtungStatus;
  meineEmail: string;
  /** Die Adresse, die man seinem Google-Kalender freigeben muss. */
  dienstadresse?: string | null;
}) {
  const router = useRouter();
  // Beginn beim ersten offenen Schritt — Erledigtes wird nicht noch einmal gefragt.
  const [i, setI] = useState(() => {
    const erster = REIHENFOLGE.findIndex((s) => !status.erledigt[s]);
    return erster === -1 ? 0 : erster;
  });
  const [erledigt, setErledigt] = useState(status.erledigt);
  const [pending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  /**
   * Die Eingaben wohnen hier oben, nicht in den Schritten.
   *
   * Sonst gäbe es zwei Knöpfe, die weiterführen — einen im Schritt, einen im
   * Fuß —, und wer den falschen nimmt, verliert seine Eingabe. Genau daran
   * scheitert eine Einrichtung: nicht am Verstehen, sondern am Vertippen.
   */
  const [namen, setNamen] = useState(status.erwachsene);
  const [kindName, setKindName] = useState(status.kind === "das Baby" ? "" : status.kind);
  const [listenName, setListenName] = useState("Diese Woche");
  const [aufgabenText, setAufgabenText] = useState("");

  const schritt = REIHENFOLGE[i];
  const letzter = i === REIHENFOLGE.length - 1;
  // Auf dem Kalender-Schritt führt das Verbinden-Formular; der Fuß tritt
  // zurück, damit nicht zwei Knöpfe um dieselbe Aufmerksamkeit werben.
  const zurueckhaltend = schritt === "kalender" && !erledigt.kalender;
  const sichertEtwas =
    (schritt === "namen" && (kindName.trim() !== "" || namen.some((n) => n.name.trim()))) ||
    (schritt === "aufgaben" && aufgabenText.trim() !== "");
  const offen = REIHENFOLGE.filter((s) => !erledigt[s]).length;

  /**
   * Weiter heißt: erst sichern, was auf diesem Schritt eingegeben wurde.
   * Schlägt das Sichern fehl, bleibt man stehen und liest, warum.
   */
  function weiter() {
    setFehler(null);
    start(async () => {
      if (schritt === "namen" && (kindName.trim() || namen.some((n) => n.name.trim()))) {
        const r = await setHaushaltNamenAction({ kind: kindName, namen });
        if (!r.ok) return setFehler(r.grund ?? "Hat nicht geklappt.");
        abhaken("namen");
      }
      if (schritt === "aufgaben" && aufgabenText.trim()) {
        const r = await importPastedListAction(listenName, aufgabenText);
        if (!r.ok) return setFehler(r.grund ?? "Hat nicht geklappt.");
        setAufgabenText("");
        abhaken("aufgaben");
      }
      // Zum nächsten OFFENEN Schritt, nicht stur zum nächsten. Ein Haushalt,
      // dem nur der Name des Kindes fehlt, soll nicht durch vier abgehakte
      // Bildschirme tippen müssen.
      const naechster = REIHENFOLGE.findIndex((s, n) => n > i && !erledigt[s] && s !== schritt);
      if (naechster === -1) return fertig();
      setI(naechster);
    });
  }

  function fertig() {
    start(async () => {
      await einrichtungFertigAction();
      router.replace("/woche");
    });
  }

  function abhaken(s: SchrittName) {
    setErledigt((e) => ({ ...e, [s]: true }));
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10 pt-8">
        <header>
          <p className="eyebrow text-ink-muted">
            Schritt {i + 1} von {REIHENFOLGE.length}
          </p>
          <h1 className="mt-1 font-display text-4xl leading-tight">{TITEL[schritt]}</h1>
          {/* Fortschritt als schmale Leiste — kein Prozentwert, nur ein Gefühl. */}
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {REIHENFOLGE.map((s, n) => (
              <span
                key={s}
                className={`h-1 flex-1 rounded-pill transition-colors ${
                  erledigt[s] ? "bg-accent" : n === i ? "bg-ink" : "bg-surface-muted"
                }`}
              />
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 py-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={schritt}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {schritt === "namen" && (
                <SchrittNamen
                  namen={namen}
                  kind={kindName}
                  onNamen={setNamen}
                  onKind={setKindName}
                />
              )}
              {schritt === "kalender" && (
                <SchrittKalender
                  erledigt={erledigt.kalender}
                  dienstadresse={dienstadresse}
                />
              )}
              {schritt === "partner" && (
                <SchrittPartner status={status} />
              )}
              {schritt === "aufgaben" && (
                <SchrittAufgaben
                  listenName={listenName}
                  text={aufgabenText}
                  onListenName={setListenName}
                  onText={setAufgabenText}
                />
              )}
              {schritt === "faecher" && <SchrittFaecher onFertig={() => abhaken("faecher")} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Weiter unten, wo der Daumen liegt. „Überspringen" steht daneben und
            nicht kleiner — ein Schritt, den man nicht überspringen kann, ist
            keine Einrichtung, sondern eine Hürde. */}
        {fehler && <p className="mb-3 text-sm text-signal">{fehler}</p>}
        <footer>
          <button
            onClick={weiter}
            disabled={pending}
            className={
              zurueckhaltend
                ? "w-full rounded-pill border border-ink/15 px-5 py-3.5 font-medium text-ink disabled:opacity-60"
                : "w-full rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-60"
            }
          >
            {pending ? "Einen Moment …" : letzter ? "Fertig" : sichertEtwas ? "Speichern und weiter" : "Weiter"}
          </button>
        </footer>
        {i === 0 && offen > 0 && (
          <button
            onClick={fertig}
            disabled={pending}
            className="mt-3 text-center text-sm text-ink-muted underline"
          >
            Später einrichten — alles steht auch in den Einstellungen
          </button>
        )}
        <p className="mt-3 text-center text-xs text-ink-muted/70">
          Angemeldet als {meineEmail}
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------- Schritte --------------------------------- */

function Fertighinweis({ text }: { text: string }) {
  return (
    <p className="mb-4 rounded-card bg-accent-light px-4 py-3 text-sm font-medium text-ink">
      {text}
    </p>
  );
}

function SchrittNamen({
  namen,
  kind,
  onNamen,
  onKind,
}: {
  namen: { email: string; name: string }[];
  kind: string;
  onNamen: (n: { email: string; name: string }[]) => void;
  onKind: (k: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted">
        So spricht die App euch an — auf den Karten, im Kalendereintrag und in jedem Text, den
        der Assistent schreibt.
      </p>
      {namen.map((p, n) => (
        <label key={p.email} className="block">
          <span className="text-xs text-ink-muted">{p.email}</span>
          <input
            value={p.name}
            onChange={(e) =>
              onNamen(namen.map((x, j) => (j === n ? { ...x, name: e.target.value } : x)))
            }
            placeholder="Vorname"
            className="mt-1 w-full rounded-card border border-surface-muted bg-surface px-4 py-3 outline-none focus:border-accent"
          />
        </label>
      ))}
      <label className="block">
        <span className="text-xs text-ink-muted">Euer Kind</span>
        <input
          value={kind}
          onChange={(e) => onKind(e.target.value)}
          placeholder="Wie heißt es?"
          className="mt-1 w-full rounded-card border border-surface-muted bg-surface px-4 py-3 outline-none focus:border-accent"
        />
      </label>
    </div>
  );
}

function SchrittKalender({
  erledigt,
  dienstadresse,
}: {
  erledigt: boolean;
  dienstadresse: string | null;
}) {
  /*
   * Die Frage vor der Frage: Apple oder Google?
   *
   * Sie steht hier und nicht in den Formularen, weil sie eine Entscheidung
   * ist und keine Eingabe. Solange niemand gewählt hat, steht kein Feld da —
   * zwei Formulare untereinander wären auf einem Telefon eine Wand.
   */
  const [wahl, setWahl] = useState<"apple" | "google" | null>(null);

  if (erledigt) {
    return (
      <>
        <Fertighinweis text="Der Kalender ist schon verbunden ✓" />
        <p className="text-ink-muted">
          Termine kommen in beide Richtungen — was ihr hier anlegt, steht auch in eurem
          Kalender, und umgekehrt.
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted">
        Der gemeinsame Kalender ist das Herz der App. Einer von euch verbindet ihn — die
        andere Person sieht dann alles, ohne selbst etwas verbinden zu müssen.
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <KalenderWahl
          titel="Apple"
          unter="iCloud"
          gewaehlt={wahl === "apple"}
          onClick={() => setWahl(wahl === "apple" ? null : "apple")}
        />
        <KalenderWahl
          titel="Google"
          unter="Android & Gmail"
          gewaehlt={wahl === "google"}
          onClick={() => setWahl(wahl === "google" ? null : "google")}
        />
      </div>

      {wahl === "apple" && <ConnectForm />}
      {wahl === "google" && <GoogleForm dienstadresse={dienstadresse} />}

      {wahl === null && (
        <p className="text-sm text-ink-muted">
          Ihr könnt später beides haben — jede Person bringt ihren eigenen Kalender mit.
        </p>
      )}
    </div>
  );
}

/** Eine der beiden Karten in der Anbieterwahl. */
function KalenderWahl({
  titel,
  unter,
  gewaehlt,
  onClick,
}: {
  titel: string;
  unter: string;
  gewaehlt: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={gewaehlt}
      className={`rounded-card border px-4 py-3 text-left transition-colors ${
        gewaehlt ? "border-accent bg-surface-muted" : "border-surface-muted bg-bg"
      }`}
    >
      <span className="block font-medium text-ink">{titel}</span>
      <span className="block text-sm text-ink-muted">{unter}</span>
    </button>
  );
}

function SchrittPartner({ status }: { status: EinrichtungStatus }) {
  const [pending, start] = useTransition();
  const [gesagt, setGesagt] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const router = useRouter();

  // Außerhalb der Verzweigungen, damit ihn das Neuladen nach dem Verschicken
  // nicht mitnimmt — siehe components/settings/PartnerEinladen.
  const linkKasten = link ? (
    <LinkZumWeitergeben
      link={link}
      hinweis="Falls die Mail nicht ankommt: Dieser Link tut dasselbe."
    />
  ) : null;

  if (status.partnerDa) {
    return (
      <>
        {linkKasten}
        <Fertighinweis text="Ihr seid schon zu zweit ✓" />
        <p className="text-ink-muted">
          Beide sehen dieselben Termine, Aufgaben und Absprachen.
        </p>
      </>
    );
  }
  if (status.eingeladenEmail) {
    return (
      <>
        <Fertighinweis text="Einladung ist unterwegs ✓" />
        <p className="text-ink-muted">
          An <span className="font-medium text-ink">{status.eingeladenEmail}</span>. Sobald sie
          den Link antippt, seht ihr dasselbe. Der Link gilt zwei Wochen.
        </p>
        {/* Vertippt? Ohne diesen Weg bliebe nur warten — zwei Wochen lang
            stünde hier eine Adresse, die es nicht gibt. */}
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              await ziehPartnerEinladungZurueckAction();
              router.refresh();
            })
          }
          className="mt-3 text-sm text-ink-muted underline disabled:opacity-60"
        >
          Einladung zurücknehmen
        </button>
        {linkKasten}
      </>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted">
        Wir schicken einen Link, der nur für diese eine Adresse funktioniert. Ein Passwort
        braucht sie nicht.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        inputMode="email"
        placeholder="ihre@email.de"
        className="w-full rounded-card border border-surface-muted bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      <button
        disabled={pending || !email.trim()}
        onClick={() =>
          start(async () => {
            const r = await ladePartnerEinAction(email);
            setGesagt(r.grund ?? (r.mailRaus ? "Einladung ist raus ✓" : "Hat nicht geklappt."));
            setLink(r.link ?? null);
            // Erst danach steht im Schritt „Einladung ist unterwegs" — sonst
            // sieht man die Rückmeldung, aber nicht den neuen Zustand. Bei
            // klemmender Mail bleibt der Schritt stehen, damit der Link
            // sichtbar ist: Er ist der einzige Weg, den es dann noch gibt.
            if (r.ok && r.mailRaus) router.refresh();
          })
        }
        className="rounded-pill bg-ink px-5 py-3 font-medium text-surface disabled:opacity-60"
      >
        {pending ? "Schicke …" : "Einladung schicken"}
      </button>
      {gesagt && <p className="text-sm text-ink-muted">{gesagt}</p>}
      {linkKasten}
    </div>
  );
}

function SchrittAufgaben({
  listenName,
  text,
  onListenName,
  onText,
}: {
  listenName: string;
  text: string;
  onListenName: (n: string) => void;
  onText: (t: string) => void;
}) {
  const zeilen = text.split("\n").filter((z) => z.trim()).length;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-ink-muted">
        Hast du deine Aufgaben schon irgendwo — in Notizen, Erinnerungen, einem Chat? Kopier
        sie hier hinein, eine pro Zeile. Aufzählungszeichen und Häkchen dürfen drinbleiben.
      </p>
      <input
        value={listenName}
        onChange={(e) => onListenName(e.target.value)}
        placeholder="Wie soll die Liste heißen?"
        className="w-full rounded-card border border-surface-muted bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        rows={7}
        placeholder={"Kindergeld beantragen\nU-Untersuchung buchen\n- Windeln bestellen"}
        className="w-full rounded-card border border-surface-muted bg-surface px-4 py-3 outline-none focus:border-accent"
      />
      {zeilen > 0 && (
        <p className="text-sm text-ink-muted">
          {zeilen} {zeilen === 1 ? "Zeile" : "Zeilen"} — landen in „{listenName || "Ohne Namen"}".
        </p>
      )}
    </div>
  );
}

function SchrittFaecher({ onFertig }: { onFertig: () => void }) {
  const [listen, setListen] = useState<string[]>([]);
  const [laeden, setLaeden] = useState<string[]>([]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-ink-muted">
        Fächer für Aufgaben und Einkauf. Beides geht auch später jederzeit — direkt dort, wo
        ihr etwas eintragt.
      </p>
      <div>
        <h2 className="font-display text-lg">Aufgabenlisten</h2>
        <p className="mt-1 text-sm text-ink-muted">Zum Beispiel Papierkram, Haushalt, Kind.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {listen.map((l) => (
            <span key={l} className="rounded-pill bg-surface px-3.5 py-2 text-sm shadow-card">
              {l}
            </span>
          ))}
          <NeuesFachChip
            label="+ Liste"
            placeholder="Wie soll sie heißen?"
            onCreate={async (n) => {
              const r = await createTodoListAction(n);
              if (r.ok) {
                setListen((a) => [...a, n]);
                onFertig();
              }
              return r;
            }}
          />
        </div>
      </div>
      <div>
        <h2 className="font-display text-lg">Läden</h2>
        <p className="mt-1 text-sm text-ink-muted">Damit der Einkauf nach Wegen sortiert ist.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {laeden.map((l) => (
            <span key={l} className="rounded-pill bg-surface px-3.5 py-2 text-sm shadow-card">
              {l}
            </span>
          ))}
          <NeuesFachChip
            label="+ Laden"
            placeholder="Wie heißt er?"
            onCreate={async (n) => {
              const r = await createStoreAction(n);
              if (r.ok) {
                setLaeden((a) => [...a, n]);
                onFertig();
              }
              return r;
            }}
          />
        </div>
      </div>
    </div>
  );
}
