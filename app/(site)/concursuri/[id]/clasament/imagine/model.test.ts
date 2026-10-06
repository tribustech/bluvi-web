import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { FeederRoundsRanking, NationalChampionshipStandRanking, RankingResponse } from '@/core/competitions';
import { buildRankingImage, effectiveImageQuery, imageQueryFor, imageQueryString, imageSummary, parseImageQuery, statusText, viewLabel, type ImageCompetition } from './model';
import { columnWidths, headPairs, imageDateTime, sheetGeometry, sheetSize, statLines, tableHead, tierHead } from './png/sheet';
import { contrastOn, inkOn, parseTokens, TYPE_STEPS, withAlpha } from './png/tokens';

const css = () => readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

const competition = (o: Partial<ImageCompetition> = {}): ImageCompetition => ({
  documentId: 'c1',
  name: 'Cupa / Toamnei',
  rankingType: 'quantity',
  competitionStatus: 'completed',
  competitionType: 'single',
  startDate: '2026-10-03T06:00:00.000Z',
  endDate: '2026-10-04T18:00:00.000Z',
  author: { username: 'Org' },
  lake: { name: 'Chita' },
  sectors: [
    { documentId: 'sA', name: 'A' },
    { documentId: 'sB', name: 'B' },
  ],
  sponsors: [],
  ...o,
});

const meta = { totalQuantity: 30, totalCatchesCount: 9, biggestFish: 5.5, numberOfSectors: 2, biggestCatch: null };

const qRow = (sector: string, stand: string, place: number, kg: number) => ({
  sectorId: `s${sector}`,
  sectorName: sector,
  standId: `${sector}${stand}`,
  standName: stand,
  participant: { username: `P${sector}${stand}` },
  biggestFish: 1,
  catchCount: kg ? 2 : 0,
  sectorPosition: 1,
  generalPosition: place,
  quantity: kg,
  quantityPoints: 1,
});

const quantity = {
  rankings: [qRow('B', '2', 1, 20), qRow('A', '1', 2, 10), qRow('A', '3', 3, 0)],
  metadata: { ...meta, rankingType: 'quantity' },
} as unknown as RankingResponse;

describe('image query (c10: the URL names the table)', () => {
  it('parses and serialises, defaults left out', () => {
    expect(parseImageQuery(new URLSearchParams('sortare=loc&sector=b&mansa=2'))).toEqual({ sort: 'loc', sector: 'B', leg: 2 });
    expect(parseImageQuery({ sortare: 'x', sector: 'not a sector', mansa: '0' })).toEqual({ sort: null, sector: null, leg: 'general' });
    expect(imageQueryString({ sort: null, sector: null, leg: 'general' })).toBe('');
    expect(imageQueryString({ sort: 'stand', sector: 'C', leg: 3 })).toBe('?sortare=stand&sector=C&mansa=3');
  });

  it('maps the page state to the query', () => {
    const base = { sortBy: 'stand' as const, feederTab: 'general' as const, ncSectorName: null, ncSort: 'position' as const };
    expect(imageQueryFor({ ...base, rankingType: 'quantity' })).toEqual({ sort: null });
    expect(imageQueryFor({ ...base, rankingType: 'quantity', sortBy: 'position' })).toEqual({ sort: 'loc' });
    expect(imageQueryFor({ ...base, rankingType: 'feederRounds', feederTab: 2 as never })).toEqual({ leg: 2 });
    expect(imageQueryFor({ ...base, rankingType: 'nationalChampionship', ncSort: 'club' })).toEqual({ sector: null, sort: 'club' });
    expect(imageQueryFor({ ...base, rankingType: 'fipsed', ncSectorName: 'b', ncSort: 'stand' })).toEqual({ sector: 'B', sort: 'stand' });
  });
});

