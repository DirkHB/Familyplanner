"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import type { Person } from "@/lib/auth/allowlist";

/**
 * Schwebende Leiste, nur Symbole — wie man es von den großen Apps kennt.
 * Sie liegt über dem Inhalt statt ihn abzuschneiden; der Inhalt scrollt
 * unter ihr durch. Ganz rechts das eigene Profil, unter dem auch die
 * Einstellungen wohnen — damit sie von überall erreichbar sind und die
 * Woche kein Zahnrad mehr braucht.
 */
const TABS = [
  { href: "/woche", label: "Woche", auch: ["/termin", "/erfassen"] },
  { href: "/termine", label: "Monat", auch: [] as string[] },
  { href: "/aufgaben", label: "Aufgaben", auch: [] as string[] },
  { href: "/einkauf", label: "Einkauf", auch: [] as string[] },
  { href: "/profil", label: "Profil", auch: ["/einstellungen", "/ideen"] },
];

export function TabBar({ klein = false }: { klein?: boolean }) {
  const path = usePathname();
  // Rote Zahl am Aufgaben-Tab + eigene Person für den Profil-Kreis. Wird bei
  // jedem Seitenwechsel aufgefrischt — Erledigtes soll sofort verschwinden.
  const [faellig, setFaellig] = useState(0);
  const [einkauf, setEinkauf] = useState(0);
  const [person, setPerson] = useState<Person | null>(null);
  useEffect(() => {
    let weg = false;
    fetch("/api/heute")
      .then((r) => (r.ok ? r.json() : { aufgaben: 0, person: null }))
      .then((d) => {
        if (weg) return;
        setFaellig(Number(d.aufgaben) || 0);
        setEinkauf(Number(d.einkauf) || 0);
        if (d.person === "dirk" || d.person === "constanze") setPerson(d.person);
      })
      .catch(() => {});
    return () => {
      weg = true;
    };
  }, [path]);

  return (
    <nav
      aria-label="Bereiche"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-center"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      {/* Glas wie bei den großen Apps: viel Durchsicht, kräftiger Blur mit
          angehobener Sättigung, eine Lichtkante statt harter Linie.
          Beim Runterscrollen duckt sich die Leiste (klein), beim Hochscrollen
          wächst sie zurück — eine Kurve, die schnell startet und weich landet. */}
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-pill border border-white/45 bg-surface/55 p-1.5 shadow-hero"
        style={{
          backdropFilter: "blur(20px) saturate(1.6)",
          WebkitBackdropFilter: "blur(20px) saturate(1.6)",
          transform: klein ? "scale(0.78) translateY(6px)" : "scale(1) translateY(0)",
          transformOrigin: "50% 100%",
          transition: "transform 420ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {TABS.map(({ href, label, auch }) => {
          const active =
            path === href ||
            path.startsWith(href + "/") ||
            auch.some((p) => path === p || path.startsWith(p + "/"));
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
                active ? "bg-ink text-surface" : "text-ink-muted"
              }`}
            >
              {href === "/aufgaben" && faellig > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-none text-surface">
                  {faellig > 9 ? "9+" : faellig}
                </span>
              )}
              {/* Neutral, nicht rot: offene Einkäufe sind kein Alarm. */}
              {href === "/einkauf" && einkauf > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-semibold leading-none text-surface">
                  {einkauf > 9 ? "9+" : einkauf}
                </span>
              )}
              {href === "/profil" ? (
                person ? (
                  <Avatar person={person} size={28} />
                ) : (
                  <PersonIcon />
                )
              ) : href === "/woche" ? (
                <CalendarIcon />
              ) : href === "/termine" ? (
                <MonthIcon />
              ) : href === "/einkauf" ? (
                <CartIcon />
              ) : (
                <CheckIcon />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

const S = { width: 22, height: 22, fill: "none", stroke: "currentColor", strokeWidth: 1.8 } as const;

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9h18M8 3v3M16 3v3" strokeLinecap="round" />
    </svg>
  );
}
function MonthIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="3" y="4.5" width="18" height="16" rx="3" />
      <path d="M3 9h18" strokeLinecap="round" />
      <path d="M7.5 12.5h.01M12 12.5h.01M16.5 12.5h.01M7.5 16.5h.01M12 16.5h.01M16.5 16.5h.01" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M8 12.5l2.8 2.8L16.5 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M3 4h2.4l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.2L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9.5" cy="20" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="17.5" cy="20" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" strokeLinecap="round" />
    </svg>
  );
}
