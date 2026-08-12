"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ladePartnerEinAction,
  ziehPartnerEinladungZurueckAction,
} from "@/app/einrichten/actions";
import { LinkZumWeitergeben } from "@/components/ui/LinkZumWeitergeben";

/**
 * Die zweite Person einladen — auch nachträglich.
 *
 * Das gab es bisher nur im Einrichtungs-Assistenten. Wer ihn ohne diesen
 * Schritt beendet hat, kam nicht mehr heran: Der Assistent ist danach von
 * nirgends verlinkt, und nur wer die Adresse `/einrichten` kennt, findet
 * zurück. Genau das ist Thomas passiert.
 *
 * Ein Schritt, den man überspringen kann, braucht einen zweiten Ort. Dies ist
 * er — bei den Namen, wo ohnehin steht, wer hier wohnt.
 */
export function PartnerEinladen({
  schonZuZweit,
  eingeladen,
}: {
  schonZuZweit: boolean;
  /** Adresse einer Einladung, die noch niemand eingelöst hat. */
  eingeladen: string | null;
}) {
  const [email, setEmail] = useState("");
  const [gesagt, setGesagt] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  /*
   * Der Link steht außerhalb der Verzweigungen.
   *
   * Sonst verschwindet er genau in dem Moment, in dem er gebraucht wird: Das
   * Verschicken legt die Einladung an, die Seite lädt sich selbst neu, und
   * diese Ansicht springt auf „unterwegs" — mitsamt dem Kasten, der den Link
   * zeigte. Klemmt dann die Mail, ist der Zugang weg, den niemand
   * wiederherstellen kann.
   */
  const linkKasten = link ? (
    <LinkZumWeitergeben
      link={link}
      hinweis="Falls die Mail nicht ankommt: Dieser Link tut dasselbe."
    />
  ) : null;

  if (schonZuZweit) {
    return (
      <>
        <p className="text-sm text-ink-muted">
          Ihr seid zu zweit ✓ Beide sehen dieselben Termine, Aufgaben und Absprachen.
        </p>
        {linkKasten}
      </>
    );
  }

  if (eingeladen) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-ink-muted">
          Einladung ist unterwegs an <span className="font-medium text-ink">{eingeladen}</span>.
          Sobald sie den Link antippt, seht ihr dasselbe. Der Link gilt zwei Wochen.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await ziehPartnerEinladungZurueckAction();
              router.refresh();
            })
          }
          className="text-sm text-ink-muted underline disabled:opacity-60"
        >
          Einladung zurücknehmen
        </button>
        {linkKasten}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-muted">
        Wir schicken einen Link, der nur für diese eine Adresse funktioniert. Ein Passwort
        braucht sie nicht.
      </p>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="off"
        inputMode="email"
        placeholder="ihre@email.de"
        className="w-full rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent"
      />
      <button
        type="button"
        disabled={pending || !email.trim()}
        onClick={() =>
          start(async () => {
            const r = await ladePartnerEinAction(email);
            setGesagt(r.grund ?? (r.mailRaus ? "Einladung ist raus ✓" : "Hat nicht geklappt."));
            setLink(r.link ?? null);
            // Bei klemmender Mail bleibt die Ansicht stehen, damit der Link
            // sichtbar ist — er ist dann der einzige Weg, den es noch gibt.
            if (r.ok && r.mailRaus) router.refresh();
          })
        }
        className="self-start rounded-pill bg-ink px-5 py-3 font-medium text-surface disabled:opacity-60"
      >
        {pending ? "Schicke …" : "Einladung schicken"}
      </button>
      {gesagt && <p className="text-sm text-ink-muted">{gesagt}</p>}
      {linkKasten}
    </div>
  );
}
