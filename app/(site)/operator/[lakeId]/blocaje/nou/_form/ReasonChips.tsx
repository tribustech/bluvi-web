'use client';

import { BLOCK_REASONS, BLOCK_REASON_LABELS, type OfferedBlockReason } from '@/core/booking';
import { RadioChips } from './chips';

/**
 * c11 — «Motiv» (fish CreateBlockForm:279-291, blockReasons.ts): Concurs, Închidere, Întreținere,
 * Altele; «Rezervare telefonică» is not offered (a phone booking is a walk-in, not a block).
 */
export function ReasonChips({
  value,
  onChange,
  labelledBy,
  disabled,
}: {
  value: OfferedBlockReason;
  onChange: (r: OfferedBlockReason) => void;
  labelledBy: string;
  disabled?: boolean;
}) {
  return (
    <RadioChips
      name="blocaj-motiv"
      labelledBy={labelledBy}
      options={BLOCK_REASONS.map((r) => ({ value: r, label: BLOCK_REASON_LABELS[r] }))}
      value={value}
      onChange={onChange}
      disabled={disabled}
      testId="block-reasons"
    />
  );
}
