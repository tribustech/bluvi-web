import { describe, expect, it } from 'vitest';
import { getPulsePeople, getPulsePerson, getRecentWeighings } from '@/core/competitions';
import { getWeighingById } from '@/core/organizer';
import { baseInit, buildPath, performFetch, type Transport, type TransportRequest } from '@/core/transport';

/*
 * Web-only feed endpoints that ship on CMS staging before the local checkout has them
 * (/feed/recent-weighings, /feed/pulse-person?limit). Public GETs only, as a guest, against
 * STAGING_CMS_URL (default https://api-staging.bluvi.ro/api). No credentials, no writes.
 */

const STAGING = (process.env.STAGING_CMS_URL ?? 'https://api-staging.bluvi.ro/api').replace(/\/$/, '');

const staging: Transport = {
  async request<T>(req: TransportRequest) {
    if (req.auth !== 'none') throw new Error('staging contract tests read public endpoints only');
    const path = buildPath(req.path, req.query);
    return performFetch<T>(fetch, `${STAGING}${path}`, baseInit(req, '2.0.0-test', {}), req.path);
  },
};

describe('staging — web feed endpoints', () => {
  it('parses /feed/recent-weighings, and each item opens its weighing detail', async () => {
    const items = await getRecentWeighings(staging);
    expect(Array.isArray(items)).toBe(true);
    for (const w of items.slice(0, 3)) {
      const detail = await getWeighingById(staging, w.weighingDocumentId);
      expect(detail.documentId).toBe(w.weighingDocumentId);
    }
  });

  it('parses /feed/pulse-person?limit=6 (items) and still the plain /feed/pulse-person', async () => {
    const people = await getPulsePeople(staging, 6);
    expect(people.length).toBeLessThanOrEqual(6);
    await getPulsePerson(staging);
  });
});
