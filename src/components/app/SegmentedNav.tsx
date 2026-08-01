import Link from "next/link";

/**
 * Zwei Ansichten, ein Umschalter — als Links, nicht als Zustand.
 *
 * Damit schrumpft die Tab-Leiste von fünf auf drei Einträge: Der Monat lebt
 * unter „Woche", der Einkauf unter „Aufgaben". Beide Seiten bleiben eigene
 * Routen (eigener Code, eigener Ladezustand); der Umschalter lässt sie sich
 * nur wie zwei Reiter anfühlen.
 */
export function SegmentedNav({
  items,
  active,
}: {
  items: { href: string; label: string; badge?: number }[];
  active: string;
}) {
  return (
    <div className="inline-flex rounded-pill bg-surface-muted/70 p-1">
      {items.map((it) => {
        const isActive = it.href === active;
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-1.5 rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive ? "bg-surface text-ink shadow-card" : "text-ink-muted"
            }`}
          >
            {it.label}
            {it.badge != null && it.badge > 0 && (
              <span
                className={`rounded-pill px-1.5 text-[11px] font-semibold leading-[18px] ${
                  isActive ? "bg-counter-light text-signal" : "bg-surface-muted text-ink-muted"
                }`}
              >
                {it.badge > 99 ? "99+" : it.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
