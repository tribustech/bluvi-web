/**
 * The operator area's planned routes (docs/parity/areas/operator.yml, M7; same scheme as Acasă's
 * `operatorHref`). Not built yet — the demo links to where the real pages will live.
 */
const base = (lakeId: string) => `/operator/${encodeURIComponent(lakeId)}`;

export const operatorLinks = {
  picker: '/operator',
  panel: base,
  calendar: (lakeId: string) => `${base(lakeId)}/calendar`,
  bookings: (lakeId: string, status?: 'pending' | 'cancelled' | 'toreview') =>
    status ? `${base(lakeId)}/rezervari?status=${status}` : `${base(lakeId)}/rezervari`,
  blocks: (lakeId: string) => `${base(lakeId)}/blocaje`,
} as const;

/**
 * The breadcrumb of the operator panel (from 768): «Acasă / Administrare / <title>». «Administrare»
 * is the top bar's menu, not a page, so it has no link; the last crumb is the page's live title —
 * the lake's name, or «Panoul bălții» while no lake is known (loading, signed out, refusals).
 */
export const PANEL_TITLE = 'Panoul bălții';
export const lakeTrail = (title: string = PANEL_TITLE) => [{ label: 'Acasă', href: '/' }, { label: 'Administrare' }, { label: title }];
