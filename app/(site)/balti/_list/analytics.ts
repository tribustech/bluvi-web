import { track as trackEvent, type AnalyticsParams } from '@/lib/analytics';

/*
 * The Bălți list and map events (parity lakes.home.c28, lakes.results-map.c25) with fish's exact
 * names and params, on the site's one channel (lib/analytics.ts).
 */
export type LakesListAnalyticsEvent =
  | 'lake_home_section_impression'
  | 'lake_home_section_click'
  | 'lakes_map_results_view'
  | 'lakes_map_results_focus_applied'
  | 'lakes_map_results_cluster_tap'
  | 'lakes_map_results_pin_tap'
  | 'lakes_map_results_locate_me'
  | 'lakes_map_clear_filters'
  | 'lakes_map_results_pin_card_view_page'
  | 'lakes_map_results_pin_card_dismiss'
  | 'lakes_pin_card_open_maps';

/** Dispatches one event; null / undefined params are left out (fish passes `undefined`). */
export function track(name: LakesListAnalyticsEvent, params: AnalyticsParams = {}) {
  trackEvent(name, params);
}
