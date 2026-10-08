/** The toolbar's shape while TipTap loads (no layout jump). Kept apart from Editor.tsx: importing it never pulls the TipTap chunk. */
export function ToolbarSkeleton() {
  return (
    <div aria-hidden className="flex h-9 items-center gap-2 md:h-10 xl:h-9">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="size-7 animate-pulse rounded-control bg-soft-fill" />
      ))}
    </div>
  );
}
