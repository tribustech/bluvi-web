import type { ReactNode } from 'react';
import { TrophyIcon } from '@heroicons/react/20/solid';
import { FishIcon, ScaleIcon } from '@/components/icons/brand';
import { isMedalPlace, PodiumCup } from '@/components/ranking';
import { FaceStack } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { entrantsCount, entrantsLine, formatCount, formatKg, formatTotalKg, type CompetitionCard } from '@/core/competitions';

/*
 * fish CompetitionCardPreview's three footers (parity competitions-list.cards c13-c17), shared by
 * the poster card (./PosterCard) and the compact card (../CompetitionCardItem, the lake page's
 * list). Each fills its subgrid track (flex-1) with its content right under the divider, so in an
 * aligned grid row every footer divider starts at the same height.
 */

/* ------------------------------------------------------------------ */
/* Footers                                                             */
/* ------------------------------------------------------------------ */

const faces = (urls: string[]) => urls.map((src, i) => ({ name: `Participant ${i + 1}`, src }));

/**
 * fish UpcomingFooter (c13). The row is at least a face tall (min-h-8) whether or not faces show. The
 * footer fills its subgrid track (flex-1) with the row at its top: footers in one grid row share their
 * divider line, and a taller neighbour's slack lands at the bottom edge, not around this row.
 */
export function UpcomingFooter({ c }: { c: CompetitionCard }) {
  return (
    <div className="flex-1 border-t border-hairline px-3 py-2.5">
      <div className="flex min-h-8 items-center gap-2.5">
        <FaceStack people={faces(c.participantFaces)} size={32} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="t-label text-ink">
            {c.capacity !== null ? `${c.joinedCount}/${c.capacity} ${c.format.unit}` : entrantsCount(c.joinedCount, c.format.unit)}
          </p>
          {c.pendingCount > 0 ? <p className="t-micro text-muted">{c.pendingCount} în așteptare</p> : null}
        </div>
        {c.placesLeft !== null && c.placesLeft > 0 ? (
          <p className="shrink t-label text-status-success-fg">{formatCount(c.placesLeft, 'loc liber', 'locuri libere')}</p>
        ) : null}
      </div>
    </div>
  );
}

export function FooterNote({ children }: { children: ReactNode }) {
  // The same divider and rhythm as every other footer (the results' empty note).
  return <p className="flex-1 border-t border-hairline px-3 py-2.5 t-caption text-muted">{children}</p>;
}

/** fish LiveFooter (c14). */
export function LiveFooter({ c }: { c: CompetitionCard }) {
  const r = c.results;
  if (!r) return <FooterNote>Statisticile nu sunt disponibile.</FooterNote>;
  if (!r.hasCatches) return <FooterNote>Încă nu sunt capturi înregistrate.</FooterNote>;
  return (
    <div className="flex flex-1 flex-col">
      {c.joinedCount ? (
        <div className="flex min-h-8 items-center gap-2 border-t border-hairline px-3 pt-2.5 pb-3">
          <FaceStack people={faces(c.participantFaces)} size={32} />
          <p className="min-w-0 flex-1 truncate t-caption text-muted">{entrantsLine(c.joinedCount, c.format.unit)}</p>
        </div>
      ) : null}
      <StatRow
        stats={[
          { key: 'capturi', value: String(r.catchCount), label: 'capturi', icon: <FishIcon size={16} className="text-accent" /> },
          ...(r.totalKg !== null
            ? [{ key: 'kg', value: formatTotalKg(r.totalKg), unit: 'kg', label: 'cântărite', icon: <ScaleIcon size={16} className="text-accent" /> }]
            : []),
          ...(r.biggestFishKg !== null
            ? [
                {
                  key: 'cmmc',
                  value: formatKg(r.biggestFishKg),
                  unit: 'kg',
                  label: 'CMMC',
                  // fish's brown Award (#A1531F, the award token); heroicons has no award glyph, so the trophy shape.
                  icon: <TrophyIcon aria-hidden className="size-4 text-award" />,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

export type Stat = { key: string; value: string; unit?: string; label: string; icon: ReactNode };

/** fish CardStatRow: equal centred columns, the icon on the figure's line, near-black figures (c15). */
export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="flex px-3 pb-3">
      {stats.map((s) => (
        <div key={s.key} className="flex flex-1 flex-col-reverse items-center gap-1">
          <dt className="t-micro text-muted">{s.label}</dt>
          <dd className="flex items-center gap-1">
            <span aria-hidden className="flex">
              {s.icon}
            </span>
            <span className="t-num-18 text-ink">
              {s.value}
              {s.unit ? <span className="ml-0.5 t-micro-strong">{s.unit}</span> : null}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** fish ResultsFooter (c16, c17). */
export function ResultsFooter({ c }: { c: CompetitionCard }) {
  const r = c.results;
  const rows = r?.hasCatches ? [...r.podium].sort((a, b) => a.position - b.position) : [];
  if (!rows.length) {
    return (
      <div className="flex-1 border-t border-hairline px-3 py-2">
        <p className="t-caption text-muted">
          {!r ? 'Rezultatele nu sunt disponibile.' : !r.hasCatches ? 'Fără capturi înregistrate.' : 'Deschide concursul pentru clasament.'}
        </p>
      </div>
    );
  }
  // Two overlapping faces only when some row has a pair, so names within one card line up.
  const pair = rows.some((row) => row.avatarUrls.length > 1);
  return (
    <ol aria-label={`Podium ${c.name}`} className="flex flex-col gap-0.5 border-t border-hairline px-3 py-2">
      {rows.map((row, i) => {
        const shared = row.tied || rows.filter((o) => o.position === row.position).length > 1;
        const people = row.avatarUrls.length
          ? row.avatarUrls.slice(0, 2).map((src) => ({ name: row.displayName, src }))
          : [{ name: row.displayName }];
        return (
          <li
            key={`${row.position}-${row.displayName}-${i}`}
            // The winner's row: the gold attribute tint (badge-yellow), not the warning status colour.
            // TODO(kit): a --bluvi-podium-1 tint with the podium medal tokens.
            className={cn('flex items-center gap-2.5 rounded-control px-2 py-1', row.position === 1 && 'bg-badge-yellow-bg')}
          >
            <span className={cn('flex shrink-0 items-center', pair ? 'w-13' : 'w-8')}>
              <FaceStack people={people} size={32} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-px">
              {/* One line per name (a team's two names wrapped in the narrow 1280 columns, growing the
                  winner's band and breaking the row's alignment); the whole name in the tooltip. */}
              <span title={row.displayName} className="truncate t-body-strong text-ink">
                {row.displayName}
              </span>
              {row.clubName || row.standName ? (
                <span className="t-micro text-muted">
                  {[row.clubName, row.standName ? `Stand ${row.standName}` : null].filter(Boolean).join(' · ')}
                </span>
              ) : null}
              {shared ? <span className="t-micro text-muted">La egalitate</span> : null}
            </span>
            <span className="flex w-8 shrink-0 justify-center">
              {isMedalPlace(row.position) ? (
                <PodiumCup place={row.position} />
              ) : (
                <span className="t-body-strong text-muted">
                  <span className="sr-only">Locul </span>
                  {row.position}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** The footer fish shows for a card's status. */
export function StatusFooter({ c }: { c: CompetitionCard }) {
  if (c.status === 'notStarted') return <UpcomingFooter c={c} />;
  if (c.status === 'started') return <LiveFooter c={c} />;
  return <ResultsFooter c={c} />;
}
