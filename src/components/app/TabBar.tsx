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
  { href: "/woche", label: "Woche", auch: ["/termine", "/termin", "/erfassen"] },
  { href: "/ueberblick", label: "Überblick", auch: ["/ideen"] },
  { href: "/aufgaben", label: "Aufgaben", auch: ["/einkauf"] },
  { href: "/profil", label: "Profil", auch: ["/einstellungen"] },
];

export function TabBar() {
  const path = usePathname();
  // Rote Zahl am Aufgaben-Tab + eigene Person für den Profil-Kreis. Wird bei
  // jedem Seitenwechsel aufgefrischt — Erledigtes soll sofort verschwinden.
  const [faellig, setFaellig] = useState(0);
  const [person, setPerson] = useState<Person | null>(null);
  useEffect(() => {
    let weg = false;
    fetch("/api/heute")
      .then((r) => (r.ok ? r.json() : { aufgaben: 0, person: null }))
      .then((d) => {
        if (weg) return;
        setFaellig(Number(d.aufgaben) || 0);
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
      <div className="pointer-events-auto flex items-center gap-1 rounded-pill border border-surface-muted/50 bg-surface/85 p-1.5 shadow-hero backdrop-blur-md">
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
              {href === "/profil" ? (
                person ? (
                  <Avatar person={person} size={28} />
                ) : (
                  <PersonIcon />
                )
              ) : href === "/woche" ? (
                <CalendarIcon />
              ) : href === "/ueberblick" ? (
                <CompassIcon />
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
function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5 5-2Z" strokeLinejoin="round" />
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
function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c1.2-3.4 3.8-5 7-5s5.8 1.6 7 5" strokeLinecap="round" />
    </svg>
  );
}
