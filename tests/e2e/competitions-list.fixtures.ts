/*
 * Hand-made /feed/competition-cards bodies for the Concursuri list e2e (competitions-list.spec.ts):
 * every card state the local CMS does not have (podium ties, guests without photo, a live feeder on
 * legs, no poster, extreme posters, null results). Served through page.route for the «Urmărite»
 * list, which the server never prefetches without ?scope=followed — so the browser asks for it and
 * the mock answers.
 */

type Card = Record<string, unknown>;

const IMG = 'http://localhost:1337/uploads/fixture.jpg';
// A 1×1 PNG, so a mocked poster really decodes (no broken-image noise in the console).
export const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export function card(id: string, over: Card = {}): Card {
  return {
    id: 1,
    documentId: id,
    name: `Fixture ${id}`,
    startDate: '2026-10-20T05:00:00.000Z',
    endDate: '2026-10-20T13:00:00.000Z',
    dateLabel: '20 oct',
    hoursLabel: '08:00–16:00',
    status: 'notStarted',
    format: { kind: 'single', teamSize: null, unit: 'pescari' },
    rankingType: 'quantity',
    rankingLabel: 'Cantitate',
    banner: null,
    lake: { documentId: 'lake-fx', name: 'Balta Fixture', county: null, image: media() },
    organizer: { documentId: 'org-fx', username: 'organizator_fx', avatarUrl: null },
    joinedCount: 6,
    pendingCount: 0,
    capacity: 10,
    placesLeft: 4,
    viewers: 2,
    participantFaces: [],
    results: null,
    rounds: null,
    ...over,
  };
}

export function media(over: Partial<{ width: number | null; height: number | null; url: string }> = {}) {
  return { url: `${IMG}?o`, smallUrl: `${IMG}?s`, mediumUrl: `${IMG}?m`, blurhash: null, width: null, height: null, ...over };
}

export function page(cards: Card[], over: { total?: number; counts?: Record<string, number>; page?: number; pageCount?: number } = {}) {
  return {
    data: cards,
    meta: {
      pagination: { page: over.page ?? 1, pageSize: 20, pageCount: over.pageCount ?? 1, total: over.total ?? cards.length },
      counts: over.counts ?? { notStarted: 1, started: 1, completed: 1 },
    },
  };
}

const results = (over: Card = {}) => ({
  capturedAt: '2026-10-05T10:00:00.000Z',
  hasCatches: true,
  catchCount: 23,
  totalKg: 1024.291,
  biggestFishKg: 7.6465,
  podium: [],
  ...over,
});

/** One card per state the cards criteria name. */
export const STATE_CARDS = {
  upcomingPending: card('fx-up-pending', { name: 'FX Viitor cu așteptare', pendingCount: 2, placesLeft: 1, joinedCount: 9, viewers: 1 }),
  upcomingNoCapacity: card('fx-up-nocap', { name: 'FX Viitor fără limită', capacity: null, placesLeft: null, joinedCount: 24, format: { kind: 'team', teamSize: 3, unit: 'echipe' } }),
  upcomingFull: card('fx-up-full', { name: 'FX Viitor complet', capacity: 10, joinedCount: 10, placesLeft: 0 }),
  liveNoResults: card('fx-live-null', { name: 'FX Live fără statistici', status: 'started', results: null }),
  liveNoCatches: card('fx-live-zero', { name: 'FX Live fără capturi', status: 'started', results: results({ hasCatches: false, catchCount: 0, totalKg: null, biggestFishKg: null }) }),
  liveCatches: card('fx-live-catch', {
    name: 'FX Live cu capturi',
    status: 'started',
    joinedCount: 24,
    results: results(),
  }),
  liveNoTotal: card('fx-live-nototal', { name: 'FX Live fără total', status: 'started', results: results({ totalKg: null, biggestFishKg: null }) }),
  liveFeeder: card('fx-live-feeder', {
    name: 'FX Feeder pe manșe',
    status: 'started',
    rankingLabel: 'Feeder',
    rounds: { current: 1, count: 2, status: 'running' },
    results: results(),
  }),
  liveFeederSingle: card('fx-live-feeder1', {
    name: 'FX Feeder o manșă',
    status: 'started',
    rankingLabel: 'Feeder',
    rounds: { current: 1, count: 1, status: 'running' },
    results: results(),
  }),
  doneNull: card('fx-done-null', { name: 'FX Încheiat fără rezultate', status: 'completed', results: null }),
  doneNoCatches: card('fx-done-zero', { name: 'FX Încheiat fără capturi', status: 'completed', results: results({ hasCatches: false }) }),
  doneEmptyPodium: card('fx-done-nopodium', { name: 'FX Încheiat fără podium', status: 'completed', results: results({ podium: [] }) }),
  donePodium: card('fx-done-podium', {
    name: 'FX Încheiat cu podium',
    status: 'completed',
    format: { kind: 'team', teamSize: 2, unit: 'echipe' },
    results: results({
      podium: [
        { position: 2, displayName: 'Echipa Doi', tied: false, standName: '7', clubName: 'CS Crap', avatarUrls: [`${IMG}?a1`, `${IMG}?a2`] },
        { position: 1, displayName: 'Echipa Unu', tied: false, standName: '3', clubName: null, avatarUrls: [`${IMG}?a3`] },
        { position: 3, displayName: 'Ion Oaspete', tied: false, standName: null, clubName: null, avatarUrls: [] },
        { position: 3, displayName: 'Vasile Egal', tied: false, standName: null, clubName: null, avatarUrls: [] },
      ],
    }),
  }),
  noPoster: card('fx-noposter', { name: 'FX Live fără afiș', status: 'started', lake: null, banner: null, results: results() }),
  tallPoster: card('fx-tall', { name: 'FX Afiș foarte înalt', banner: media({ width: 200, height: 1000 }) }),
  widePoster: card('fx-wide', { name: 'FX Afiș lat', banner: media({ width: 1600, height: 900 }) }),
};
