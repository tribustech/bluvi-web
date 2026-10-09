'use client';

import { useEffect } from 'react';
import { track, type AnalyticsParams } from '@/lib/analytics';

/** Reads `data-analytics-params` (a JSON object of scalars); anything else counts as no params. */
export function readAnalyticsParams(raw: string | null): AnalyticsParams {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: AnalyticsParams = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** The handler (exported for unit tests): the closest [data-analytics-event] of the click's target. */
export function onAnalyticsClick(e: MouseEvent): void {
  const target = e.target instanceof Element ? e.target : null;
  const el = target?.closest<HTMLElement>('[data-analytics-event]');
  const name = el?.dataset.analyticsEvent;
  if (!el || !name) return;
  track(name, readAnalyticsParams(el.getAttribute('data-analytics-params')));
}

/**
 * One delegated click listener for markup that carries what fish logs on press, without a client
 * handler of its own (server-rendered rich text: news_link_clicked, sponsor_link_clicked —
 * app/(site)/stiri/_content). Capture phase: a link that navigates away is still counted.
 */
export function AnalyticsLinkListener(): null {
  useEffect(() => {
    document.addEventListener('click', onAnalyticsClick, true);
    return () => document.removeEventListener('click', onAnalyticsClick, true);
  }, []);
  return null;
}
