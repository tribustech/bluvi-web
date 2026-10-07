import { plural } from '@/components/cards/format';
import { cn } from '@/components/ui/cn';
import { isNoCatch, readCell, type RankingRowData } from './model';
import { EMPTY_STAND, formatRankingWeight, penaltyMarker, type WinnerMode } from './rankingColumns';
import { paletteLetter, parseStand, sectorFill } from './sector';
import { PenaltyMarker, WinnerTrophy } from './shell';

/**
 * Position pill — replaces fish's 🎖️ (Fundații §05). Winner: navy + lavender, the signature
 * look; tied or regular: indigo tint; no catch: neutral.
 */
export function PositionPill({
  position,
  tied = false,
  winner = false,
  noCatch = false,
  onTint = false,
}: {
  position: number;
  tied?: boolean;
  winner?: boolean;
  /** The competitor finished without a catch: the neutral pill. */
  noCatch?: boolean;
  /** The row itself is indigo-tinted (signed-in user): the pill switches to surface. */
  onTint?: boolean;
}) {
  const tone = winner
    ? 'bg-navy text-lavender t-num-18'
    : noCatch
      ? 'bg-soft-fill text-ink-2 t-num-16'
      : onTint
        ? 'bg-surface text-accent-ink t-num-16'
        : 'bg-accent-tint text-accent-ink t-num-16';
  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-control leading-none font-extrabold tabular-nums ${tone}`}
    >
      <span className="sr-only">Locul </span>
      {tied && (
        <>
          <span aria-hidden>=</span>
          <span className="sr-only">egal </span>
        </>
      )}
      {position}
    </span>
  );
}

export type RankingRowProps = {
  row: RankingRowData;
  /** Key of the deciding value on the right (Cantitate for quantity rankings). */
  valueKey?: string;
  /** This row shares its place with another one (shows «=4»). See `tiedIndices`. */
  tied?: boolean;
  /** Highlights the signed-in user's own row («Tu · …»). */
  isCurrentUser?: boolean;
  /** What the row's `isWinner` means (rankingColumns winnerMode): the trophy after the name. */
  winnerMode?: WinnerMode;
};

/**
 * Ranking row · mobile (Fundații §07) — a ranked line in a list (the /dev/kit card; its grammar is
 * the lake rankings'). NOT the competition page's phone ranking: a competition ranking is a table at
 * every width, fish's colours included (ROADMAP §4b.12, §4b.15 — MobileRanking draws the kit
 * RankingTable as fish's ScrollableTable). The row: position pill (navy + lavender only for the
 * untied 1st place with a catch; tied «=4»), the angler with fish's penalty marker, a trophy after the name for a winner (muted for a sector
 * winner, as the table's «Poziție sector» cue), «sector · stand · capturi · CMMC» with the gold
 * biggest catch, the deciding value in kg with fish's three decimals. The sector shows only as the
 * 4px left stripe (a list line, not a ranking table: no fish fills). Rendered as a list item — wrap
 * rows in an <ol>.
 */
export function RankingRow({ row, valueKey = 'quantity', tied = false, isCurrentUser = false, winnerMode = 'sector' }: RankingRowProps) {
  const { sector, stand } = parseStand(row.position);
  const noCatch = isNoCatch(row);
  const marker = penaltyMarker(row.penalties);
  const biggest = readCell(row.biggestFish);
  const stripe = sectorFill(paletteLetter(row.backgroundColor) ?? sector, row.backgroundColor);
  const empty = row.participant === EMPTY_STAND;
  const counts = typeof row.catchCount === 'number' ? plural(row.catchCount, 'captură', 'capturi') : null;
  const cmmc = !noCatch && biggest.raw != null && biggest.raw !== '-' ? formatRankingWeight(row.biggestFish) : null;
  const first = row.generalPosition === 1 && !tied && !noCatch;
  const winner = row.isWinner && !noCatch && !empty;

  return (
    <li
      className={cn(
        'grid grid-cols-[4px_44px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-hairline py-3 pr-3.5 last:border-b-0',
        isCurrentUser ? 'bg-accent-tint' : noCatch && 'bg-soft-fill/50',
      )}
    >
      <span aria-hidden className={cn('h-10 rounded-r-[2px]', stripe.className)} style={stripe.style} />
      <PositionPill position={row.generalPosition} tied={tied} winner={first} noCatch={noCatch} onTint={isCurrentUser} />
      <div className="min-w-0">
        <p className={cn('flex min-w-0 items-center gap-1.5 t-body-strong', noCatch ? 'text-ink-2' : 'text-ink')}>
          <span className="truncate">
            {isCurrentUser && 'Tu · '}
            {empty ? (
              <>
                <span aria-hidden>–</span>
                <span className="sr-only">{EMPTY_STAND}</span>
              </>
            ) : (
              row.participant
            )}
          </span>
          {winner ? <WinnerTrophy mark={winnerMode === 'sector' ? 'sector' : 'prize'} /> : null}
          {marker ? <PenaltyMarker {...marker} /> : null}
        </p>
        <p className="truncate t-caption text-muted">
          {sector && <span className="sr-only">Sector </span>}
          {[sector, stand && `Stand ${stand}`, counts].filter(Boolean).join(' · ')}
          {cmmc ? (
            <>
              {' · '}
              {/* fish: the competition's biggest catch is gold with bold dark text (parity clasament.c19). */}
              <span className={cn(biggest.isBiggest && 'rounded-[4px] bg-medal-gold px-1 font-extrabold text-on-medal')}>
                {biggest.isBiggest && <span className="sr-only">Cea mai mare captură: </span>}
                CMMC {cmmc}
              </span>
            </>
          ) : null}
        </p>
      </div>
      {noCatch ? (
        // No catch: «–» in the value, as fish (never «capot», ROADMAP §4b.11); the meta line says «0 capturi».
        <p className="text-right">
          <span aria-hidden className="block t-stat text-ink-2">
            –
          </span>
          <span className="sr-only">Fără capturi</span>
        </p>
      ) : (
        <p className="text-right">
          <span className="block t-stat text-ink">{formatRankingWeight(row[valueKey])}</span>
          <span className="block t-micro text-muted">kg</span>
        </p>
      )}
    </li>
  );
}
