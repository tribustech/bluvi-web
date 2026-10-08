import type { Page, Route } from '@playwright/test';

/*
 * Route-mocked raffle for the /tombola specs (participant.raffle-*). A join cannot be undone (the CMS
 * has no leave endpoint), so NO raffle write ever reaches a CMS: the active session, the
 * participation, the join, the receipt POST/DELETE and the profile PATCH are all answered here, and
 * every write's body is recorded for the spec to assert. The profile GET is the real one (the QA
 * account), with the phone optionally blanked.
 *
 * Reused read-only by the later raffle specs (confirmation, status, upload, winners): extend with
 * new options, never change what an existing option returns.
 */

export const SESSION_ID = 'e2e-raffle-session';

export const TYPES = [
  { key: 'crap', label: 'Crap', description: 'Pescuit la crap', badgeColor: 'blue' },
  { key: 'feeder', label: 'Feeder', description: null, badgeColor: '#FFC107' },
  { key: 'rapitor', label: 'Răpitor', description: null, badgeColor: 'green' },
];

export const SESSION_PRIZES = [
  {
    title: 'Kit Crap E2E',
    description: 'Mulinetă și geantă',
    priceLei: 900,
    count: 1,
    typeKey: 'crap',
    image: null,
    items: [
      { label: 'Mulinetă E2E', description: 'Frână față', image: null },
      { label: 'Geantă E2E', description: null, image: null },
    ],
  },
  // A prize with no price: «2 ×» before the title, the description alone under it. Old `subItems`.
  { title: 'Nadă E2E', description: 'Senzor 10kg', priceLei: null, count: 2, typeKey: 'feeder', image: null, subItems: [{ label: 'Sac E2E' }] },
];

export const REGULATION = [
  { title: 'Înscriere E2E', body: 'Te poți înscrie doar în intervalul permis.' },
  { title: 'Validarea bonurilor E2E', body: 'Echipa verifică bonul fiscal.' },
];

export type FakeRaffleOptions = {
  /** none = 404 on /active; the other states shape the session. */
  session?: 'none' | 'active' | 'no-types' | 'closed' | 'ended-winners' | 'ended-empty' | 'error';
  /** The session has no prizes of its own (→ the static fish prizes). */
  noPrizes?: boolean;
  regulationTitle?: string | null;
  joined?: boolean;
  /** The profile's phone is blanked (→ the phone dialog). */
  noPhone?: boolean;
  /** HTTP status of the join / receipt answers (200 = success). */
  joinStatus?: number;
  receiptStatus?: number;
  profileStatus?: number;
  /** Hold every write answer this long (busy states). */
  delayMs?: number;
};

export type FakeRaffle = {
  joins: unknown[];
  receipts: { contentType: string; body: string }[];
  receiptDeletes: number;
  profileWrites: unknown[];
  /** GET counts (invalidations refetch them). */
  reads: { active: number; participation: number; profile: number };
};

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const err = (route: Route, status: number) =>
  json(route, { data: null, error: { status, name: 'Error', message: 'mock failure', details: {} } }, status);

function activeBody(o: FakeRaffleOptions) {
  const s = o.session ?? 'active';
  const ended = s === 'ended-winners' || s === 'ended-empty';
  return {
    data: {
      session: {
        documentId: SESSION_ID,
        startDate: '2026-10-01T00:00:00.000Z',
        endDate: '2026-12-31T21:00:00.000Z',
        prizes: o.noPrizes ? [] : SESSION_PRIZES,
        types: s === 'no-types' ? [] : TYPES,
        registrationCutoffMinutesBeforeEnd: 0,
        previousWinnerAnnouncement: null,
        headerLogoLeft: null,
        headerLogoRight: null,
        dashboardTitle: 'Tragere la sorți E2E',
        dashboardSubtitle: null,
        regulationTitle: o.regulationTitle === undefined ? 'Regulament E2E' : o.regulationTitle,
        regulationSections: REGULATION,
      },
      registrationsByType: { crap: 4, feeder: 1 },
      isRegistrationOpen: s === 'active' || s === 'no-types',
      isEnded: ended,
      hasWinners: s === 'ended-winners',
      winnersByTypeKey: s === 'ended-winners' ? { crap: [{ documentId: 'w1', username: 'Câștigător E2E', avatarUrl: null }] } : {},
    },
  };
}

