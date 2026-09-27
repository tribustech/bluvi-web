/**
 * fish `features/operator/blockListModel.ts` (date-fns replaced by `./dates`, same output).
 *
 * Pure list model for the operator's blocks screen: month sections of compact
 * rows, with blocks that share period + reason + note (the multi-stand save)
 * folded into one row.
 */
import type { AvailabilityBlockDTO, BlockReason } from '../schemas';
import { capitalize as cap, formatDayKey, formatHHmm, formatMonthAbbr, formatMonthYear, formatWeekdayShort } from './dates';

export type BlockRow = {
  key: string;
  documentIds: string[];
  startDate: string;
  endDate: string;
  reason: BlockReason;
  /** Empty = whole lake. Natural-sorted stand names. */
  standNames: string[];
  note?: string;
  contactName?: string;
  contactPhone?: string;
};

export type BlockSection = { title: string; data: BlockRow[] };

const collator = new Intl.Collator('ro', { numeric: true });

/** Short period: "Vi 4 – Lu 7 sep", "Vi 25 sep · 06:00–18:00", "Vi 18 sep 18:00 – Du 20 sep 06:00". */
export function formatBlockPeriodShort(startISO: string, endISO: string): string {
  const s = new Date(startISO);
  const e = new Date(endISO);
  const day = (d: Date) => cap(`${formatWeekdayShort(d)} ${d.getDate()}`);
  const mon = (d: Date) => formatMonthAbbr(d).replace('.', '');
  const hm = formatHHmm;
  const sameDay = formatDayKey(s) === formatDayKey(e);
  if (sameDay) return `${day(s)} ${mon(s)} · ${hm(s)}–${hm(e)}`;
  const midnightBoth = hm(s) === '00:00' && hm(e) === '00:00';
  if (midnightBoth) {
    // Whole days: show the last INCLUDED day, not the exclusive midnight after it.
    const last = new Date(e.getTime() - 1);
    const sameMonth = s.getMonth() === last.getMonth() && s.getFullYear() === last.getFullYear();
    return sameMonth ? `${day(s)} – ${day(last)} ${mon(last)}` : `${day(s)} ${mon(s)} – ${day(last)} ${mon(last)}`;
  }
  return `${day(s)} ${mon(s)} ${hm(s)} – ${day(e)} ${mon(e)} ${hm(e)}`;
}

export function groupBlocks(blocks: AvailabilityBlockDTO[]): BlockRow[] {
  const rows = new Map<string, BlockRow>();
  for (const b of blocks) {
    const key = [b.startDate, b.endDate, b.reason, b.note ?? '', b.contactName ?? '', b.contactPhone ?? ''].join('|');
    const standName = b.standKey ? (b.stand?.name ?? 'Stand') : null;
    const row = rows.get(key);
    if (row) {
      row.documentIds.push(b.documentId);
      if (standName) row.standNames.push(standName);
      continue;
    }
    rows.set(key, {
      key,
      documentIds: [b.documentId],
      startDate: b.startDate,
      endDate: b.endDate,
      reason: b.reason as BlockReason,
      standNames: standName ? [standName] : [],
      note: b.note || undefined,
      contactName: b.contactName || undefined,
      contactPhone: b.contactPhone || undefined,
    });
  }
  const out = [...rows.values()];
  for (const r of out) r.standNames.sort(collator.compare);
  return out.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** "Tot lacul" / "Standul 5" / "Standurile 5, 6, 7". */
export function scopeLabel(standNames: string[]): string {
  if (!standNames.length) return 'Tot lacul';
  if (standNames.length === 1) return `Standul ${standNames[0]}`;
  return `Standurile ${standNames.join(', ')}`;
}

/** Split into upcoming/ongoing vs finished, sectioned by start month. */
export function sectionBlocks(
  blocks: AvailabilityBlockDTO[],
  nowMs: number
): { sections: BlockSection[]; past: BlockRow[] } {
  const rows = groupBlocks(blocks);
  // Finished blocks read newest-first — the one that just ended is the one you look for.
  const past = rows.filter(r => new Date(r.endDate).getTime() <= nowMs).reverse();
  const upcoming = rows.filter(r => new Date(r.endDate).getTime() > nowMs);
  const sections: BlockSection[] = [];
  for (const r of upcoming) {
    const title = cap(formatMonthYear(new Date(r.startDate)));
    const last = sections[sections.length - 1];
    if (last && last.title === title) last.data.push(r);
    else sections.push({ title, data: [r] });
  }
  return { sections, past };
}
