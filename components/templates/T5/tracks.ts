/**
 * Column tracks of a T5 body from 1280, on the spacing scale (one source for DashboardLayout and
 * DashboardSkeleton, so the skeleton has the page's geometry). The side columns stay narrow so the
 * centre — where the work is — gets the width: at 1280 (1216 inside the gutters) 224 · 680 · 264,
 * from 1440 (1376) 256 · 752 · 320, with a 24px gap at both.
 */
export const DASHBOARD_TRACKS = {
  three: 'xl:grid-cols-[--spacing(56)_minmax(0,1fr)_--spacing(66)] 2xl:grid-cols-[--spacing(64)_minmax(0,1fr)_--spacing(80)]',
  mainAside: 'xl:grid-cols-[minmax(0,1fr)_--spacing(66)] 2xl:grid-cols-[minmax(0,1fr)_--spacing(80)]',
  contextMain: 'xl:grid-cols-[--spacing(56)_minmax(0,1fr)] 2xl:grid-cols-[--spacing(64)_minmax(0,1fr)]',
} as const;

export function dashboardTracks(context: boolean, aside: boolean): string {
  if (context && aside) return DASHBOARD_TRACKS.three;
  if (aside) return DASHBOARD_TRACKS.mainAside;
  if (context) return DASHBOARD_TRACKS.contextMain;
  return '';
}
