import Link from "next/link";

/**
 * Der schwebende „+"-Knopf — rechts unten, daumennah.
 *
 * Die Maße stehen an einer Stelle, weil sie an mehreren Stellen gleich
 * aussehen müssen: Wer auf Woche gelernt hat, wo das „+" liegt, sucht es auf
 * Aufgaben nicht neu. Ein Knopf, der je nach Seite oben rechts klein oder
 * unten rechts groß ist, ist zwei Knöpfe.
 */
const FAB_KLASSEN =
  "absolute right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full " +
  "bg-accent text-surface shadow-hero transition-transform " +
  "duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95";

const FAB_STIL = { bottom: "calc(6rem + env(safe-area-inset-bottom))" } as const;

function Plus({ gedreht = false }: { gedreht?: boolean }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      // Aufgeklappt wird aus dem „+" ein „×": derselbe Knopf, sichtbar in
      // zwei Zuständen. Sonst tippt man ein zweites Mal darauf und wundert
      // sich, dass das Formular verschwindet.
      style={{
        transform: gedreht ? "rotate(45deg)" : "none",
        transition: "transform 180ms cubic-bezier(0.16,1,0.3,1)",
      }}
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Führt woandershin — Schnell-Erfassen auf Woche und Monat. */
export function FabErfassen() {
  return (
    <Link href="/erfassen" aria-label="Schnell erfassen" className={FAB_KLASSEN} style={FAB_STIL}>
      <Plus />
    </Link>
  );
}

/** Klappt an Ort und Stelle etwas auf — das Aufgabenformular. */
export function FabKnopf({
  onClick,
  label,
  offen = false,
}: {
  onClick: () => void;
  label: string;
  offen?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-expanded={offen}
      className={FAB_KLASSEN}
      style={FAB_STIL}
    >
      <Plus gedreht={offen} />
    </button>
  );
}
