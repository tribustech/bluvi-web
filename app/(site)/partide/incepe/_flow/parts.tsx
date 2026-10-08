'use client';

import { MapPinIcon } from '@heroicons/react/24/outline';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { LocateFixedIcon, MapPinnedIcon, NavigationIcon, WavesIcon } from './icons';

/*
 * The venue step's pieces: fish VenueRow, LakesNearbyPermissionPlaceholder (the location card the
 * start flow reuses from the lakes tab) and NearbyLocationRetryCard.
 */

export type VenueKind = 'lake' | 'publicWater' | 'pin';

/** The 44px leading box: lake thumb (or indigo pin box), blue waves for a public water, green pinned box for a map pin. */
export function VenueGlyph({ kind, thumb, size = 'md' }: { kind: VenueKind; thumb?: string | null; size?: 'md' | 'lg' }) {
  const box = cn('flex shrink-0 items-center justify-center overflow-hidden', size === 'lg' ? 'size-12 rounded-control' : 'size-11 rounded-control');
  const glyph = 'size-5';
  if (kind === 'lake' && thumb) {
    // eslint-disable-next-line @next/next/no-img-element -- CMS thumbnail, already the small format
    return <img src={thumb} alt="" loading="lazy" className={cn(box, 'bg-soft-fill object-cover')} />;
  }
  if (kind === 'lake') {
    return (
      <span aria-hidden className={cn(box, 'bg-accent-tint text-accent-ink')}>
        <MapPinIcon className={glyph} />
      </span>
    );
  }
  if (kind === 'publicWater') {
    return (
      <span aria-hidden className={cn(box, 'bg-badge-blue-bg text-badge-blue-fg')}>
        <WavesIcon className={glyph} />
      </span>
    );
  }
  return (
    <span aria-hidden className={cn(box, 'bg-status-success-bg text-status-success-fg')}>
      <MapPinnedIcon className={glyph} />
    </span>
  );
}

const KIND_LABEL: Record<VenueKind, string> = { lake: 'Baltă', publicWater: 'Apă publică', pin: 'Loc pe hartă' };

/** fish VenueRow: one tappable venue (search result or suggestion). */
export function VenueRow({ kind, name, subtitle, thumb, onSelect }: { kind: VenueKind; name: string; subtitle: string | null; thumb?: string | null; onSelect: () => void }) {
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onSelect}
        data-testid="venue-row"
        data-kind={kind}
        className={cn(
          'flex w-full min-w-0 cursor-pointer items-center gap-3 rounded-card bg-surface p-2.5 pr-3 text-left shadow-e0',
          'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-70',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        )}
      >
        <VenueGlyph kind={kind} thumb={thumb} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate t-body-strong text-ink">{name}</span>
          <span className="truncate t-caption text-muted">
            <span className="sr-only">{KIND_LABEL[kind]}. </span>
            {subtitle ?? ''}
          </span>
        </span>
      </button>
    </li>
  );
}

/** A grid of venue rows: one column on a phone, auto-filling 320px columns from 768 (owner rule 5). */
export const VENUE_GRID = 'grid gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(80),1fr))] md:gap-3';

/* ── location cards ─────────────────────────────────────────────────────────────────────────── */

export type BlockedMode = 'never_asked' | 'denied' | 'services_off';

/** fish LakesNearbyPermissionPlaceholder PLACEHOLDER_COPY (the start flow shows the lakes tab's card). */
const PERMISSION_COPY: Record<BlockedMode, { title: string; description: string; cta: string }> = {
  never_asked: {
    title: 'Descoperă bălți aproape de tine',
    description: 'Permite locația și îți arătăm instant locurile din apropiere.',
    cta: 'Permite locația',
  },
  denied: {
    title: 'Activează locația din setări',
    description: 'Permisiunea e blocată acum, dar o poți reactiva rapid.',
    cta: 'Deschide setările',
  },
  services_off: {
    title: 'Activează locația dispozitivului',
    description: 'Permisiunea e dată, dar locația telefonului este oprită.',
    cta: 'Deschide setările',
  },
};

/** The card shell both location cards share: icon disc, title over its line, the action (the whole card is the button). */
function LocationCard({
  testId,
  tone,
  icon,
  title,
  description,
  cta,
  busy,
  onClick,
}: {
  testId: string;
  tone: 'info' | 'warning';
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      data-testid={testId}
      className={cn(
        'flex w-full cursor-pointer flex-col items-start gap-3 rounded-card p-4 text-left md:flex-row md:items-center md:gap-4 md:px-5',
        'transition-[filter,opacity] duration-(--duration-fast) ease-fast hover:brightness-[0.98] active:opacity-80 disabled:cursor-progress',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        tone === 'info' ? 'border border-accent-tint-3 bg-status-info-bg' : 'border border-status-warning-fg/25 bg-status-warning-bg',
      )}
    >
      <span
        aria-hidden
        className={cn('flex size-12 shrink-0 items-center justify-center rounded-full', tone === 'info' ? 'bg-accent-tint-2 text-accent-ink' : 'bg-surface/70 text-status-warning-fg')}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cn('t-heading', tone === 'info' ? 'text-accent-ink' : 'text-status-warning-fg')}>{title}</span>
        <span className={cn('max-w-[60ch] t-body', tone === 'info' ? 'text-status-info-fg' : 'text-ink-2')}>{description}</span>
      </span>
      <span
        className={buttonClass({
          variant: tone === 'info' ? 'primary' : 'secondary',
          size: 'compact',
          className: 'shrink-0 max-md:w-full',
        })}
      >
        {cta}
      </span>
    </button>
  );
}

export function LocationPermissionCard({ mode, busy, onClick }: { mode: BlockedMode; busy?: boolean; onClick: () => void }) {
  const copy = PERMISSION_COPY[mode];
  return (
    <LocationCard
      testId="location-permission-card"
      tone="info"
      icon={<NavigationIcon className="size-6" />}
      title={copy.title}
      description={copy.description}
      cta={busy ? 'Se caută locația…' : copy.cta}
      busy={busy}
      onClick={onClick}
    />
  );
}

/** fish NearbyLocationRetryCard: permission fine, no fix yet — retry, never the settings. */
export function LocationRetryCard({ busy, onClick }: { busy?: boolean; onClick: () => void }) {
  return (
    <LocationCard
      testId="nearby-location-retry"
      tone="warning"
      icon={<LocateFixedIcon className="size-6" />}
      title="Nu am putut afla locația"
      description="GPS-ul nu a răspuns încă. Încearcă din nou într-un loc deschis."
      cta={busy ? 'Caut locația…' : 'Reîncearcă'}
      busy={busy}
      onClick={onClick}
    />
  );
}
