import type { ReactNode } from 'react';
import { BanknotesIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import { BENTO_ART_CLEAR, BENTO_INK, BentoTile, type BentoTone } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { lei } from './model';

/** A figure longer than this («12.500», «1.250») does not fit a half-column tile at the 40px step. */
const LONG = 4;
/** A caption up to this long («Nicio sosire azi») fits beside the corner art. */
const SHORT_CAPTION = 18;

/**
 * c22–c24 — fish StatTile pair «standuri ocupate acum» + «de încasat azi, la sosire», as Apple-style
 * bento tiles (owner rule 19): the one «happening now» figure on the navy signature surface, the cash
 * on the mint tint, each with its large corner art; the unit is its own smaller element after a space
 * (rule 10, SignatureNumber), the denominator «/21» tight on the number. Two side by side
 * (fish) on a phone and a tablet, one above the other in the 320–360px desktop rail (`stack`, so the
 * labels keep one line); both tiles take the 26px step together
 * when one figure is too long for 40.
 */
export function StatTiles({
  occupancy,
  cash,
  layout = 'pair',
}: {
  occupancy: { booked: number; total: number; label: string };
  cash: { today: number; subline: string | null };
  /** pair: side by side (phone, tablet — fish); stack: one above the other (the 320–360 desktop rail). */
  layout?: 'pair' | 'stack';
}) {
  const sum = lei(cash.today);
  const size = sum.length > LONG ? 'fact' : 'stat';
  return (
    <div role="group" aria-label="Azi, pe scurt" className={cn('grid gap-3', layout === 'pair' ? 'grid-cols-2' : 'grid-cols-1')}>
      <Tile
        testId="occupancy-tile"
        tone="signature"
        art={<CalendarDaysIcon />}
        label={occupancy.label}
        number={<SignatureNumber size={size} tone="lavender" unitTone="lavender" value={occupancy.booked} unit={`/${occupancy.total}`} className="whitespace-nowrap" />}
        caption={null}
      />
      <Tile
        testId="cash-tile"
        tone="mint"
        // The 7-day line needs the tile's full width: no corner art beside it (text never runs over it).
        art={cash.subline && cash.subline.length > SHORT_CAPTION ? null : <BanknotesIcon />}
        label="De încasat azi, la sosire"
        number={<SignatureNumber size={size} tone={BENTO_INK.mint.number} unitTone={BENTO_INK.mint.unit} value={sum} unit="lei" className="whitespace-nowrap" />}
        caption={cash.subline}
      />
    </div>
  );
}

function Tile({
  testId,
  tone,
  art,
  label,
  number,
  caption,
}: {
  testId: string;
  tone: BentoTone;
  art: ReactNode | null;
  label: string;
  number: ReactNode;
  caption: string | null;
}) {
  return (
    <BentoTile tone={tone} art={art ?? undefined} className="min-w-0">
      <p className={cn('t-label text-pretty', BENTO_INK[tone].fg)} data-testid={`${testId}-label`}>
        {label}
      </p>
      <div data-testid={`${testId}-value`}>{number}</div>
      {/* The bottom row is kept when empty, so the two numbers sit on one line. */}
      <p className={cn('min-h-5 t-caption text-pretty', BENTO_INK[tone].fg, art ? BENTO_ART_CLEAR : null)} data-testid={`${testId}-caption`}>
        {caption}
      </p>
    </BentoTile>
  );
}
