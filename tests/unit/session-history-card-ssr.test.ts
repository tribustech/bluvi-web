import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SessionHistoryCard } from '@/components/account/angler/SessionHistoryCard';
import type { PublicSession } from '@/core/social';

/*
 * account.angler-profile c24: the server render (and the HTML before hydration) of a LIVE session.
 * The CMS sends durationMs 0 for it (computed from endedAt), and there is no clock on the server
 * (useNowTick → null), so the «de pescuit» figure must be «—», never «0 min» (owner rule 4).
 * A Playwright request.get cannot reach this state: the server reads the tab from the CMS itself.
 */
const live: PublicSession = {
  documentId: 'ses-live',
  venueName: 'Balta Mock',
  photoUrl: null,
  startedAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  durationMs: 0,
  isActive: true,
  catches: 20,
  totalKg: 3.2,
  maxKg: 3.2,
  isPersonalRecord: false,
  locality: null,
  standName: null,
  endedAt: null,
  photos: [],
  photoCount: 0,
} as PublicSession;

describe('SessionHistoryCard server render', () => {
  it('a live card shows «—» de pescuit, not the CMS’s 0, and no footer span before the clock exists', () => {
    const html = renderToString(createElement(SessionHistoryCard, { session: live }));
    expect(html).toContain('de pescuit');
    expect(html).toMatch(/>—<\/dd>/);
    expect(html).not.toMatch(/>0\s*min</);
    expect(html).not.toContain('Începută acum');
  });

  it('20 catches take formatCount’s «de» (20 / de capturi)', () => {
    const html = renderToString(createElement(SessionHistoryCard, { session: { ...live, isActive: false, durationMs: 3_600_000 } }));
    expect(html).toContain('de capturi');
  });
});
