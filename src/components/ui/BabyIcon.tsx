/** Betreuungs-Kennzeichen: orange = offen, türkis mit Häkchen = geklärt. */
export function BabyIcon({ tone }: { tone: "offen" | "da" }) {
  const color = tone === "offen" ? "var(--color-signal)" : "var(--color-accent)";
  return (
    <span
      className="relative inline-flex h-6 w-6 items-center justify-center rounded-full"
      style={{ background: tone === "offen" ? "var(--color-counter-light)" : "var(--color-accent-light)" }}
      aria-label={tone === "offen" ? "Betreuung offen" : "Betreuung geklärt"}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="13" r="7" stroke={color} strokeWidth="1.8" />
        <path d="M12 6c0-2 1.5-3 3-3" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="9.5" cy="12" r="1" fill={color} />
        <circle cx="14.5" cy="12" r="1" fill={color} />
        <path d="M10 15.5c1.2 1 2.8 1 4 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {tone === "da" && (
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-accent">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </span>
  );
}
