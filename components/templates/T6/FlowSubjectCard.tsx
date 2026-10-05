import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * What the task acts on, pinned above it: fish's dashed indigo card on the scale screens
 * (indigo-1 fill, 1px dashed indigo-5 border, the stand in indigo — title2 here, one step under
 * the page title) — «Sector A, Stand 3», the club,
 * «Echipa …», the anglers as bullets. The dashed edge says «this is the subject, not a control».
 */
export function FlowSubjectCard({
  title,
  kicker,
  subtitle,
  people,
  aside,
  className,
}: {
  /** «Sector A, Stand 3» / «Stand A1(10)». */
  title: ReactNode;
  /** Accent line (club on NC). */
  kicker?: ReactNode;
  /** «Echipa Crap Team». */
  subtitle?: ReactNode;
  /** Names as a bullet list. */
  people?: string[];
  /** Right side: a total (SignatureNumber), a status. */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Spans its container: to line up with a form grid, place it in the grid's first column.
        'flex items-start gap-4 rounded-card border border-dashed border-accent bg-accent-tint px-4 py-3 md:px-5 md:py-4',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="t-title2 text-accent-ink">{title}</p>
        {kicker ? <p className="t-heading text-accent-ink">{kicker}</p> : null}
        {subtitle ? <p className="t-heading text-ink">{subtitle}</p> : null}
        {people && people.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {people.map((p) => (
              <li key={p} className="t-body flex items-baseline gap-2 text-ink">
                <span aria-hidden className="size-1.5 shrink-0 translate-y-[-2px] rounded-full bg-accent" />
                {p}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </div>
  );
}
