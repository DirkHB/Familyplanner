"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Drei Tabs statt fünf. Der Monat lebt als Umschalter unter „Woche", der
 * Einkauf unter „Aufgaben" — beide bleiben eigene Routen, sind aber keine
 * eigenen Orte mehr, an denen man suchen muss.
 */
const TABS = [
  { href: "/woche", label: "Woche", icon: CalendarIcon, auch: ["/termine"] },
  { href: "/ueberblick", label: "Überblick", icon: CompassIcon, auch: [] as string[] },
  { href: "/aufgaben", label: "Aufgaben", icon: CheckIcon, auch: ["/einkauf"] },
];

export function TabBar() {
  const path = usePathname();
  // Rote Zahl am Aufgaben-Tab: heute fällig oder überfällig. Wird bei jedem
  // Seitenwechsel aufgefrischt — eine erledigte Aufgabe soll sofort verschwinden.
  const [faellig, setFaellig] = useState(0);
  useEffect(() => {
    let weg = false;
    fetch("/api/heute")
      .then((r) => (r.ok ? r.json() : { aufgaben: 0 }))
      .then((d) => { if (!weg) setFaellig(Number(d.aufgaben) || 0); })
      .catch(() => {});
    return () => { weg = true; };
  }, [path]);
  return (
    <nav className="shrink-0 border-t border-surface-muted bg-bg">
      <div
        className="mx-auto flex max-w-md items-center justify-around px-4 pt-2.5"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
      >
        {TABS.map(({ href, label, icon: Icon, auch }) => {
          const active =
            path === href ||
            path.startsWith(href + "/") ||
            auch.some((p) => path === p || path.startsWith(p + "/"));
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center gap-1 text-xs ${
                active ? "text-accent" : "text-ink-muted"
              }`}
            >
              {href === "/aufgaben" && faellig > 0 && (
                <span className="absolute -top-1 left-1/2 ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-signal px-1 text-[10px] font-semibold leading-none text-surface">
                  {faellig > 9 ? "9+" : faellig}
                </span>
              )}
              <Icon />
              {label}
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
