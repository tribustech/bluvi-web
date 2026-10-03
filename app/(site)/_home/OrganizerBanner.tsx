import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { cn } from '@/components/ui/cn';
import { loadOrganizerDashboard } from './data';
import { homeLinks } from './links';

/**
 * fish components/OrganizerBanner.tsx — organisers only, hidden until the dashboard has loaded.
 * Viitoare · În așteptare · Locuri libere; the whole card opens the organiser panel. fish's Lottie
 * watermark is not ported (no Lottie on the web).
 */
export async function OrganizerBanner({ layout, className }: { layout: 'mobile' | 'desktop'; className?: string }) {
  const stats = await loadOrganizerDashboard();
  if (!stats) return null;

  const items = [
    { dot: 'bg-indigo-4', value: stats.byStatus?.notStarted || 0, label: 'Viitoare' },
    { dot: 'bg-rating', value: stats.pendingRegistrations, label: 'În așteptare' },
    { dot: 'bg-badge-green-fg', value: stats.emptySpots, label: 'Locuri libere' },
  ];

  return (
    <section
      aria-labelledby={`acasa-organizator-${layout}`}
      className={cn(
        'relative flex flex-col gap-3.5 rounded-card bg-linear-135 from-indigo-7 to-accent p-4 text-on-accent shadow-e2 transition-transform duration-(--duration-fast) ease-fast active:scale-[.985]',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <h2 id={`acasa-organizator-${layout}`} className="t-body">
          <Link
            href={homeLinks.organizer}
            className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-on-accent"
          >
            Panou organizator
          </Link>
        </h2>
        <span aria-hidden className="flex items-center gap-0.5 t-caption text-on-accent/85">
          Deschide
          <ChevronRightIcon className="size-3.5" />
        </span>
      </div>
      <dl className="flex items-center">
        {items.map((s, i) => (
          <div key={s.label} className={cn('flex flex-1 flex-col-reverse items-center gap-[3px]', i > 0 && 'border-l border-on-accent/20')}>
            <dt className="text-center t-caption text-on-accent/85">{s.label}</dt>
            <dd className="flex items-center gap-1.5 t-stat">
              <span aria-hidden className={cn('size-2 rounded-full', s.dot)} />
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
