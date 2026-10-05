import Link from 'next/link';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import type { ExtraScale, LiveCompetition } from '@/core/competitions';
import type { CompetitionActiveWeighing } from '@/core/organizer';
import { ScaleIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { homeLinks } from './links';
import { MissingStandRow } from './MissingStandRow';
import { RelativeAge } from './RelativeAge';

/** fish ScaleItem `standLabel`: national championship «A3(12)», otherwise «Sector A Stand 3». */
function scaleStandLabel(s: ExtraScale['stand'], isNc: boolean) {
  const sector = s.sectors[0]?.name;
  return isNc ? nationalStandLabel(sector, s.sectorDrawPosition, s.name) : `Sector ${sector || '- '} Stand ${s.name || '-'}`;
}

/** fish helpers/formatNationalStand.ts — «A3(12)»: sector letter + draw position, stand in brackets. */
function nationalStandLabel(sectorName: string | null | undefined, drawPosition: number | null | undefined, standName: string) {
  const s = (sectorName ?? '').trim();
  const letter = s.length <= 1 ? s : (s.match(/[A-Za-z]\s*$/)?.[0]?.trim() ?? s[s.length - 1] ?? '');
  return drawPosition != null ? `${letter}${drawPosition}(${standName})` : `${letter}${standName}`;
}

/** fish DashboardSheet: «Cântar în curs pe standul A3.» / «Extra-cântar în curs pe standurile A3, B1.» */
function weighingLine(weighings: CompetitionActiveWeighing[], isNc: boolean) {
  const stands = weighings
    .map((w) => (isNc ? nationalStandLabel(w.stand.sectors[0]?.name, w.stand.sectorDrawPosition, w.stand.name) : `${w.stand.sectors[0]?.name ?? ''}${w.stand.name}`))
    .join(', ');
  return `${weighings[0]?.weighingType === 'normal' ? 'Cântar' : 'Extra-cântar'} în curs pe ${weighings.length > 1 ? 'standurile' : 'standul'} ${stands}.`;
}

/**
 * fish components/DashboardSheet.tsx (DashboardLiveCompetitionsSheet) — «CONCURSUL MEU»: the
 * competition the user is in right now, and its new extra-scale requests (up to three). Mobile:
 * an indigo bar docked to the bottom edge, as the app's bottom sheet; desktop: a card in the right
 * column. The partidă dock wins over it (fish). Below them, while a weighing runs, the app's
 * «Cântar în curs pe standul …» line (fish useActiveWeighing).
 */
export function MyLiveCompetition({
  live,
  weighings,
  layout,
}: {
  live: LiveCompetition;
  weighings: CompetitionActiveWeighing[];
  layout: 'dock' | 'card';
}) {
  const scales = live['extra-scales'];
  const isNc = live.competition.rankingType === 'nationalChampionship' || weighings[0]?.competition?.rankingType === 'nationalChampionship';
  const href = routes.competition(live.competition.documentId);
  return (
    <section
      aria-labelledby={`acasa-concursul-meu-${layout}`}
      className={cn(
        'flex flex-col gap-2.5 bg-accent text-on-accent',
        layout === 'dock'
          ? 'sticky bottom-0 z-sticky -mx-4 -mb-8 rounded-t-bento md:-mx-6 md:-mb-10 px-5 pt-5 pb-[max(--spacing(5),env(safe-area-inset-bottom))] shadow-tabbar xl:hidden'
          : // Flat, as OrganizerBanner: the indigo fill separates it; e1 is for photo cards.
            'rounded-card p-4.5'
      )}
    >
      <div className="relative">
        <p className="t-caption">CONCURSUL MEU</p>
        <h2 id={`acasa-concursul-meu-${layout}`} className="flex items-center gap-1 t-heading">
          <Link
            href={href}
            className="min-w-0 flex-1 truncate outline-none after:absolute after:inset-0 focus-visible:after:outline-2 focus-visible:after:outline-on-accent"
          >
            {live.competition.name}
          </Link>
          <ChevronRightIcon aria-hidden className="size-6 shrink-0" />
        </h2>
      </div>
      {scales.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <p className="t-caption">SOLICITĂRI EXTRA CÂNTAR ({scales.length})</p>
          <ul className="flex flex-col gap-1.5">
            {scales.slice(0, 3).map((s) => {
              const sectorName = s.stand.sectors[0]?.name;
              // fish ScaleItem: without sector/stand ids there is no history to open.
              const href =
                sectorName && s.stand.name && s.stand.documentId
                  ? homeLinks.scaleHistory(live.competition.documentId, { sectorName, standName: s.stand.name, standId: s.stand.documentId })
                  : null;
              const body = (
                <>
                  <ScaleIcon aria-hidden className="size-6 shrink-0 text-live" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate t-body">{scaleStandLabel(s.stand, isNc)}</span>
                    {s.author ? <span className="block truncate t-caption text-muted">{s.author.username}</span> : null}
                  </span>
                  {s.createdAt ? <RelativeAge iso={s.createdAt} className="shrink-0 t-body text-muted" /> : null}
                  <ChevronRightIcon aria-hidden className="size-6 shrink-0 text-muted" />
                </>
              );
              const row =
                'flex w-full items-center gap-2.5 rounded-control bg-surface p-2 text-left text-ink-2 transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-70 focus-visible:outline-on-accent';
              return (
                <li key={s.documentId}>
                  {href ? (
                    <Link href={href} className={row}>
                      {body}
                    </Link>
                  ) : (
                    <MissingStandRow className={row}>{body}</MissingStandRow>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {weighings.length > 0 ? (
        <p className="flex items-center gap-2.5 t-body">
          {/* fish BreatheAnimation */}
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-on-accent animate-live" />
          {weighingLine(weighings, isNc)}
        </p>
      ) : null}
    </section>
  );
}
