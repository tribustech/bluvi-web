import { CapotChip, Tag } from '@/components/cards/parts';
import { plural } from '@/components/cards/format';
import { formatWeight, isCapot, penaltyChips, readCell, type RankingRowData } from './model';
import { parseStand, sectorFill } from './sector';

/**
 * Position pill — replaces fish's 🎖️ (Fundații §05). Winner: navy + lavender, the signature
 * look; tied or regular: indigo tint; capot: neutral.
 */
export function PositionPill({
  position,
  tied = false,
  winner = false,
  capot = false,
  onTint = false,
}: {
  position: number;
  tied?: boolean;
  winner?: boolean;
  capot?: boolean;
  /** The row itself is indigo-tinted (signed-in user): the pill switches to surface. */
  onTint?: boolean;
}) {
  const tone = winner
    ? 'bg-navy text-lavender t-num-18'
    : capot
      ? 'bg-soft-fill text-ink-2 text-base'
      : onTint
        ? 'bg-surface text-accent-ink text-base'
        : 'bg-accent-tint text-accent-ink text-base';
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
  /** Key of the main value on the right (Cantitate for quantity rankings). */
  valueKey?: string;
  /** Unit under the value. */
  valueUnit?: string;
  /** This row shares its place with another one (shows "=4"). See `tiedIndices`. */
  tied?: boolean;
  /** Replaces the catches/CMMC part of the meta line, e.g. "egalitate · departajat la CMMC". */
  note?: string;
  /** Highlights the signed-in user's own row ("Tu · …"). */
  isCurrentUser?: boolean;
};

/**
 * Ranking row · mobile (Fundații §07). The sector shows only as the 4px left stripe; the row
 * background never carries it. Rendered as a list item — wrap rows in an <ol>.
 */
export function RankingRow({
  row,
  valueKey = 'quantity',
  valueUnit = 'kg',
  tied = false,
  note,
  isCurrentUser = false,
}: RankingRowProps) {
  const { sector, stand } = parseStand(row.position);
  const capot = isCapot(row);
  const chips = penaltyChips(row.penalties);
  const biggest = readCell(row.biggestFish);
  const stripe = sectorFill(sector, row.backgroundColor);

  const meta = [
    sector,
    stand && `Stand ${stand}`,
    ...(note
      ? [note]
      : [
          typeof row.catchCount === 'number' ? plural(row.catchCount, 'captură', 'capturi') : null,
          !capot && biggest.raw != null && biggest.raw !== '-' ? `CMMC ${formatWeight(row.biggestFish)}` : null,
        ]),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li
      className={`grid grid-cols-[4px_44px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-hairline py-3 pr-3.5 last:border-b-0 ${
        isCurrentUser ? 'bg-accent-tint' : capot ? 'bg-soft-fill/50' : ''
      }`}
    >
      <span aria-hidden className={`h-10 rounded-r-[2px] ${stripe.className}`} style={stripe.style} />
      <PositionPill
        position={row.generalPosition}
        tied={tied}
        winner={row.isWinner && !tied}
        capot={capot}
        onTint={isCurrentUser}
      />
      <div className="min-w-0">
        <p className={`flex min-w-0 items-center gap-1.5 t-body-strong ${capot ? 'text-ink-2' : 'text-ink'}`}>
          <span className="truncate">
            {isCurrentUser && 'Tu · '}
            {row.participant}
          </span>
          {chips.map((c, i) => (
            <Tag key={i} tone={c.tone === 'danger' ? 'red' : 'yellow'} size="sm" title={c.description}>
              {c.label}
            </Tag>
          ))}
        </p>
        <p className="truncate t-caption text-muted">
          {sector && <span className="sr-only">Sector </span>}
          {meta}
        </p>
      </div>
      {capot ? (
        <CapotChip />
      ) : (
        <p className="text-right">
          <span className="block t-stat text-ink">{formatWeight(row[valueKey])}</span>
          <span className="block t-micro text-muted">{valueUnit}</span>
        </p>
      )}
    </li>
  );
}
