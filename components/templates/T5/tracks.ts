import { TRACKS } from '../tracks';

/**
 * Column tracks of a T5 body from 1280 — the shared template scale (components/templates/tracks.ts:
 * left 240 / 256, right 320 / 360, gap 24), one source for DashboardLayout and DashboardSkeleton,
 * so the skeleton has the page's geometry and Acasă's centre column has the same edges as every
 * other template's.
 */
export const DASHBOARD_TRACKS = {
  three: TRACKS.three,
  mainAside: TRACKS.mainRight,
  contextMain: TRACKS.leftMain,
  mainAsideThenThree: TRACKS.mainRightThenThree,
} as const;

export function dashboardTracks(context: boolean, aside: boolean, contextFrom: 'xl' | '2xl' = 'xl'): string {
  if (context && aside) return contextFrom === '2xl' ? DASHBOARD_TRACKS.mainAsideThenThree : DASHBOARD_TRACKS.three;
  if (aside) return DASHBOARD_TRACKS.mainAside;
  if (context) return DASHBOARD_TRACKS.contextMain;
  return '';
}
