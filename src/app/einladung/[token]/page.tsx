import { pruefeToken } from "@/lib/einladung/store";
import { EinladungAnnehmen } from "./EinladungAnnehmen";
import { Mark } from "@/components/ui/Mark";

export const dynamic = "force-dynamic";

/**
 * Die Seite hinter dem Einladungslink.
 *
 * Sie verrät die Adresse nur verkürzt („t••••@example.com"). Wer die
 * Einladung bekommen hat, erkennt sich darin wieder; wer den Link zufällig in
 * die Finger bekommt, bekommt keine fremde Adresse geschenkt.
 */
export default async function EinladungPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const pruefung = await pruefeToken(token);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 flex flex-col items-start">
        <Mark size={52} />
        {pruefung.art === "gueltig" ? (
          <>
            <p className="eyebrow mt-6 text-ink-muted">Du bist eingeladen</p>
            <h1 className="mt-1 font-display text-4xl leading-tight">Euer Plan.</h1>
            <p className="mt-2 text-ink-muted">
              Ein gemeinsamer Planer für Kalender, Betreuung, Aufgaben und Einkauf. Wir schicken
              dir gleich einen Anmeldelink an {verkuerzt(pruefung.einladung.email)} — ein Passwort
              brauchst du nicht.
            </p>
          </>
        ) : (
          <>
            <p className="eyebrow mt-6 text-ink-muted">Einladung</p>
            <h1 className="mt-1 font-display text-4xl leading-tight">{ueberschrift(pruefung.art)}</h1>
            <p className="mt-2 text-ink-muted">{erklaerung(pruefung.art)}</p>
          </>
        )}
      </div>

      {pruefung.art === "gueltig" && <EinladungAnnehmen token={token} />}
    </main>
  );
}

function ueberschrift(art: "unbekannt" | "verbraucht" | "abgelaufen"): string {
  if (art === "verbraucht") return "Schon eingelöst.";
  if (art === "abgelaufen") return "Abgelaufen.";
  return "Kennen wir nicht.";
}

function erklaerung(art: "unbekannt" | "verbraucht" | "abgelaufen"): string {
  if (art === "verbraucht") {
    return "Diese Einladung wurde bereits benutzt. Wenn du schon ein Konto hast, melde dich einfach an.";
  }
  if (art === "abgelaufen") {
    return "Einladungen gelten zwei Wochen. Bitte jemanden aus dem Haushalt um eine neue.";
  }
  return "Dieser Link führt zu keiner Einladung. Vielleicht ist beim Kopieren etwas verloren gegangen.";
}

/** „thomas@example.com" wird „t••••@example.com". */
function verkuerzt(email: string): string {
  const [lokal, domain] = email.split("@");
  if (!domain) return "deine Adresse";
  return `${lokal.slice(0, 1)}${"•".repeat(Math.max(3, lokal.length - 1))}@${domain}`;
}
