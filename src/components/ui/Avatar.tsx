/** Feste Zwei-Personen-Avatare: Dirk = Dunkelblau, Constanze = Rosé. */
type Person = "dirk" | "constanze";

const MAP: Record<Person, { initial: string; bg: string; fg: string }> = {
  dirk: { initial: "D", bg: "var(--color-ink)", fg: "var(--color-surface)" },
  constanze: { initial: "C", bg: "var(--color-counter)", fg: "var(--color-surface)" },
};

export function Avatar({
  person,
  size = 28,
  showName = false,
}: {
  person: Person;
  size?: number;
  showName?: boolean;
}) {
  const { initial, bg, fg } = MAP[person];
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center rounded-full font-semibold"
        style={{
          width: size,
          height: size,
          background: bg,
          color: fg,
          fontSize: size * 0.4,
        }}
        aria-hidden
      >
        {initial}
      </span>
      {showName && (
        <span className="font-medium">
          {person === "dirk" ? "Dirk" : "Constanze"}
        </span>
      )}
    </span>
  );
}
