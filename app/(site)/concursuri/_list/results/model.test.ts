import { describe, expect, it } from 'vitest';
import type { CompetitionCard } from '@/core/competitions';
import { dayParts } from '../desktop/dates';
import { miniRanking } from '../desktop/model';
import { entrantsLine, headlineLabel, resultGroups, resultView, rowHeadline, typeStats, unitWord, type RawRanking } from './model';

/* competitions-list.incheiate c16 (rows by day), c17 (the per-type headline), c19 (podium), c20 (type tiles), c21 (places 4–8). */

type Results = NonNullable<CompetitionCard['results']>;
const results = (over: Partial<Results> = {}): Results => ({
  capturedAt: '2026-10-05T14:00:00Z',
  hasCatches: true,
  catchCount: 61,
  totalKg: 486.2,
  biggestFishKg: 14.6,
  podium: [
    { position: 1, tied: false, displayName: 'Costin Vlad', standName: '4', clubName: null, avatarUrls: ['https://x/a.jpg'] },
    { position: 2, tied: false, displayName: 'Eduard Grigore', standName: '7', clubName: null, avatarUrls: [] },
    { position: 3, tied: false, displayName: 'Sebastian Dinu', standName: '1', clubName: null, avatarUrls: [] },
  ],
  ...over,
});

const card = (over: Partial<CompetitionCard> = {}): CompetitionCard =>
  ({
    id: 1,
    documentId: 'c1',
    name: 'Cupa',
    startDate: '2026-10-05T05:00:00Z',
    endDate: '2026-10-05T13:00:00Z',
    dateLabel: '5 oct',
    status: 'completed',
    format: { kind: 'single', teamSize: null, unit: 'pescari' },
    rankingType: 'quantity',
    rankingLabel: 'Cantitate',
    banner: null,
    lake: null,
    organizer: null,
    joinedCount: 30,
    pendingCount: 0,
    capacity: null,
    placesLeft: null,
    viewers: 0,
    participantFaces: [],
    results: results(),
    rounds: null,
    ...over,
  }) as CompetitionCard;

const row = (name: string, pos: number, over: Record<string, unknown> = {}) => ({
  registrationId: `r-${pos}`,
  participant: { id: pos, username: name },
  sectorName: 'A',
  standId: pos,
  standName: String(pos),
  catchCount: 3,
  generalPosition: pos,
  ...over,
});

const quantity: RawRanking = {
  metadata: { rankingType: 'quantity', totalQuantity: 486.2, totalCatchesCount: 61, numberOfSectors: 3, biggestCatch: { weight: 14.6, participants: [{ username: 'Costin Vlad' }], sectorName: 'A', standName: '4' } },
  rankings: [
    row('Costin Vlad', 1, { quantity: 52.8 }),
    row('Eduard Grigore', 2, { quantity: 49.1 }),
    row('Sebastian Dinu', 3, { quantity: 44.6 }),
    row('Paul Ene', 4, { quantity: 39.2, sectorName: 'B' }),
    row('Răzvan Oprea', 5, { quantity: 35.7 }),
    row('Fără Pește', 6, { quantity: 0, catchCount: 0 }),
  ],
};

describe('resultGroups — one group per day, latest first', () => {
  const today = dayParts('2026-10-06T09:00:00Z').index;
  const a = card({ documentId: 'a', endDate: '2026-10-05T13:00:00Z' });
  const b = card({ documentId: 'b', endDate: '2026-10-04T13:00:00Z' });
  const c = card({ documentId: 'c', endDate: '2026-10-05T15:00:00Z' });
  const old = card({ documentId: 'o', startDate: '2025-09-20T05:00:00Z', endDate: '2025-09-20T13:00:00Z' });

  it('a day is never split, even when the CMS order interleaves days', () => {
    const g = resultGroups([a, b, c, old], null);
    expect(g.map((x) => x.cards.map((k) => k.documentId))).toEqual([['a', 'c'], ['b'], ['o']]);
  });

  it('server render: dates only; in the browser «Ieri» with the date beside it', () => {
    expect(resultGroups([a, b], null)[0]).toMatchObject({ label: 'Luni, 5 octombrie', date: null });
    expect(resultGroups([a, b], today)[0]).toMatchObject({ label: 'Ieri', date: 'Luni, 5 octombrie' });
    expect(resultGroups([a, b], today)[1].label).toBe('Duminică, 4 octombrie');
  });

  it('another year than the newest result says its year', () => {
    expect(resultGroups([a, old], null)[1].label).toBe('Sâmbătă, 20 septembrie 2025');
  });
});

