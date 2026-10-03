import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { EyeIcon, MapPinIcon, TrophyIcon, UserIcon, UsersIcon } from '@heroicons/react/20/solid';
import type { CompetitionCard } from '@/core/competitions';
import { CardShell, CardTitle, Pill, Tag, formatDecimal, plural } from '@/components/cards';
import { FishIcon, ScaleIcon } from '@/components/icons/brand';
import { FaceStack } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/**
 * fish features/competitions/components/cards/preview/CompetitionRailCard.tsx — the card of the
 * Acasă rails. The kit CompetitionCard has no live-totals / upcoming footer, so this composes the
 * kit parts (CardShell, CardTitle, Pill, Tag, FaceStack) into the rail variant.
 *
 * Every card in a row is the same height: the title reserves two lines, the footer is 56px, and
 * the row stretches its cards (flex/grid) so a wrapped badge row never makes the row ragged.
 */
export function CompetitionRailCard({ competition: c, variant = 'rail' }: { competition: CompetitionCard; variant?: 'rail' | 'grid' }) {
  const href = routes.competition(c.documentId);
  const media = c.banner ?? c.lake?.image ?? null;
  const poster = media?.smallUrl ?? media?.url ?? null;
  const isLive = c.status === 'started';
  const isTeam = c.format.kind === 'team';

  return (
    <CardShell elevated interactive className="h-full">
      {/* Posters are mostly A4 portrait with the details written on them: `contain` keeps all of
          it, the blurred copy behind fills the frame instead of grey bars (fish). */}
      <div className={cn('relative shrink-0 overflow-hidden bg-soft-fill', variant === 'grid' ? 'h-[150px]' : 'h-[120px]')}>
        {poster ? (
          <>
            <Image src={poster} alt="" fill sizes="240px" className="scale-110 object-cover blur-xl" aria-hidden />
            <Image src={poster} alt="" fill sizes="(min-width: 1280px) 240px, 225px" className="object-contain" />
          </>
        ) : null}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {isLive ? <Pill tone="live">LIVE</Pill> : null}
          <span className="inline-flex h-[22px] items-center gap-[3px] rounded-[4px] bg-photo-scrim px-1.5 t-micro-strong text-on-photo-scrim">
            <EyeIcon aria-hidden className="size-3" />
            {c.viewers === 1 ? '1 urmăritor' : `${c.viewers} urmăritori`}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-[3px] px-3 pt-2.5 pb-2.5">
        <p className={cn('truncate t-eyebrow uppercase', isLive ? 'text-live' : 'text-accent-ink')}>{withHours(c)}</p>
        <CardTitle href={href} className="line-clamp-2 min-h-10 t-heading text-ink">
          {c.name}
        </CardTitle>
        <p className="flex min-h-[17px] min-w-0 items-center gap-1 t-label text-accent-ink">
          {c.lake ? (
            <>
              <MapPinIcon aria-hidden className="size-3 shrink-0 text-accent" />
              <span className="truncate">{c.lake.name}</span>
            </>
          ) : null}
        </p>
        {variant === 'rail' ? (
          <div className="mt-1 flex flex-wrap gap-[5px]">
            <Tag tone="indigo" title={c.rankingLabel}>
              <TrophyIcon aria-hidden className="mr-1 size-2.5" />
              {c.rankingLabel}
            </Tag>
            <Tag tone="gray">
              {isTeam ? <UsersIcon aria-hidden className="mr-1 size-2.5" /> : <UserIcon aria-hidden className="mr-1 size-2.5" />}
              {isTeam ? 'Echipe' : 'Individual'}
            </Tag>
          </div>
        ) : null}
      </div>

      <div className="flex h-14 shrink-0 items-center border-t border-hairline px-3">
        {isLive ? <LiveFooter c={c} variant={variant} /> : <UpcomingFooter c={c} />}
      </div>
    </CardShell>
  );
}

/** fish CompetitionRailCard `withHours`: «SÂM, 27 SEPT. · 07:00–15:00» for a one-day competition. */
const withHours = (c: CompetitionCard) => (c.hoursLabel ? `${c.dateLabel} · ${c.hoursLabel}` : c.dateLabel);

/**
 * Live totals as one line — catches and weighed kilos (fish LiveFooter). The desktop grid card ends
 * with a «Clasament» link (design), above the card's stretched link.
 */
function LiveFooter({ c, variant }: { c: CompetitionCard; variant: 'rail' | 'grid' }) {
  const ranking =
    variant === 'grid' ? (
      <Link
        href={routes.competitionRanking(c.documentId)}
        aria-label={`Clasament: ${c.name}`}
        className="relative z-10 ml-auto shrink-0 rounded-control t-label text-accent-ink hover:underline"
      >
        Clasament
      </Link>
    ) : null;
  const results = c.results;
  if (!results?.hasCatches) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FaceStack people={c.participantFaces.slice(0, 3).map((src, i) => ({ name: `Participant ${i + 1}`, src }))} size={24} />
        <p className="line-clamp-2 min-w-0 t-caption text-muted">{results ? 'Încă nu sunt capturi' : 'Statistici indisponibile'}</p>
        {ranking}
      </div>
    );
  }
  return (
    // Three grid cards across (1440) leave ~190px: with «Clasament» the units go to screen readers only.
    <div className={cn('flex min-w-0 flex-1 items-center', variant === 'grid' ? 'gap-3.5 2xl:gap-2.5' : 'gap-3.5')}>
      <LiveStat
        icon={<FishIcon size={14} />}
        value={String(results.catchCount)}
        unit={results.catchCount === 1 ? 'captură' : 'capturi'}
        compact={variant === 'grid'}
      />
      {results.totalKg !== null ? (
        <LiveStat icon={<ScaleIcon size={14} />} value={formatDecimal(results.totalKg, 0, 1)} unit="kg" compact={variant === 'grid'} />
      ) : null}
      {ranking}
    </div>
  );
}

function LiveStat({ icon, value, unit, compact = false }: { icon: ReactNode; value: string; unit: string; compact?: boolean }) {
  return (
    <p className="flex min-w-0 items-center gap-[5px]">
      <span aria-hidden className="text-accent-ink">
        {icon}
      </span>
      <span className="shrink-0 t-body-strong text-ink tabular-nums">{value}</span>
      <span className={cn('truncate t-caption text-muted', compact && '2xl:sr-only')}>{unit}</span>
    </p>
  );
}

/** fish UpcomingFooter: «38/48 pescari» + «10 locuri libere» (or «N în așteptare»). */
function UpcomingFooter({ c }: { c: CompetitionCard }) {
  const one = c.format.kind === 'team' ? 'echipă' : 'pescar';
  const count = c.capacity !== null ? `${c.joinedCount}/${c.capacity} ${c.format.unit}` : plural(c.joinedCount, one, c.format.unit);
  const sub =
    c.placesLeft !== null && c.placesLeft > 0
      ? { text: plural(c.placesLeft, 'loc liber', 'locuri libere'), className: 'text-success' }
      : c.pendingCount > 0
        ? { text: `${c.pendingCount} în așteptare`, className: 'text-muted' }
        : null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <FaceStack people={c.participantFaces.slice(0, 3).map((src, i) => ({ name: `Participant ${i + 1}`, src }))} size={24} />
      <div className="min-w-0 flex-1">
        <p className="truncate t-label text-ink">{count}</p>
        {sub ? <p className={cn('truncate t-micro-strong', sub.className)}>{sub.text}</p> : null}
      </div>
    </div>
  );
}
