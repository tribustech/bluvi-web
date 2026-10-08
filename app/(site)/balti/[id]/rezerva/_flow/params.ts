import { anglerFlow, type FlowConfig } from './config';

/*
 * The booking flow's state, in the URL — fish BookingFlowProvider + useBookingGridFlow
 * (parity booking.b.flow-state). fish keeps the selection in one provider per visit, mounted by the
 * nested stack's layout; the web's three steps are real URLs (/balti/[id]/rezerva, …/extra,
 * …/confirmare), so the visit's state rides in the query string instead:
 *
 *   ?stand=<standDocumentId>&start=<slot start ISO>&end=<last slot end ISO>[&extra=<key>…]
 *
 * A reload, a shared link and Back from a later step all re-seed the same selection (c24). The
 * grid writes it with history.replaceState (one history entry per visit, never one per tap); the
 * steps link to each other with `stepHref`. Pure: imported by the server pages and the client.
 */

export type FlowSelection = { stand: string; start: string; end: string };
export type FlowParams = { selection: FlowSelection | null; extras: string[] };
export type FlowStep = 'grid' | 'extras' | 'review';

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function all(src: ParamSource, key: string): string[] {
  if (src instanceof URLSearchParams) return src.getAll(key);
  const v = src[key];
  return v === undefined ? [] : Array.isArray(v) ? v : [v];
}
const one = (src: ParamSource, key: string) => all(src, key)[0]?.trim() || undefined;

/** An ISO instant with an explicit offset (what the grid's slots carry), and nothing else. */
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const validIso = (s: string | undefined): s is string => !!s && ISO_WITH_OFFSET.test(s) && !Number.isNaN(Date.parse(s));
/** Extra keys are CMS identifiers (`cabana150`): a short token, nothing that could smuggle markup. */
const EXTRA_KEY = /^[\w-]{1,64}$/;

/**
 * The flow state of a URL. A half or malformed selection (a stand without times, an end before its
 * start, a date that is not an ISO instant) reads as NO selection — never as a guess; extras only
 * count with a selection (they belong to a tour).
 */
export function readFlowParams(src: ParamSource): FlowParams {
  const stand = one(src, 'stand');
  const start = one(src, 'start');
  const end = one(src, 'end');
  const ok = !!stand && stand.length <= 64 && validIso(start) && validIso(end) && Date.parse(start) < Date.parse(end);
  if (!ok) return { selection: null, extras: [] };
  const extras = [...new Set(all(src, 'extra').filter(e => EXTRA_KEY.test(e)))].sort();
  return { selection: { stand, start, end }, extras };
}

/** The query string (without «?») of a flow state; '' without a selection. */
export function flowQuery(selection: FlowSelection | null, extras: string[] = []): string {
  if (!selection) return '';
  const q = new URLSearchParams([
    ['stand', selection.stand],
    ['start', selection.start],
    ['end', selection.end],
  ]);
  for (const e of [...extras].sort()) q.append('extra', e);
  return q.toString();
}

/** The query keys the flow owns; every other parameter of a URL belongs to someone else. */
const FLOW_KEYS = ['stand', 'start', 'end', 'extra'] as const;

/**
 * `search` (a location.search, «?» optional) with the flow's keys replaced by `selection` (+ extras)
 * and every other parameter kept, in place — the operator's ?rezervare= rides on the same grid URL
 * (operator.calendar), and a selection written by the grid must never close the open booking.
 * Without foreign params it is exactly flowQuery(selection, extras). '' when nothing is left.
 */
export function withFlowQuery(search: string, selection: FlowSelection | null, extras: string[] = []): string {
  const foreign = new URLSearchParams(search);
  for (const k of FLOW_KEYS) foreign.delete(k);
  const own = flowQuery(selection, extras);
  const rest = foreign.toString();
  return own && rest ? `${own}&${rest}` : own || rest;
}

/**
 * Where a step lives for a flow state (`config`: the angler's flow, or the operator's walk-in).
 * The grid never carries extras: the sheet always quotes the
 * bare tour, and returning to the grid resets the chosen extras (fish useBookingGridFlow, c36).
 */
export function stepHref(lakeId: string, step: FlowStep, params: FlowParams, config: FlowConfig = anglerFlow(lakeId)): string {
  const sel = params.selection;
  if (step === 'grid' || !sel) {
    const q = flowQuery(sel);
    return `${config.paths.grid}${q ? `?${q}` : ''}`;
  }
  const s = { stand: sel.stand, start: sel.start, end: sel.end, extras: params.extras };
  return step === 'extras' ? config.paths.extras(s) : config.paths.review(s);
}

/** Same selection (stand + bounds). */
export function sameSelection(a: FlowSelection | null, b: FlowSelection | null): boolean {
  if (!a || !b) return a === b;
  return a.stand === b.stand && Date.parse(a.start) === Date.parse(b.start) && Date.parse(a.end) === Date.parse(b.end);
}