function participation(joined: boolean, typeKey: string | null = null) {
  return {
    joined,
    entriesCount: joined ? 1 : 0,
    typeKey,
    receiptUploaded: false,
    receiptUnderVerification: false,
    canChangeType: true,
    sessionDocumentId: SESSION_ID,
    receiptImageUrl: null,
  };
}

export async function fakeRaffle(page: Page, o: FakeRaffleOptions = {}): Promise<FakeRaffle> {
  const rec: FakeRaffle = { joins: [], receipts: [], receiptDeletes: 0, profileWrites: [], reads: { active: 0, participation: 0, profile: 0 } };
  let joined = o.joined ?? false;
  let joinedType: string | null = null;
  const hold = () => (o.delayMs ? new Promise((r) => setTimeout(r, o.delayMs)) : Promise.resolve());

  await page.route('**/api/cms/raffle-sessions/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^\/api\/cms/, '');
    if (path === '/raffle-sessions/active' && req.method() === 'GET') {
      rec.reads.active++;
      if (o.session === 'error') return err(route, 500);
      if (o.session === 'none') return err(route, 404);
      return json(route, activeBody(o));
    }
    if (path === '/raffle-sessions/participation' && req.method() === 'GET') {
      rec.reads.participation++;
      return json(route, { data: participation(joined, joinedType) });
    }
    if (path === `/raffle-sessions/${SESSION_ID}/join` && req.method() === 'POST') {
      rec.joins.push(req.postDataJSON());
      await hold();
      if ((o.joinStatus ?? 200) !== 200) return err(route, o.joinStatus!);
      joined = true;
      joinedType = (req.postDataJSON() as { typeKey: string }).typeKey;
      return json(route, { data: participation(true, joinedType) });
    }
    if (path === `/raffle-sessions/${SESSION_ID}/receipt` && req.method() === 'POST') {
      rec.receipts.push({ contentType: req.headers()['content-type'] ?? '', body: req.postDataBuffer()?.toString('latin1') ?? '' });
      await hold();
      if ((o.receiptStatus ?? 200) !== 200) return err(route, o.receiptStatus!);
      return json(route, {
        data: {
          url: 'https://bluvi-staging.s3.eu-central-1.amazonaws.com/e2e-receipt.jpg',
          fileId: 1,
          participation: { ...participation(true, joinedType), entriesCount: 3, receiptUploaded: true, receiptUnderVerification: true },
        },
      });
    }
    if (path === `/raffle-sessions/${SESSION_ID}/receipt` && req.method() === 'DELETE') {
      rec.receiptDeletes++;
      return json(route, { data: participation(true, joinedType) });
    }
    return route.fallback();
  });

  let phoneSaved: string | null = null;
  await page.route('**/api/cms/user/profile', async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      rec.reads.profile++;
      if (o.profileStatus && o.profileStatus !== 200) return err(route, o.profileStatus);
      try {
        const res = await route.fetch();
        const body = await res.json();
        if (o.noPhone) body.phone = phoneSaved;
        return await route.fulfill({ response: res, json: body });
      } catch {
        // The page navigated away or the test ended while the real profile was in flight.
        return;
      }
    }
    if (req.method() === 'PATCH' || req.method() === 'PUT') {
      const data = req.postDataJSON() as { phone?: string };
      rec.profileWrites.push(data);
      await hold();
      phoneSaved = data.phone ?? null;
      return json(route, { ok: true });
    }
    return route.fallback();
  });
  return rec;
}
