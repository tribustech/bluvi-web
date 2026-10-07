import type { ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

/**
 * fish features/bookings/ui/BookingCard — the booking page's white card (the same surface as the
 * booking card above it: rounded, a soft shadow, 16 / 20 / 24 padding). Its title is an h2 under the
 * page's «Rezervare» (fish Typography heading), `description` the muted line under it.
 */
export function Card({
  title,
  description,
  titleId,
  className,
  children,
  ...data
}: {
  title?: ReactNode;
  description?: ReactNode;
  titleId?: string;
  className?: string;
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <section
      aria-labelledby={title && titleId ? titleId : undefined}
      data-testid={data['data-testid']}
      className={cn('flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e1 md:p-5 xl:p-6', className)}
    >
      {title ? (
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="t-heading text-ink">
            {title}
          </h2>
          {description ? <p className="t-caption text-muted">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
