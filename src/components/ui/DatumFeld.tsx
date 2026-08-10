"use client";

import { useMemo, useState } from "react";
import { vorschlaege, datumsLabel, istVergangen } from "@/lib/todos/faelligkeit";

/**
 * „Bis wann?" — als Frage, die man beantworten mag.
 *
 * Vorher stand hier ein nacktes `input type="date"`. Auf dem iPhone ist das
 * eine leere Pille mit einem dünnen Strich darin: Sie sagt nicht, dass ein
 * Datum hineingehört, sie sieht nicht anklickbar aus, und wer „morgen" sagen
 * will, muss dafür durch einen Kalender blättern.
 *
 * Jetzt drei Vorschläge, die den Alltag abdecken, und daneben der Kalender für
 * alles andere. Ein Tipp statt vier. Der Kalender selbst bleibt der des
 * Systems — den kennt jeder, und er kann Dinge, die wir nie so gut hinbekämen.
 *
 * Der Kniff dabei: Das echte Feld liegt unsichtbar über dem sichtbaren Knopf.
 * So sieht man unseren Entwurf und bekommt trotzdem den Datumswähler des
 * Betriebssystems — ohne ihn nachzubauen.
 */
export function DatumFeld({
  name,
  label = "Bis wann?",
  wert,
  onWert,
  jetzt = new Date(),
}: {
  /** Für Formulare, die abgeschickt werden. Weglassen, wenn der Wert oben hängt. */
  name?: string;
  label?: string;
  /** Gesetzt heißt: Der Wert gehört dem Aufrufer, nicht diesem Feld. */
  wert?: string;
  onWert?: (w: string) => void;
  /** Nur zum Prüfen — sonst immer die echte Uhrzeit. */
  jetzt?: Date;
}) {
  // Zwei Betriebsarten, eine Oberfläche: Das Anlegen-Formular schickt sich
  // selbst ab und braucht nur ein verstecktes Feld; das Bearbeiten hält den
  // Wert oben, weil dort noch mehr daran hängt.
  const [eigener, setEigener] = useState("");
  const gewaehlt = wert ?? eigener;
  const setzen = (w: string) => (onWert ? onWert(w) : setEigener(w));

  const schnell = useMemo(() => vorschlaege(jetzt), [jetzt]);
  const gesetzt = gewaehlt !== "";
  const ausKalender = gesetzt && !schnell.some((v) => v.schluessel === gewaehlt);
  const vergangen = istVergangen(gewaehlt, jetzt);

  return (
    <div>
      <p className="mb-2 text-sm text-ink-muted">{label}</p>

      {/* Der Wert reist im Formular mit, egal ob er aus einem Vorschlag oder
          aus dem Kalender kam. */}
      {name && <input type="hidden" name={name} value={gewaehlt} />}

      <div className="flex flex-wrap gap-2">
        {schnell.map((v) => {
          const aktiv = gewaehlt === v.schluessel;
          return (
            <button
              key={v.label}
              type="button"
              aria-pressed={aktiv}
              // Noch einmal antippen nimmt es zurück. Ohne das bliebe ein
              // versehentlich gesetztes Datum kleben — es gäbe keinen Weg
              // zurück zu „irgendwann".
              onClick={() => setzen(aktiv ? "" : v.schluessel)}
              className={`rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
                aktiv ? "bg-ink text-surface" : "bg-surface-muted text-ink"
              }`}
            >
              {v.label}
            </button>
          );
        })}

        <div className="relative">
          <span
            aria-hidden
            className={`flex items-center gap-1.5 rounded-pill px-4 py-2 text-sm font-medium transition-colors ${
              ausKalender ? "bg-ink text-surface" : "bg-surface-muted text-ink"
            }`}
          >
            <Kalender />
            {ausKalender ? datumsLabel(gewaehlt, jetzt) : "Datum"}
          </span>
          {/*
           * Das echte Feld: unsichtbar, aber vollflächig darüber. Ein Tipp
           * öffnet den Datumswähler des Systems. `appearance-none` nimmt ihm
           * sein eigenes Aussehen, damit unter dem Finger nichts durchblitzt.
           */}
          <input
            type="date"
            aria-label="Datum wählen"
            value={gewaehlt}
            onChange={(e) => setzen(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          />
        </div>
      </div>

      {/*
       * Hier stand eine Zeile „Fällig Do., 13. Aug." — direkt unter einem
       * Knopf, auf dem „Do., 13. Aug." steht. Zweimal dasselbe ist einmal zu
       * viel. Übrig bleibt, was der Knopf nicht sagen kann: dass der Tag
       * vorbei ist, und der Weg zurück zu „irgendwann" — den brauchen nur die
       * Vorschläge nicht, die schalten sich beim zweiten Antippen selbst ab.
       */}
      {vergangen && (
        <p className="mt-2 text-sm text-signal">
          Der Tag ist vorbei — die Aufgabe steht sofort als überfällig da.
        </p>
      )}
      {ausKalender && (
        <button
          type="button"
          onClick={() => setzen("")}
          className="mt-2 text-sm text-ink-muted underline"
        >
          Datum entfernen
        </button>
      )}
    </div>
  );
}

function Kalender() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
