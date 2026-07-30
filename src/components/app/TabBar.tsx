"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/woche", label: "Woche", icon: CalendarIcon },
  { href: "/ueberblick", label: "Überblick", icon: CompassIcon },
  { href: "/termine", label: "Termine", icon: ClockIcon },
  { href: "/aufgaben", label: "Aufgaben", icon: CheckIcon },
  { href: "/einkauf", label: "Einkauf", icon: BasketIcon },
];

export function TabBar() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-surface-muted bg-bg/90 backdrop-blur">
      <div
        className="mx-auto flex max-w-md items-center justify-around px-4 pt-2.5"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 text-xs ${
                active ? "text-accent" : "text-ink-muted"
              }`}
            >
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
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 8v4.5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function BasketIcon() {
  return (
    <svg viewBox="0 0 24 24" {...S}>
      <path d="M4 9h16l-1.4 9.2a2 2 0 0 1-2 1.8H7.4a2 2 0 0 1-2-1.8L4 9Z" strokeLinejoin="round" />
      <path d="M8.5 9 12 3.5 15.5 9" strokeLinecap="round" strokeLinejoin="round" />
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
