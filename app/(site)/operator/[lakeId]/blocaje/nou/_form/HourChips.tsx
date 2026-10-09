'use client';

import { endHours, startHours } from './model';
import { RadioChips } from './chips';

/*
 * c9 — the block's boundary hours (fish CreateBlockForm:217-258): «De la ora» = 00:00 + the lake's
 * tour starts (no 24:00), «Până la ora» = the tour starts + 24:00 (no 00:00). The start applies to
 * the start day, the end to the end day; 24:00 = the next midnight (core buildBlockInterval).
 * fish puts the two side by side; here they sit one under the other where a column is narrow
 * (phone, the 1024–1535 two-column form), so each group's chips stay on one line.
 */
export function HourChips({
  options,
  start,
  end,
  onStart,
  onEnd,
  disabled,
}: {
  /** core blockTimeOptions(slotStartTimes). */
  options: string[];
  start: string;
  end: string;
  onStart: (t: string) => void;
  onEnd: (t: string) => void;
  disabled?: boolean;
}) {
  const toOption = (t: string) => ({ value: t, label: t });
  return (
    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 lg:flex lg:flex-col 2xl:grid 2xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span id="blocaj-de-la" className="t-label text-ink-2">
          De la ora
        </span>
        <RadioChips name="blocaj-de-la" labelledBy="blocaj-de-la" options={startHours(options).map(toOption)} value={start} onChange={onStart} disabled={disabled} testId="block-start-hours" compact />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <span id="blocaj-pana-la" className="t-label text-ink-2">
          Până la ora
        </span>
        <RadioChips name="blocaj-pana-la" labelledBy="blocaj-pana-la" options={endHours(options).map(toOption)} value={end} onChange={onEnd} disabled={disabled} testId="block-end-hours" compact />
      </div>
    </div>
  );
}
