/*
 * routes.competitionRanking (`/concursuri/<id>/clasament`, used by the home cards) serves the same
 * Clasament screen as `/concursuri/<id>`: Clasament is the competition's default tab, and the
 * page's canonical points at `/concursuri/<id>`, so search engines see one page.
 */
export { default, generateMetadata, generateStaticParams } from '../page';
// Segment config is read statically from each page file, so it is not re-exported: same opt-out as ../page.
export const instant = false;
