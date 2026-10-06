import { track as trackEvent } from '@/lib/analytics';

/*
 * The lake page's analytics events (parity lakes.detail.c33, lakes.share.c6,
 * lakes.booking-interest.c7, lakes.b.analytics) — fish logs them with Firebase Analytics. They go
 * out on the site's one channel (lib/analytics.ts) with fish's exact names and params.
 */
export type LakeAnalyticsEvent =
  | 'share_lake_button_pressed'
  | 'share_lake'
  | 'copy_lake_share_text'
  | 'lake_booking_cta_pressed'
  | 'lake_booking_interest_sheet_viewed'
  | 'lake_booking_interest_submitted'
  | 'lake_booking_interest_owner_pressed'
  | 'contact_pressed';

export function track(name: LakeAnalyticsEvent, params: Record<string, string | number | boolean>) {
  trackEvent(name, params);
}
