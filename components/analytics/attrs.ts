import type { AnalyticsParams } from '@/lib/analytics';

/**
 * The data-analytics-* attributes AnalyticsLinkListener reads: lets server-rendered links log what
 * fish logs on press without a client handler. Null / undefined params are left out (as track()).
 *
 *   <Link href={…} {...analyticsAttrs('sponsor_dashboard', { sponsor_id, sponsor_name, sponsor_url })}>
 */
export function analyticsAttrs(event: string, params: AnalyticsParams = {}): Record<'data-analytics-event' | 'data-analytics-params', string> {
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) if (v != null) clean[k] = v;
  return { 'data-analytics-event': event, 'data-analytics-params': JSON.stringify(clean) };
}
