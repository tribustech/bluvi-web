/** fish `features/operator/cancelNotes.ts` (verbatim). */
/**
 * The operator's cancel and reject endpoints both append their reason to
 * `notes` so the record keeps it — "[Anulare operator] <reason>" and
 * "[Refuz operator] <reason>" respectively (booking.ts, operatorCancel / reject).
 * The same reason also lands in `cancelReason`, which every card renders under
 * its own label, so strip the appended block from the notes line rather than
 * printing it twice — or, on the angler's own screen, showing them the
 * operator's refusal under "Mesajul tău".
 */
const APPENDED_REASON = /\[(Anulare|Refuz) operator\]/;

export function stripAppendedCancelReason(notes: string | undefined | null): string {
  if (!notes) return '';
  return notes.split(APPENDED_REASON)[0].trim();
}

/**
 * The no-show reason the operator picked prefills the sheet with this exact
 * sentence, so most marks carry it verbatim. The status pill already reads "Nu a
 * venit", making that line a duplicate — only a note the operator actually
 * changed says anything new.
 */
export const DEFAULT_NO_SHOW_NOTE = 'Pescarul nu s-a prezentat.';

export function meaningfulNoShowNote(noShow: boolean | undefined, comment: string | undefined): string {
  if (!noShow || !comment) return '';
  const trimmed = comment.trim();
  return trimmed === DEFAULT_NO_SHOW_NOTE ? '' : trimmed;
}

