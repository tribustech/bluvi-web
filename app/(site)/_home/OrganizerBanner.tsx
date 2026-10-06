import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { loadOrganizerDashboard } from './data';
import { homeLinks } from './links';
import { RetryRefresh } from './RetryRefresh';

/**
 * fish components/OrganizerBanner.tsx — organisers only, hidden until the dashboard has loaded.
 * Viitoare · În așteptare · Locuri libere; the whole card opens the organiser panel. fish's Lottie
 * watermark is not ported (no Lottie on the web). A card, not a hero (radius 16, like the operator
 * card beside it in the same column); flat — the indigo fill already separates it, and e1 is for
 * cards with a photo. «Deschide ›» is a UI glyph: the 24 outline chevron at its own size (§05).
 */
export async function OrganizerBanner({ layout, className }: { layout: 'mobile' | 'desktop'; className?: string }) {
  // Rendered only for organisers (OrganizerSlot): no stats here means the read failed. The banner
  // stays — its link to the panel still works — with an inline retry instead of the figures.
  const stats = await loadOrganizerDashboard();

  const items = stats
    ? [
        { dot: 'bg-status-info-fg', value: stats.byStatus?.notStarted || 0, label: 'Viitoare' },
        { dot: 'bg-status-pending-fg', value: stats.pendingRegistrations, label: 'În așteptare' },
        { dot: 'bg-status-success-fg', value: stats.emptySpots, label: 'Locuri libere' },
      ]
    : null;

  return (
    <section
      aria-labelledby={`acasa-organizator-${layout}`}
      className={cn(
        // A whole-card link: Fundații's card press (opacity .7), no scale.
        'relative flex flex-col gap-3 rounded-card bg-accent-ink p-4.5 text-on-accent transition-opacity duration-(--duration-fast) ease-fast active:opacity-70',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h2 id={`acasa-organizator-${layout}`} className="t-heading">
          <Link
            href={homeLinks.organizer}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-on-accent"
          >
            Panou organizator
          </Link>
        </h2>
        <span aria-hidden className="flex items-center gap-0.5 t-caption text-on-accent/85">
          Deschide
          <ChevronRightIcon className="size-6" />
        </span>
      </div>
      {!items ? <RetryRefresh tone="accent" message="Nu am putut încărca situația." /> : null}
      {items ? (
        <dl className="flex items-center">
          {items.map((s, i) => (
            <div key={s.label} className={cn('flex flex-1 flex-col-reverse items-center gap-1', i > 0 && 'border-l border-on-accent/20')}>
              {/* The status dot sits on the label line, never beside the number (beside it, a dot
                  reads as a glyph: «O2»). A plain filled dot, no ring. */}
              <dt className="flex items-center justify-center gap-1.5 text-center t-caption text-on-accent/85">
                <span aria-hidden className={cn('size-2 shrink-0 rounded-full', s.dot)} />
                {s.label}
              </dt>
              <dd className="t-stat tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </section>
  );
}

/**
 * The banner's footprint while the organiser stats stream in — rendered only for a viewer the
 * session already names as an organiser, so nothing below it moves when the banner arrives.
 */
export function OrganizerBannerSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Se încarcă panoul organizator" className={cn('flex flex-col gap-3 rounded-card bg-accent-ink p-4.5', className)}>
      <span aria-hidden className="flex h-6 items-center">
        <span className="h-4 w-36 rounded-full bg-on-accent/20" />
      </span>
      <span aria-hidden className="flex items-center">
        {[0, 1, 2].map((i) => (
          <span key={i} className={cn('flex flex-1 flex-col items-center gap-1', i > 0 && 'border-l border-on-accent/20')}>
            <span className="h-7 w-8 rounded-badge bg-on-accent/20" />
            <span className="h-4 w-16 rounded-full bg-on-accent/20" />
          </span>
        ))}
      </span>
    </div>
  );
}