describe('buildRankingImage', () => {
  it('standard: the screen table in the chosen order, the file name, no title', () => {
    const byStand = buildRankingImage(competition(), quantity, parseImageQuery({}));
    expect(byStand.ok).toBe(true);
    if (!byStand.ok || byStand.model.table.kind !== 'table') throw new Error('table');
    expect(byStand.model.table.rows.map(r => r.position)).toEqual(['A/1', 'A/3', 'B/2']);
    expect(byStand.model.table.rows.map(r => r.sectorLetter)).toEqual(['A', 'A', 'B']);
    expect(byStand.model.title).toBeNull();
    expect(byStand.model.fileName).toBe('Clasament_Cupa Toamnei');
    expect(byStand.model.rankingLabel).toBe('Cantitate');
    const byPlace = buildRankingImage(competition(), quantity, parseImageQuery({ sortare: 'loc' }));
    if (!byPlace.ok || byPlace.model.table.kind !== 'table') throw new Error('table');
    expect(byPlace.model.table.rows.map(r => r.generalPosition)).toEqual([1, 2, 3]);
  });

  it('nothing to draw: no ranking, no rows or no numberOfSectors (fish disables «Vezi full»)', () => {
    expect(buildRankingImage(competition(), null, parseImageQuery({}))).toEqual({ ok: false, reason: 'noWeighing' });
    expect(buildRankingImage(competition(), { ...quantity, rankings: [] } as RankingResponse, parseImageQuery({}))).toEqual({ ok: false, reason: 'noWeighing' });
    expect(
      buildRankingImage(competition(), { ...quantity, metadata: { ...quantity.metadata, numberOfSectors: 0 } } as RankingResponse, parseImageQuery({})),
    ).toEqual({ ok: false, reason: 'noWeighing' });
  });

  const team = (sector: string, stand: string, o: Partial<NationalChampionshipStandRanking['teams'][number]> = {}) => ({
    sectorId: `s${sector}`,
    sectorName: sector,
    standId: `${sector}${stand}`,
    standName: stand,
    teamName: '',
    guestName: null,
    participants: [{ username: `U${sector}${stand}` }],
    registrationId: `r${sector}${stand}`,
    biggestFish: 2,
    catchCount: 3,
    sectorPosition: 1,
    generalPosition: 1,
    quantity: 6,
    averageWeight: 2,
    sectorPoints: 1,
    sectorDrawPosition: null,
    ...o,
  });
  const club = (id: string, position: number, teams: ReturnType<typeof team>[]) => ({
    clubId: id,
    clubName: `Club ${id}`,
    clubPoints: position,
    clubPosition: position,
    clubAverageWeight: 2,
    clubTotalQuantity: 12,
    clubTotalCatchCount: 6,
    clubBiggestCatch: 4,
    teams,
  });
  const nc = {
    rankings: [
      club('2', 2, [team('A', '1', { quantity: 4, catchCount: 2, biggestFish: 3 }), team('B', '5', { quantity: 7, catchCount: 1, biggestFish: 7 })]),
      club('1', 1, [team('A', '2'), team('B', '6', { quantity: 1, catchCount: 1, biggestFish: 1 })]),
    ],
    metadata: { ...meta, rankingType: 'nationalChampionship' },
  } as unknown as RankingResponse;

  it('National Championship General: the club table (ranking-image-cn), clubs by place unless «Club»', () => {
    const r = buildRankingImage(competition({ rankingType: 'nationalChampionship' }), nc, parseImageQuery({}));
    if (!r.ok || r.model.table.kind !== 'ncGeneral') throw new Error('nc');
    expect(r.model.nc).toBe(true);
    expect(r.model.fileName).toBe('Clasament_Campionat_National_Cupa Toamnei');
    expect(r.model.table.clubs.map(c => c.clubId)).toEqual(['1', '2']);
    const byClub = buildRankingImage(competition({ rankingType: 'nationalChampionship' }), nc, parseImageQuery({ sortare: 'club' }));
    if (!byClub.ok || byClub.model.table.kind !== 'ncGeneral') throw new Error('nc');
    expect(byClub.model.table.clubs.map(c => c.clubId)).toEqual(['2', '1']);
  });

  it('National Championship sector: «Sector B» in its colour, the sector rows, the sector totals', () => {
    const r = buildRankingImage(competition({ rankingType: 'nationalChampionship' }), nc, parseImageQuery({ sector: 'B' }));
    if (!r.ok || r.model.table.kind !== 'table') throw new Error('sector');
    expect(r.model.nc).toBe(false);
    expect(r.model.title).toEqual({ text: 'Sector B', sectorLetter: 'B' });
    expect(r.model.table.columns.map(c => c.title)).toEqual(['Stand', 'Club', 'Pescari', 'Kg', 'Medie', 'CMMC', 'Nr. Buc', 'Puncte sector', 'Loc sector']);
    expect(r.model.table.rows.map(row => row.position)).toEqual(['B5', 'B6']);
    expect(r.model.stats).toEqual({ totalQuantity: 8, totalCatchesCount: 2, biggestFish: 7 });
    // An unknown sector letter falls back to General.
    const unknown = buildRankingImage(competition({ rankingType: 'nationalChampionship' }), nc, parseImageQuery({ sector: 'Q' }));
    expect(unknown.ok && unknown.model.table.kind).toBe('ncGeneral');
  });

  const entrant = (id: string, place: number, legs: { round: number; sector: string; stand: string; points: number | null; kg: number }[]) =>
    ({
      registrationId: id,
      participant: { username: id },
      participants: [],
      teamName: null,
      guestName: null,
      sectorDrawPosition: null,
      standId: null,
      standName: null,
      sectorName: null,
      rounds: legs.map(l => ({ round: l.round, sectorName: l.sector, standId: null, standName: l.stand, quantity: l.kg, catchCount: 1, biggestFish: l.kg, points: l.points, sectorPosition: 1 })),
      totalPoints: 2,
      quantity: 5,
      catchCount: 2,
      biggestFish: 3,
      roundsFished: legs.length,
      generalPosition: place,
    }) as FeederRoundsRanking;
  const feeder = (status: { currentRound: number; roundStatus: 'running' | 'closed' }) =>
    ({
      rankings: [
        entrant('a', 1, [{ round: 1, sector: 'A', stand: '1', points: 1, kg: 3 }]),
        entrant('b', 2, [{ round: 1, sector: 'B', stand: '2', points: 1, kg: 2 }]),
      ],
      metadata: { ...meta, rankingType: 'feederRounds', roundsCount: 2, ...status },
    }) as unknown as RankingResponse;

  it('feeder: «General» or «Manșa N»; a leg with nothing weighed is empty (fish feederLegEmpty)', () => {
    const data = feeder({ currentRound: 1, roundStatus: 'closed' });
    const general = buildRankingImage(competition({ rankingType: 'feederRounds', competitionType: 'team' }), data, parseImageQuery({}));
    if (!general.ok || general.model.table.kind !== 'feederGeneral') throw new Error('feeder');
    expect(general.model.title?.text).toBe('General');
    expect(general.model.table.nameTitle).toBe('Echipă');
    const leg = buildRankingImage(competition({ rankingType: 'feederRounds' }), data, parseImageQuery({ mansa: '1' }));
    if (!leg.ok || leg.model.table.kind !== 'feederLeg') throw new Error('leg');
    expect(leg.model.title?.text).toBe('Manșa 1');
    expect(leg.model.table.sections.map(s => s.sector)).toEqual(['A', 'B']);
    expect(buildRankingImage(competition({ rankingType: 'feederRounds' }), data, parseImageQuery({ mansa: '2' }))).toEqual({ ok: false, reason: 'noWeighing' });
    // A leg past the competition's last one does not exist (not «no weighing yet»).
    expect(buildRankingImage(competition({ rankingType: 'feederRounds' }), data, parseImageQuery({ mansa: '7' }))).toEqual({ ok: false, reason: 'noSuchView' });
  });

  it('a competition that has not started says so (not «no weighing»)', () => {
    expect(buildRankingImage(competition({ competitionStatus: 'notStarted' }), null, parseImageQuery({}))).toEqual({ ok: false, reason: 'notStarted' });
  });

  it('the effective view: an unknown sector, an order the type does not use and a non-feeder leg are dropped; the label follows it', () => {
    const ncComp = competition({ rankingType: 'nationalChampionship' });
    expect(effectiveImageQuery(ncComp, parseImageQuery({ sector: 'Z' }))).toEqual({ sort: null, sector: null, leg: 'general' });
    expect(effectiveImageQuery(ncComp, parseImageQuery({ sector: 'Z', sortare: 'club' }))).toEqual({ sort: 'club', sector: null, leg: 'general' });
    expect(effectiveImageQuery(ncComp, parseImageQuery({ sector: 'b', sortare: 'stand' }))).toEqual({ sort: 'stand', sector: 'B', leg: 'general' });
    expect(effectiveImageQuery(ncComp, parseImageQuery({ sector: 'B', sortare: 'club' }))).toEqual({ sort: null, sector: 'B', leg: 'general' });
    expect(effectiveImageQuery(competition(), parseImageQuery({ sortare: 'club', sector: 'A', mansa: '2' }))).toEqual({ sort: null, sector: null, leg: 'general' });
    expect(effectiveImageQuery(competition(), parseImageQuery({ sortare: 'loc' }))).toEqual({ sort: 'loc', sector: null, leg: 'general' });
    expect(effectiveImageQuery(competition({ rankingType: 'feederRounds' }), parseImageQuery({ sortare: 'loc', mansa: '2' }))).toEqual({ sort: null, sector: null, leg: 2 });
    // ?sector=Z on an NC competition: the band names the club table the image draws, never «Sector Z».
    expect(viewLabel('nationalChampionship', effectiveImageQuery(ncComp, parseImageQuery({ sector: 'Z' }))).full).toBe('Clasament pe cluburi');
    expect(viewLabel('nationalChampionship', effectiveImageQuery(ncComp, parseImageQuery({ sector: 'B' }))).full).toBe('Sector B');
    expect(viewLabel('feederRounds', { sort: null, sector: null, leg: 2 }).full).toBe('Manșa 2');
    expect(viewLabel('quantity', { sort: 'loc', sector: null, leg: 'general' })).toEqual({ full: 'Clasament complet, după poziție', short: 'După poziție' });
  });
});

