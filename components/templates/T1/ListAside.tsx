import { useId, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { COLUMN_CARD, ColumnHeader } from './ColumnCard';

/**
 * One block of ListPage's right column («Live acum», «Înscrierile mele», a CTA). A titled surface
 * card with the same padding and header row as the filter column; `action` is a TextAction at the
 * title's end («Vezi toate»). Plain (`bare`) for content that brings its own surface (a BentoTile).
 */
export function AsideSection({
  title,
  action,
  bare = false,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  bare?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3', !bare && COLUMN_CARD, className)}>
      <ColumnHeader id={id} title={title} action={action} />
      {children}
    </section>
  );
}

/**
 * An AsideSection's shape while its sources load: the header row (title + action widths) and
 * `rows` compact rows (40px thumb, two lines), in the same card. Pass it as ListPage `aside` until
 * every source has answered, so the docked column is there from the first paint.
 */
export function AsideSkeleton({ rows = 3, blocks = 1, className }: { rows?: number; blocks?: number; className?: string }) {
  const items = Array.from({ length: rows }, (_, i) => i);
  return (
    <>
      {Array.from({ length: blocks }, (_, b) => (
        <div key={b} aria-hidden className={cn('flex flex-col gap-3', COLUMN_CARD, className)}>
          <div className="flex min-h-9 items-center justify-between gap-2">
            <span className="h-4 w-28 animate-shimmer rounded-full" />
            <span className="h-3.5 w-16 animate-shimmer rounded-full" />
          </div>
          <ul className="flex flex-col">
            {items.map((i) => (
              <li key={i} className="flex items-center gap-3 py-2">
                <span className="size-10 shrink-0 animate-shimmer rounded-avatar" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="h-3.5 w-[80%] rounded-full bg-soft-fill" />
                  <span className="h-3 w-[55%] rounded-full bg-soft-fill" />
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
