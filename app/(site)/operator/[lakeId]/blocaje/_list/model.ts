import {
  BLOCK_REASON_LABELS,
  formatBlockPeriodShort,
  scopeLabel,
  sectionBlocks,
  type AvailabilityBlockDTO,
  type BlockRow,
  type BlockSection,
} from '@/core/booking';
import { formatCount } from '@/core/realtime/chat/format';
import { isApiError } from '@/core/transport';

/*
 * operator.blocaje — the screen's pure view model over core booking.domain.blockListModel (fish
 * features/operator/blockListModel.ts + BlockRow.tsx + app/(app)/operator/[lakeId]/blocks.tsx).
 */

/** fish ScreenHeader title (blocks.tsx:154). */
export const BLOCKS_TITLE = 'Blocaje și închideri';
/** c5 — the last section, finished blocks newest first. */
export const PAST_TITLE = 'Trecut';
export const DELETE_FALLBACK = 'Nu am putut șterge blocajul.';

export type BlockTone = 'competition' | 'closure' | 'maintenance' | 'offlineReservation' | 'other';

/**
 * c6 — fish BLOCK_REASON_TINT as theme tokens (literal hexes there; tokens here so dark mode holds):
 * Concurs indigo, Închidere red, Întreținere amber, Rezervare telefonică green, Altele grey.
 * `bg` is the 36px rounded square, `dot` the 10px dot inside it.
 */
export const BLOCK_TONE_CLASS: Record<BlockTone, { bg: string; dot: string }> = {
  competition: { bg: 'bg-accent-tint', dot: 'bg-accent' },
  closure: { bg: 'bg-status-danger-bg', dot: 'bg-live' },
  maintenance: { bg: 'bg-status-warning-bg', dot: 'bg-rating' },
  offlineReservation: { bg: 'bg-status-success-bg', dot: 'bg-success' },
  other: { bg: 'bg-status-neutral-bg', dot: 'bg-faint' },
};

const LABELS = BLOCK_REASON_LABELS as Record<string, string | undefined>;

/** A reason the CMS sends but the enum does not list reads as «Altele»'s grey, under its own name (fish). */
export function blockTone(reason: string): BlockTone {
  return reason in BLOCK_TONE_CLASS ? (reason as BlockTone) : 'other';
}

export type BlockRowView = {
  key: string;
  /** c7 — «Vi 25 sep · 06:00–18:00» / «Vi 4 – Lu 7 sep» / «Vi 18 sep 18:00 – Du 20 sep 06:00». */
  period: string;
  /** c6, c8 — «{reason} · {scope}». */
  meta: string;
  /** c6 — «{contact name · phone} — {note}», null when there is neither. */
  extra: string | null;
  tone: BlockTone;
  /** How many blocks the row stands for (a multi-stand save is one row). */
  count: number;
};

export function blockRowView(row: BlockRow): BlockRowView {
  const contact = [row.contactName, row.contactPhone].filter(Boolean).join(' · ');
  const extra = [contact, row.note].filter(Boolean).join(' — ');
  return {
    key: row.key,
    period: formatBlockPeriodShort(row.startDate, row.endDate),
    meta: `${LABELS[row.reason] ?? row.reason} · ${scopeLabel(row.standNames)}`,
    extra: extra || null,
    tone: blockTone(row.reason),
    count: row.documentIds.length,
  };
}

export type BlocksList = {
  /** c4 — upcoming / ongoing, by start month; c5 — «Trecut» appended last once revealed. */
  sections: (BlockSection & { past: boolean })[];
  /** How many finished rows there are (the «Afișează trecutul ({n})» count). */
  pastCount: number;
  /** c11 — nothing to list (fish ListEmptyComponent: also when only finished blocks exist, under the «Afișează trecutul» footer). */
  empty: boolean;
};

export function blocksList(blocks: AvailabilityBlockDTO[], nowMs: number, showPast: boolean): BlocksList {
  const { sections, past } = sectionBlocks(blocks, nowMs);
  const out: BlocksList['sections'] = sections.map((s) => ({ ...s, past: false }));
  if (showPast && past.length) out.push({ title: PAST_TITLE, data: past, past: true });
  return { sections: out, pastCount: past.length, empty: out.length === 0 };
}

/** c9 — fish BlockRow confirmDelete: single vs group copy. */
export function deleteConfirmCopy(row: Pick<BlockRow, 'documentIds' | 'standNames'>): { title: string; description: string } {
  const n = row.documentIds.length;
  return n > 1
    ? { title: `Șterge ${formatCount(n, 'blocaj', 'blocaje')}?`, description: `${scopeLabel(row.standNames)} — se deblochează toate.` }
    : { title: 'Șterge blocajul?', description: 'Această acțiune nu poate fi anulată.' };
}

/** c10 — «Blocaj șters» / «3 blocaje șterse» / «20 de blocaje șterse». */
export function deletedToast(n: number): string {
  return n > 1 ? `${formatCount(n, 'blocaj', 'blocaje')} șterse` : 'Blocaj șters';
}

/**
 * c10 — the failure toast: the server's own message when it sent one the app handles (a bluCode,
 * fish e.message), else «Nu am putut șterge blocajul.» (never the generic transport sentence).
 */
export function deleteFailureMessage(error: unknown): string {
  return isApiError(error) && error.bluCode && error.message ? error.message : DELETE_FALLBACK;
}

/**
 * c10 — a group delete that fails after some DELETEs went through: «1 din 3 blocaje șterse. {reason}»
 * (fish's create path, blocks.tsx:83); nothing deleted yet is the bare reason.
 */
export function deletePartialFailureMessage(done: number, total: number, error: unknown): string {
  const reason = deleteFailureMessage(error);
  return done > 0 ? `${done} din ${formatCount(total, 'blocaj', 'blocaje')} șterse. ${reason}` : reason;
}