describe('the sheet', () => {
  it('statusText, the totals line (c5) and the export date', () => {
    expect(statusText('started')).toBe('În desfășurare');
    expect(statLines({ totalQuantity: 30, totalCatchesCount: 9, biggestFish: 5.5 })).toEqual([
      ['Cantitate totală', '30 Kg'],
      ['Număr de pești', '9'],
      ['Medie pești', '3.33 Kg'],
      ['Cea mai mare captură', '5.5 Kg'],
    ]);
    expect(statLines({ totalQuantity: 0, totalCatchesCount: 0, biggestFish: 0 })).toEqual([
      ['Cantitate totală', '0 Kg'],
      ['Număr de pești', '0'],
      ['Medie pești', '0 Kg'],
      ['Cea mai mare captură', '- Kg'],
    ]);
    expect(imageDateTime('2026-10-03T06:05:00.000Z')).toBe('03 octombrie 2026 09:05');
  });

  it('fish image sizing: participant 250, stand 80–180, at least 1300 wide', () => {
    const r = buildRankingImage(competition(), quantity, parseImageQuery({}));
    if (!r.ok || r.model.table.kind !== 'table') throw new Error('table');
    const widths = columnWidths(r.model.table.columns, r.model.table.rows);
    expect(widths[0]).toBe(80);
    expect(widths[1]).toBe(250);
    const size = sheetSize(r.model, 0);
    expect(size.width).toBeGreaterThanOrEqual(1300);
    expect(sheetSize(r.model, 2).height).toBeGreaterThan(size.height);
  });

  it('reads the colours from the design tokens', () => {
    const tokens = parseTokens(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'));
    expect(tokens.surface).toBe('#ffffff');
    expect(tokens.accentInk).toMatch(/^#[0-9a-f]{6}$/);
    expect(Object.keys(tokens.sectors)).toHaveLength(24);
    expect(withAlpha('#1976d2', 0.4)).toBe('rgba(25, 118, 210, 0.4)');
  });

  it('text on a winner fill: white only where it reaches AA (4.5:1), else the ink', () => {
    const tokens = parseTokens(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'));
    expect(contrastOn('#ffffff', '#000000', 1, '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastOn('#ffffff', '#ffffff', 1, '#ffffff')).toBeCloseTo(1, 5);
    // 0.9 over white lightens the fill: the contrast drops.
    expect(contrastOn('#ffffff', '#1976d2', 0.9, '#ffffff')).toBeLessThan(contrastOn('#ffffff', '#1976d2', 1, '#ffffff'));
    for (const letter of Object.keys(tokens.sectors)) {
      const fill = tokens.sectors[letter];
      const ink = inkOn(fill, 0.9, tokens.surface, tokens.onAccent, tokens.ink);
      expect([tokens.onAccent, tokens.ink]).toContain(ink);
      // White when it reaches AA; otherwise whichever of the two reads better.
      const white = contrastOn(tokens.onAccent, fill, 0.9, tokens.surface);
      const dark = contrastOn(tokens.ink, fill, 0.9, tokens.surface);
      expect(ink).toBe(white >= 4.5 || white >= dark ? tokens.onAccent : tokens.ink);
      expect(Math.max(white, dark)).toBeGreaterThan(4);
    }
    // The orange (B) and green (C) sectors take the ink.
    expect(inkOn(tokens.sectors.B, 0.9, tokens.surface, tokens.onAccent, tokens.ink)).toBe(tokens.ink);
    expect(inkOn(tokens.sectors.C, 0.9, tokens.surface, tokens.onAccent, tokens.ink)).toBe(tokens.ink);
  });
});

describe('the sheet in words and its geometry', () => {
  it('summarises the table for screen readers: the view, the rows, the podium and the totals', () => {
    const r = buildRankingImage(competition(), quantity, parseImageQuery({ sortare: 'loc' }));
    if (!r.ok) throw new Error('table');
    const text = imageSummary(r.model, 'Clasament complet, după poziție');
    expect(text).toContain('Clasament complet, după poziție, Cantitate: 3 rânduri.');
    expect(text).toContain('locul 1: PB2; locul 2: PA1; locul 3: PA3.');
    expect(text).toContain('Cantitate totală 30 Kg');
  });

  it('places the blocks: the table centred, the title only when there is one, all inside the sheet', () => {
    const r = buildRankingImage(competition(), quantity, parseImageQuery({}));
    if (!r.ok) throw new Error('table');
    const g = sheetGeometry(r.model, 0);
    expect(g).toMatchObject(sheetSize(r.model, 0));
    expect(g.title).toBeNull();
    expect(g.table.rows).toBe(3);
    expect(Math.abs(g.table.x * 2 + g.table.w - g.width)).toBeLessThanOrEqual(1);
    expect(g.header.y).toBe(g.top);
    expect(g.stats.y + g.stats.h).toBeLessThanOrEqual(g.height);
    expect(g.table.y).toBeGreaterThan(g.header.y + g.header.h);
  });
});

describe('the sheet\'s visual values come from the tokens', () => {
  it('reads every t-* step it draws (phone-first sizes) and the badge radius', () => {
    const tokens = parseTokens(css());
    expect(Object.keys(tokens.type)).toEqual([...TYPE_STEPS]);
    expect(tokens.type.table).toEqual({ size: 14, lineHeight: 20, weight: 600, letterSpacing: 0 });
    expect(tokens.type.caption).toMatchObject({ size: 12, lineHeight: 16, weight: 600 });
    // The base step, not the 1280 override (96px).
    expect(tokens.type.count).toEqual({ size: 64, lineHeight: 60, weight: 800, letterSpacing: -4 });
    expect(tokens.type.eyebrow.letterSpacing).toBe(0.3);
    expect(tokens.radiusBadge).toBeGreaterThanOrEqual(0);
  });

  it('every head and fill pair clears AA for small text (4.5:1) — the image is printed and shared', () => {
    const tokens = parseTokens(css());
    // As the on-screen RankingTable: accent ink on the tint; the Best-N tier head in ink.
    expect(tableHead(tokens).ink).toBe(tokens.accentInk);
    expect(tierHead(tokens).ink).toBe(tokens.ink);
    for (const [what, ink, fill, alpha] of headPairs(tokens)) {
      expect(contrastOn(ink, fill, alpha, tokens.surface), what).toBeGreaterThanOrEqual(4.5);
    }
    // The totals' values are large bold text (the display step): 3:1.
    expect(contrastOn(tokens.accent, tokens.surface, 1, tokens.surface)).toBeGreaterThanOrEqual(3);
  });
});
