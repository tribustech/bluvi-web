import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import type { getOrganizerDashboard } from '@/core/organizer';
import { homeLinks } from './links';

/**
 * fish components/OrganizerBanner.tsx — organisers only, hidden until the dashboard has loaded.
 * Viitoare · În așteptare · Locuri libere; the whole card opens the organiser panel. fish's Lottie
 * watermark is not ported (no Lottie on the web). A card, not a hero (radius 16, like the operator
 * card beside it in the same column); flat — the indigo fill already separates it, and e1 is for
 * cards with a photo. «Deschide ›» is a UI glyph: the 24 outline chevron at its own size (§05).
 */
export type OrganizerStats = Awaited<ReturnType<typeof getOrganizerDashboard>>;

/**
 * The banner from its stats alone (no read): the server slot (slots.tsx OrganizerSlot) and the
 * browser takeover (LateBlocks.tsx) render the same markup. Without stats there is no banner (owner
 * rule 4, fish OrganizerBanner.tsx:61 `if (!stats) return null`) — the callers decide that.
 */
export function OrganizerBanner({ stats, layout, className }: { stats: OrganizerStats; layout: 'mobile' | 'desktop'; className?: string }) {

  // From 768 the status pairs on the label line; on the phone fish's own dots beside the number
  // (ROADMAP §4b.25: the phone looks like fish).
  const items = [
    { dot: 'bg-status-info-fg', phoneDot: 'bg-fish-dot-upcoming', value: stats.byStatus?.notStarted || 0, label: 'Viitoare' },
    { dot: 'bg-status-pending-fg', phoneDot: 'bg-fish-dot-pending', value: stats.pendingRegistrations, label: 'În așteptare' },
    { dot: 'bg-status-success-fg', phoneDot: 'bg-fish-dot-free', value: stats.emptySpots, label: 'Locuri libere' },
  ];

  return (
    <section
      aria-labelledby={`acasa-organizator-${layout}`}
      className={cn(
        // A whole-card link: Fundații's card press (opacity .7), no scale.
        'relative flex flex-col gap-3 rounded-card bg-accent-ink p-4.5 text-on-accent transition-opacity duration-(--duration-fast) ease-fast active:opacity-70',
        // fish: the indigo diagonal gradient, padding 16, gap 14, a soft indigo shadow.
        'max-md:-mx-1.25 max-md:gap-3.5 max-md:bg-linear-to-br max-md:from-fish-organizer-from max-md:via-fish-organizer-via max-md:to-fish-organizer-to max-md:p-4 max-md:shadow-e2',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h2 id={`acasa-organizator-${layout}`} className="t-heading max-md:t-body">
          <Link
            href={homeLinks.organizer}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-on-accent"
          >
            Panou organizator
          </Link>
        </h2>
        <span aria-hidden className="flex items-center gap-0.5 t-caption text-on-accent/85">
          Deschide
          <ChevronRightIcon className="size-6 max-md:size-3.5" />
        </span>
      </div>
      <dl className="flex items-center">
        {items.map((s, i) => (
          <div key={s.label} className={cn('flex flex-1 flex-col-reverse items-center gap-1', i > 0 && 'border-l border-on-accent/20 max-md:border-l-0 max-md:relative max-md:before:absolute max-md:before:top-1/2 max-md:before:left-0 max-md:before:h-7 max-md:before:w-px max-md:before:-translate-y-1/2 max-md:before:bg-on-accent/20')}>
            {/* The status dot sits on the label line, never beside the number (beside it, a dot
                reads as a glyph: «O2»). A plain filled dot, no ring. */}
            <dt className="flex items-center justify-center gap-1.5 text-center t-caption text-on-accent/85">
              <span aria-hidden className={cn('size-2 shrink-0 rounded-full max-md:hidden', s.dot)} />
              {s.label}
            </dt>
            <dd className="flex items-center gap-1.5 t-stat tabular-nums">
              <span aria-hidden className={cn('size-2 shrink-0 rounded-full md:hidden', s.phoneDot)} />
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * The banner's footprint while the organiser stats stream in — rendered only for a viewer the
 * session already names as an organiser, so nothing below it moves when the banner arrives.
 */
export function OrganizerBannerSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Se încarcă panoul organizator" className={cn('flex flex-col gap-3 rounded-card bg-accent-ink p-4.5 max-md:-mx-1.25', className)}>
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
