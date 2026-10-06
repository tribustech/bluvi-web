import { track } from '@/lib/analytics';

/*
 * The ranking image's analytics (parity competition-page.imagine-clasament.c9, clasament «Vezi full»)
 * — fish logs them with Firebase Analytics. They go out on the site's one channel (lib/analytics.ts)
 * with fish's exact names and params.
 */
export type RankingImageEvent =
  | 'ranking_image_pressed'
  | 'download_ranking_image'
  | 'share_ranking_image'
  | 'download_cn_ranking_image'
  | 'share_cn_ranking_image';

export function trackRankingImage(name: RankingImageEvent, competition: { id: string; name: string }) {
  track(name, { competition_id: competition.id, competition_name: competition.name });
}
