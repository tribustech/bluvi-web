import { PROSE_MAX } from '@/components/nav/shell';

/**
 * The ONE frame of a page-level state card in every template — signed-out gate, empty, error
 * (T1 ListStates, T3 page states keep their own centred column, T4Gate, T5 STATE_CARD, T6 gates):
 * the reading measure (720, shell.tsx PROSE_MAX) and one alignment rule, centred in the content
 * column at every width. A page that leaves the rest of its column empty (signed out, nothing to
 * show) never parks a 720px card against one edge with a blank band beside it.
 * The gate's sign-in CTA is always the primary button; «Înapoi» / the public way on is secondary.
 */
export const STATE_CARD_FRAME = `mx-auto w-full ${PROSE_MAX}`;