describe('headline — the figure each ranking type is judged by', () => {
  it('labels per type', () => {
    expect(headlineLabel('quantity', quantity)).toBe('Total');
    expect(headlineLabel('bestOf', { rankings: [], metadata: { bestOfFishCount: 5 } })).toBe('Medie Best 5');
    expect(headlineLabel('feederRounds', { rankings: [], metadata: { roundsCount: 2 } })).toBe('Puncte · 2 manșe');
    expect(headlineLabel('nationalChampionship', null)).toBe('Puncte club');
    expect(headlineLabel('quality', { rankings: [{ sectorMinNumberOfFish: 5 }], metadata: {} })).toBe('Medie top 5');
  });

  it('points agree in Romanian', () => {
    expect(unitWord('puncte', 1)).toBe('punct');
    expect(unitWord('puncte', 3)).toBe('puncte');
    expect(unitWord('puncte', 20)).toBe('de puncte');
    expect(unitWord('puncte', 2.5)).toBe('puncte');
    expect(unitWord('kg', 1)).toBe('kg');
  });

  it('before the ranking is read the headline slot keeps its label with no value; CMMC is its own field, never the headline', () => {
    const c = card();
    const h = rowHeadline(c, null, null, resultView(c, null));
    expect(h.winner).toMatchObject({ name: 'Costin Vlad', faces: ['https://x/a.jpg'] });
    expect(h.figure).toEqual({ label: 'Total', value: null, unit: 'kg' });
    expect(h.cmmcKg).toBe(14.6);
  });

  it('opening only fills the slot: the closed label is the read label, or its prefix', () => {
    const feeder = card({ rankingType: 'feederRounds', rounds: { current: 2, count: 2, status: 'closed' } });
    expect(headlineLabel('feederRounds', null, feeder)).toBe('Puncte · 2 manșe');
    expect(headlineLabel('bestOf', null)).toBe('Medie');
    expect(headlineLabel('quality', null)).toBe('Medie');
  });

  it('no catches: no headline at all; results unavailable: the label, no value, no claim', () => {
    const zero = card({ results: results({ hasCatches: false, podium: [], biggestFishKg: null }) });
    expect(rowHeadline(zero, null, null, resultView(zero, null))).toMatchObject({ winner: null, figure: null, cmmcKg: null });
    const unknown = card({ results: null });
    expect(rowHeadline(unknown, null, null, resultView(unknown, null))).toMatchObject({ winner: null, figure: { label: 'Total', value: null } });
  });

  it('NC / FIPSed closed: the winning CLUB (first team’s club, square), never the team; no club name = nobody yet', () => {
    const nc = (clubName: string | null) =>
      card({ rankingType: 'nationalChampionship', results: results({ podium: [{ position: 1, tied: false, displayName: 'Echipa Alba 1', standName: null, clubName, avatarUrls: [] }] }) });
    const h = rowHeadline(nc('CS Carpathia'), null, null, resultView(nc('CS Carpathia'), null));
    expect(h).toMatchObject({ winner: { name: 'CS Carpathia', club: true }, winnerLabel: 'Club câștigător', figure: { label: 'Puncte club', value: null } });
    expect(rowHeadline(nc(null), null, null, resultView(nc(null), null))).toMatchObject({ winner: null, winnerLabel: 'Club câștigător' });
  });

  it('with the ranking: «Total 52,8 kg»', () => {
    const c = card();
    const r = miniRanking(quantity);
    expect(rowHeadline(c, r, quantity, resultView(c, r)).figure).toEqual({ label: 'Total', value: 52.8, unit: 'kg' });
  });
});

