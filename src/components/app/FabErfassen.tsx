import Link from "next/link";

/** Der schwebende „+"-Knopf zum Schnell-Erfassen — rechts unten, daumennah. */
export function FabErfassen() {
  return (
    <Link
      href="/erfassen"
      aria-label="Schnell erfassen"
      className="absolute right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-surface shadow-hero transition-transform duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-95"
      style={{ bottom: "calc(6rem + env(safe-area-inset-bottom))" }}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </Link>
  );
}
