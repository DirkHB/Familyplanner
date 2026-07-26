/** Die Marke: zwei Punkte (Constanze rosé, Dirk navy) mit Türkis-Nenner. */
export function Mark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden role="img">
      <circle cx="300" cy="256" r="118" fill="var(--color-counter)" />
      <circle cx="212" cy="256" r="118" fill="var(--color-ink)" />
      <circle cx="256" cy="256" r="26" fill="var(--color-accent)" />
    </svg>
  );
}