describe('resultView — podium and places 4–8', () => {
  it('the ranking backs the podium (values), faces come from the card; no-catch rows never become places', () => {
    const c = card();
    const v = resultView(c, miniRanking(quantity));
    expect(v.fromRanking).toBe(true);
    expect(v.podium.map((e) => [e.name, e.value])).toEqual([
      ['Costin Vlad', 52.8],
      ['Eduard Grigore', 49.1],
      ['Sebastian Dinu', 44.6],
    ]);
    expect(v.podium[0].faces).toEqual(['https://x/a.jpg']);
    expect(v.places.map((e) => e.name)).toEqual(['Paul Ene', 'Răzvan Oprea']);
    expect(v.places[0].sector).toBe('B');
  });

  it('a ranking that crowns someone else: the card’s podium, without values, and flagged', () => {
    const c = card({ results: results({ podium: [{ position: 1, tied: false, displayName: 'Altcineva', standName: null, clubName: null, avatarUrls: [] }] }) });
    const v = resultView(c, miniRanking(quantity));
    expect(v).toMatchObject({ fromRanking: false, disagrees: true, places: [] });
    expect(v.podium[0]).toMatchObject({ name: 'Altcineva', value: null });
  });

  it('a team keeps its 2–3 members’ faces', () => {
    const c = card({ results: results({ podium: [{ position: 1, tied: false, displayName: 'Echipa Mureș', standName: null, clubName: null, avatarUrls: ['1', '2', '3', '4'] }] }) });
    expect(resultView(c, null).podium[0].faces).toEqual(['1', '2', '3']);
  });

  it('NC / FIPSed: the clubs’ podium in points, the fewest win', () => {
    const raw: RawRanking = {
      metadata: { rankingType: 'nationalChampionship' },
      rankings: [
        { clubId: 'k1', clubName: 'CS Carpathia', clubPoints: 8, clubPosition: 1, clubTotalCatchCount: 40, clubTotalQuantity: 142.6, teams: [{ sectorPoints: 1 }, { sectorPoints: 1 }, { sectorPoints: 3 }] },
        { clubId: 'k2', clubName: 'Crap Mureș', clubPoints: 11, clubPosition: 2, clubTotalCatchCount: 30, teams: [] },
      ],
    };
    const c = card({ rankingType: 'nationalChampionship' });
    const v = resultView(c, miniRanking(raw));
    expect(v.podium.map((e) => [e.name, e.value, e.club])).toEqual([
      ['CS Carpathia', 8, true],
      ['Crap Mureș', 11, true],
    ]);
    expect(v.lowerIsBetter).toBe(true);
    const s = typeStats(c, raw);
    expect(s.tiles.find((t) => t.label === 'sectoare câștigate')?.value).toBe('2/3');
    expect(s.tiles.find((t) => t.label === 'cluburi')?.value).toBe('2');
  });
});

describe('typeStats — what made the winner, per ranking type', () => {
  it('quantity: CMMC with its angler, catches, total, average per stand, stands with fish', () => {
    const s = typeStats(card(), quantity);
    expect(s.title).toMatch(/cea mai mare cantitate/);
    expect(s.tiles.map((t) => t.label)).toEqual(['CMMC', 'capturi', 'cântărite în concurs', 'medie pe stand', 'standuri cu pește']);
    expect(s.tiles[0]).toMatchObject({ value: '14,6', sub: 'Costin Vlad' });
    expect(s.tiles[4]).toMatchObject({ value: '83', sub: '5 din 6' });
  });

  it('bestOf: the winner’s best N fish, heaviest first', () => {
    const raw: RawRanking = { metadata: { rankingType: 'bestOf', bestOfFishCount: 3 }, rankings: [{ catches: [{ weight: 2 }, { weight: 9.4 }, { weight: 7 }, { weight: 8.1 }] }] };
    expect(typeStats(card({ rankingType: 'bestOf' }), raw).fish).toEqual({ title: 'Best 3 al câștigătorului', kgs: [9.4, 8.1, 7] });
  });

  it('feeder: the sector place in every leg, legs won', () => {
    const raw: RawRanking = {
      metadata: { rankingType: 'feederRounds', roundsCount: 2 },
      rankings: [{ rounds: [{ round: 1, sectorPosition: 1, quantity: 4.18 }, { round: 2, sectorPosition: 2, quantity: 3.62 }] }],
    };
    const s = typeStats(card({ rankingType: 'feederRounds' }), raw);
    expect(s.tiles.slice(0, 3).map((t) => [t.value, t.label])).toEqual([
      ['Locul 1', 'manșa 1 · în sector'],
      ['Locul 2', 'manșa 2 · în sector'],
      ['1/2', 'manșe câștigate'],
    ]);
  });

  it('without the ranking: the card’s own figures', () => {
    expect(typeStats(card(), null).tiles.map((t) => t.label)).toEqual(['CMMC', 'capturi', 'cântărite în concurs']);
  });

  it('the footer: «30 de pescari · 3 sectoare»', () => {
    expect(entrantsLine(card(), quantity)).toBe('30 de pescari · 3 sectoare');
  });
});
