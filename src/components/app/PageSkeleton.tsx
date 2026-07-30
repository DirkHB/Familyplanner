/** Sofortiger Lade-Zustand beim Seitenwechsel — Navigation fühlt sich damit
 *  augenblicklich an, während der Server die dynamische Seite rendert. */
export function PageSkeleton({ hero = false }: { hero?: boolean }) {
  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto max-w-md px-5 pt-8">
        <div className="h-4 w-28 animate-pulse rounded-pill bg-surface-muted" />
        <div className="mt-3 h-10 w-3/4 animate-pulse rounded-card bg-surface-muted" />
        {hero && <div className="mt-6 h-44 w-full animate-pulse rounded-card bg-ink/10" />}
        <div className="mt-6 flex flex-col gap-4">
          <div className="h-24 w-full animate-pulse rounded-card bg-surface" />
          <div className="h-24 w-full animate-pulse rounded-card bg-surface" />
          <div className="h-24 w-full animate-pulse rounded-card bg-surface" />
        </div>
      </div>
    </div>
  );
}
