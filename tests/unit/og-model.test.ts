import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MiniRanking, MiniRow } from '@/app/(site)/concursuri/_list/desktop/model';
import {
  anglerCard,
  BRAND_CARDS,
  clampText,
  competitionCard,
  competitionPhoto,
  entityAlt,
  lakeCard,
  lakePhoto,
  newsCard,
  OG_ALT,
  podiumDepth,
  podiumLines,
  sponsorCard,
  statusPill,
  TITLE_MAX,
  bindDashes,
  podiumNames,
  shortDate,
  waterCard,
  type OgCompetition,
} from '@/lib/server/og/model';
import { OG_MIN_TEXT, OG_SIZE, OG_TYPE_STEPS, parseOgTokens, s, textStyle } from '@/lib/server/og/tokens';
import { titleStep } from '@/lib/server/og/layout';

const t = parseOgTokens(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'));

/* parity global.b.seo-og-images — what each Open Graph card says (lib/server/og/model.ts). */

const lake = {
  name: 'Lacul Horgești',
  images: [{ url: 'https://cdn/x.jpg', mediumUrl: 'https://cdn/medium_x.jpg', smallUrl: null }],
  reviewsMeta: { quality: 5, facilities: 5, atmosphere: 5, count: 12, overall: 4.5 },
  cityRef: { documentId: 'c', name: 'Horgești' },
  countyRef: { documentId: 'j', name: 'Bacău' },
  county: null,
  address: 'Str. Lacului 1',
} as unknown as Parameters<typeof lakeCard>[0];

const row = (position: number, name: string, value: number | null, catches: number): MiniRow => ({
  key: name,
  position,
  name,
  avatar: null,
  sector: 'A',
  stand: '1',
  value,
  catches,
  biggest: 0,
  delta: null,
  fresh: false,
  userIds: [],
  registrationId: null,
});

const kgRanking = (rows: MiniRow[]): MiniRanking => ({
  rows,
  valueLabel: 'kg total',
  unit: 'kg',
  lowerIsBetter: false,
  totalKg: null,
  totalCatches: null,
  biggestCatch: null,
});

const competition: OgCompetition = {
  name: 'Cupa Bluvi — Etapa 3',
  competitionStatus: 'completed',
  rankingType: 'quantity',
  sectors: [],
  startDate: '2026-10-10T05:00:00.000Z',
  endDate: '2026-10-11T12:00:00.000Z',
  lake: { name: 'Iaz Suharău' },
  banner: null,
};

describe('lake card', () => {
  it('names the lake, its place (without the street), «4,50 ★ (12 recenzii)» and «de la 120 RON» (the tour note stays on the page)', () => {
    const card = lakeCard(lake, { price: 120 }, 'data:image/jpeg;base64,x', null);
    expect(card.eyebrow).toBe('Baltă');
    expect(card.title).toBe('Lacul Horgești');
    expect(card.meta).toEqual([{ icon: 'pin', text: 'Horgești, Bacău' }]);
    expect(card.rating).toEqual({ score: '4,50', count: '12 recenzii' });
    expect(card.price).toEqual({ amount: '120', unit: 'RON' });
    expect(card.media).toEqual({ kind: 'photo', src: 'data:image/jpeg;base64,x' });
  });

  it('rule 4: no reviews, no price, no place, no photo → each left out (the brand panel instead of a photo)', () => {
    const bare = { ...lake, reviewsMeta: null, cityRef: null, countyRef: null } as unknown as Parameters<typeof lakeCard>[0];
    const card = lakeCard(bare, null, null, null);
    expect(card.rating).toBeNull();
    expect(card.price).toBeNull();
    expect(card.meta).toEqual([]);
    expect(card.media).toEqual({ kind: 'brand' });
    expect(lakeCard({ ...lake, reviewsMeta: { quality: 0, facilities: 0, atmosphere: 0, count: 0 } }, null, null).rating).toBeNull();
  });

  it('subpages reuse the card with their label; the photo is the medium size', () => {
    expect(lakeCard(lake, null, null, 'Statistici').eyebrow).toBe('Baltă · Statistici');
    expect(lakePhoto(lake)).toBe('https://cdn/medium_x.jpg');
    expect(lakePhoto({ images: [] })).toBeNull();
  });

  it('plural agreement of the review count (1 recenzie, 20 de recenzii)', () => {
    const one = lakeCard({ ...lake, reviewsMeta: { quality: 4, facilities: 4, atmosphere: 4, count: 1, overall: 4 } }, null, null);
    expect(one.rating?.count).toBe('1 recenzie');
    const many = lakeCard({ ...lake, reviewsMeta: { quality: 4, facilities: 4, atmosphere: 4, count: 20, overall: 4 } }, null, null);
    expect(many.rating?.count).toBe('20 de recenzii');
  });
});

describe('competition card', () => {
  it('status pill as the competition page: only Live, plus Anulat for a cancelled one (fish «Anulat»); none otherwise', () => {
    expect(statusPill('started')).toEqual({ text: 'Live', tone: 'live' });
    expect(statusPill('cancelled')).toEqual({ text: 'Anulat', tone: 'neutral' });
    expect(statusPill('notStarted')).toBeNull();
    expect(statusPill('completed')).toBeNull();
    expect(statusPill('draft')).toBeNull();
  });

  it('name, lake, date range; the podium only when completed, kg apart from the number, never «capot»', () => {
    const ranking = kgRanking([row(1, 'Ion Popescu', 52.8, 14), row(2, 'Echipa Crapului', 31.25, 9), row(3, 'Vasile Ionescu', 4, 1), row(4, 'Al patrulea', 1, 1)]);
    const card = competitionCard(competition, ranking, null, 'Clasament');
    expect(card.eyebrow).toBe('Concurs · Clasament');
    expect(card.title).toBe('Cupa Bluvi\u00a0— Etapa 3');
    expect(card.pill).toBeNull();
    expect(card.meta).toEqual([
      { icon: 'lake', text: 'Iaz Suharău' },
      { icon: 'calendar', text: '10–11 octombrie 2026', short: '10–11 oct. 2026' },
    ]);
    expect(card.podium).toEqual([
      { position: 1, tied: false, name: 'Ion Popescu', figure: { value: '52,8', unit: 'kg' } },
      { position: 2, tied: false, name: 'Echipa Crapului', figure: { value: '31,25', unit: 'kg' } },
      { position: 3, tied: false, name: 'Vasile Ionescu', figure: { value: '4,0', unit: 'kg' } },
    ]);
    expect(JSON.stringify(card).toLowerCase()).not.toContain('capot');
    expect(card.media).toEqual({ kind: 'brand' });
  });

  it('fish card rule: a place that caught nothing is not on the podium (no «–» row)', () => {
    const ranking = kgRanking([row(1, 'Ion', 52.8, 14), row(2, 'Ana', 3, 1), row(3, 'Blank', 0, 0)]);
    expect(podiumLines(ranking).map(l => l.name)).toEqual(['Ion', 'Ana']);
  });

  it('nothing weighed (every stand blank, all placed equal) or no first place → no podium', () => {
    expect(podiumLines(kgRanking([row(3, 'A', 0, 0), row(3, 'B', 0, 0), row(3, 'C', 0, 0)]))).toEqual([]);
    expect(podiumLines(kgRanking([row(2, 'A', 5, 1), row(3, 'B', 4, 1)]))).toEqual([]);
    expect(podiumLines(kgRanking([]))).toEqual([]);
    expect(podiumLines(null)).toEqual([]);
  });

  it('ties are marked and never cut: 1, 1, 3, 3 shows all four places', () => {
    const lines = podiumLines(kgRanking([row(1, 'A', 9, 2), row(1, 'B', 9, 3), row(3, 'C', 5, 1), row(3, 'D', 5, 1), row(5, 'E', 2, 1)]));
    expect(lines.map(l => [l.position, l.name, l.tied])).toEqual([
      [1, 'A', true],
      [1, 'B', true],
      [3, 'C', true],
      [3, 'D', true],
    ]);
  });

  it('depth as fish podiumDepth: one per sector / bestOf winners / tier, clamped 3..6; whole places only up to six rows', () => {
    expect(podiumDepth({ rankingType: 'quantity', sectors: [1, 2, 3, 4] })).toBe(4);
    expect(podiumDepth({ rankingType: 'quantity', sectors: [1] })).toBe(3);
    expect(podiumDepth({ rankingType: 'quantity', sectors: Array(24).fill(0) })).toBe(6);
    expect(podiumDepth({ rankingType: 'bestOf', numberOfWinners: 5, sectors: [1] })).toBe(5);
    expect(podiumDepth({ rankingType: 'bestOfTiers', bestOfTierSizes: [9, 6, 3, 1], sectors: [1] })).toBe(4);
    const rows = [1, 2, 3, 4, 5, 6].map(p => row(p, `P${p}`, 10 - p, 1));
    expect(competitionCard({ ...competition, sectors: [1, 2, 3, 4] }, kgRanking(rows), null).podium.map(l => l.position)).toEqual([1, 2, 3, 4]);
    const crowded = kgRanking([row(1, 'A', 9, 1), row(2, 'B', 8, 1), row(3, 'C', 7, 1), row(4, 'D', 6, 1), row(5, 'E', 5, 1), row(5, 'F', 5, 1), row(5, 'G', 5, 1)]);
    // Place 5 is three rows: it does not fit in six, so it is left out whole.
    expect(podiumLines(crowded, 6).map(l => l.name)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('a place is never cut inside: a 1st place shared by more than six → no podium; six tied → all six', () => {
    const seven = kgRanking(['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(n => row(1, n, 9, 1)));
    expect(podiumLines(seven, 6)).toEqual([]);
    const six = kgRanking(['A', 'B', 'C', 'D', 'E', 'F'].map(n => row(1, n, 9, 1)).concat(row(2, 'H', 5, 1)));
    expect(podiumLines(six, 6).map(l => [l.position, l.name, l.tied])).toEqual(['A', 'B', 'C', 'D', 'E', 'F'].map(n => [1, n, true]));
  });

  it('fish card naming: an individual competition names the angler, never the team name typed (often a sponsor); a team one names the team', () => {
    const raw = {
      metadata: { rankingType: 'quantity' },
      rankings: [{ position: 1, teamName: 'Sponsor SRL', participant: { id: 7, username: 'Ion Popescu' }, totalWeight: 10, catches: 3 }],
    };
    expect((podiumNames(raw, 'single').rankings[0] as { teamName: unknown }).teamName).toBeNull();
    expect(podiumNames(raw, 'team')).toBe(raw);
    expect(podiumNames(raw, null).rankings[0]).toMatchObject({ participant: { username: 'Ion Popescu' } });
  });

  it('a live or upcoming competition has no podium; a ranking by points prints «puncte»', () => {
    const ranking = kgRanking([row(1, 'Ion', 52.8, 3)]);
    expect(competitionCard({ ...competition, competitionStatus: 'started' }, ranking, null).podium).toEqual([]);
    expect(competitionCard({ ...competition, competitionStatus: 'notStarted' }, null, null).podium).toEqual([]);
    const points: MiniRanking = { ...kgRanking([row(1, 'Ion', 3, 5), row(2, 'Ana', 20, 2)]), unit: 'puncte', lowerIsBetter: true };
    expect(podiumLines(points).map(l => l.figure)).toEqual([
      { value: '3', unit: 'puncte' },
      { value: '20', unit: 'de puncte' },
    ]);
  });

  it('no lake → no lake line; the banner\'s large size is the photo', () => {
    expect(competitionCard({ ...competition, lake: null }, null, null).meta.map(m => m.icon)).toEqual(['calendar']);
    expect(competitionPhoto({ banner: { url: 'o.jpg', formats: { large: { url: 'l.jpg' }, medium: null } } })).toBe('l.jpg');
    expect(competitionPhoto({ banner: { url: 'o.jpg', formats: { large: null, medium: null } } })).toBe('o.jpg');
    expect(competitionPhoto({ banner: null })).toBeNull();
  });
});

describe('public water, news, sponsor cards', () => {
  it('water: name, «type · location», the area apart from km², the outline', () => {
    const outline = { d: 'M0 0L10 10Z', closed: true };
    const card = waterCard({ name: 'Snagov', type: 'reservoir_lake', county: 'Ilfov', countyIds: [1], areaKm2: 5.57 } as never, outline, 'Hartă');
    expect(card.eyebrow).toBe('Apă publică · Hartă');
    expect(card.title).toBe('Snagov');
    expect(card.meta).toEqual([{ icon: 'water', text: 'Lac de acumulare · Ilfov' }]);
    expect(card.price).toEqual({ amount: '5,57', unit: 'km²' });
    expect(card.media).toEqual({ kind: 'outline', outline });
    const river = waterCard({ name: null, type: 'river', county: null, countyIds: [1, 2, 3], areaKm2: null } as never, null);
    expect(river.title).toBe('Apă publică');
    expect(river.price).toBeNull();
    expect(river.media).toEqual({ kind: 'brand' });
  });

  it('news: category, date, title, cover', () => {
    const card = newsCard({ title: 'Rezervări direct din aplicație', category: 'Noutati', createdAt: '2026-09-07T10:00:00.000Z' }, 'data:x');
    expect(card.eyebrow).toBe('Noutăți');
    expect(card.meta).toEqual([{ icon: 'calendar', text: '7 septembrie 2026' }]);
    expect(card.media).toEqual({ kind: 'photo', src: 'data:x' });
  });

  it('sponsor: name and logo (contained, never cropped)', () => {
    expect(sponsorCard({ name: 'TTBoilies' }, 'data:y')).toMatchObject({ eyebrow: 'Sponsor Bluvi', title: 'TTBoilies', media: { kind: 'logo', src: 'data:y' } });
    expect(sponsorCard({ name: 'TTBoilies' }, null).media).toEqual({ kind: 'brand' });
  });

  it('angler: name, public partide and competitions (zeros left out), profile photo', () => {
    const counts = { followers: 3, following: 1, catches: 40, sessions: 21, competitions: 1 };
    expect(anglerCard({ username: 'Ion Pop', counts }, 'data:z')).toMatchObject({
      eyebrow: 'Pescar pe Bluvi',
      title: 'Ion Pop',
      meta: [{ icon: 'lake', text: '21 de partide · 1 concurs' }],
      media: { kind: 'photo', src: 'data:z' },
    });
    const none = anglerCard({ username: 'Nou', counts: { ...counts, sessions: 0, competitions: 0 } }, null);
    expect(none.meta).toEqual([]);
    expect(none.media).toEqual({ kind: 'brand' });
  });
});

describe('alt text (generateImageMetadata)', () => {
  it('names the entity and only the facts its card draws', () => {
    expect(entityAlt('lake', lakeCard(lake, { price: 120 }, null), t)).toBe('Balta Lacul Horgești, Horgești, Bacău — 4,50 ★ (12 recenzii), de la 120 RON');
    const bare = lakeCard({ ...lake, reviewsMeta: null }, null, null);
    expect(entityAlt('lake', bare, t)).toBe('Balta Lacul Horgești, Horgești, Bacău');
    expect(entityAlt('lake', lakeCard({ ...lake, reviewsMeta: null, name: 'Balta Alesteu' }, null, null), t)).toBe('Balta Alesteu, Horgești, Bacău');
    const ranking = kgRanking([row(1, 'Ion Popescu', 52.8, 14), row(2, 'Ana Pop', 31, 9)]);
    expect(entityAlt('competition', competitionCard(competition, ranking, null), t)).toBe(
      'Concursul Cupa Bluvi — Etapa 3, Iaz Suharău, 10–11 octombrie 2026 — podium: Ion Popescu, Ana Pop',
    );
    expect(entityAlt('competition', competitionCard({ ...competition, competitionStatus: 'started' }, null, null), t)).toBe(
      'Concursul Cupa Bluvi — Etapa 3, Iaz Suharău, 10–11 octombrie 2026 — Live',
    );
    expect(entityAlt('news', newsCard({ title: 'Rezervări din aplicație', category: 'Noutati', createdAt: '2026-09-07T10:00:00.000Z' }, null), t)).toBe(
      'Știre Bluvi: Rezervări din aplicație, 7 septembrie 2026',
    );
  });

  it('a six-place podium: the card keeps the lake and the dates on one line, and the alt names both', () => {
    const six = kgRanking([1, 2, 3, 4, 5, 6].map(p => row(p, `Pescar ${p}`, 20 - p, 2)));
    const long = { ...competition, name: 'Campionatul Național de Pescuit la Crap — Etapa a Doua', sectors: [1, 2, 3, 4, 5, 6] };
    for (const photo of [null, 'data:image/jpeg;base64,x']) {
      const card = competitionCard(long, six, photo);
      expect(card.podium).toHaveLength(6);
      expect(entityAlt('competition', card, t)).toBe(
        `Concursul ${long.name}, Iaz Suharău, 10–11 octombrie 2026 — podium: ${[1, 2, 3, 4, 5, 6].map(p => `Pescar ${p}`).join(', ')}`,
      );
    }
  });

  it('an entity that could not be read: the alt of the brand card drawn instead', () => {
    expect(entityAlt('lake', null, t)).toBe(OG_ALT.lakes);
    expect(entityAlt('sponsor', null, t)).toBe(OG_ALT.home);
    expect(entityAlt('angler', null, t)).toBe(OG_ALT.home);
  });

  it('angler: «Pescarul {nume}, {partide · concursuri}»', () => {
    const counts = { followers: 0, following: 0, catches: 0, sessions: 2, competitions: 0 };
    expect(entityAlt('angler', anglerCard({ username: 'Ion Pop', counts }, null), t)).toBe('Pescarul Ion Pop, 2 partide');
  });
});

describe('copy and text', () => {
  it('long names are cut at a word with «…» and take the smaller title step', () => {
    const long = 'Campionatul Național de Pescuit la Crap pe Echipe — Etapa a Doua, Lacul Mare de la Câmpia Turzii';
    const cut = clampText(long, TITLE_MAX);
    expect(cut.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(cut.endsWith('…')).toBe(true);
    expect(cut).not.toMatch(/\s…$/);
    expect(titleStep(t, 'Lacul Horgești', 568)).toBe('hero');
    expect(titleStep(t, long, 568)).toBe('display');
    expect(clampText('  scurt  ', 10)).toBe('scurt');
  });

  it('a dash binds to the word before it (no line starts with «—»); the short date names the month briefly', () => {
    expect(bindDashes('Cupa Bluvi — Etapa 3')).toBe('Cupa Bluvi\u00a0— Etapa 3');
    expect(bindDashes('Cupa – Etapa 3 — final')).toBe('Cupa\u00a0– Etapa 3\u00a0— final');
    expect(bindDashes('10–11 octombrie')).toBe('10–11 octombrie');
    expect(shortDate('10–11 octombrie 2026')).toBe('10–11 oct. 2026');
    expect(shortDate('30 septembrie – 1 octombrie 2026')).toBe('30 sept. – 1 oct. 2026');
    expect(shortDate('7 mai 2026')).toBe('7 mai 2026');
  });

  it('every brand card and alt text is Romanian with diacritics, and never says «capot»', () => {
    const all = [...Object.values(BRAND_CARDS).flatMap(b => [b.title, b.tagline]), ...Object.values(OG_ALT)].join(' ');
    expect(all).toMatch(/[ăâîșț]/);
    expect(all).not.toMatch(/[şţ]/); // cedilla forms
    expect(all.toLowerCase()).not.toContain('capot');
  });
});

describe('tokens (app/globals.css)', () => {
  it('reads the light palette and the phone-first type steps', () => {
    expect(t.color.surface).toMatch(/^#/);
    expect(t.color.accentInk).toMatch(/^#/);
    expect(t.color.liveBg).toMatch(/^#/);
    expect(t.type.hero).toEqual({ weight: 800, size: 40, lineHeight: 44 });
    expect(t.type.body).toEqual({ weight: 600, size: 14, lineHeight: 20 });
    expect(t.radius.card).toBeGreaterThan(0);
  });

  it('draws at 2× a 600×315 layout; titles at 2×, secondary text larger', () => {
    expect(OG_SIZE).toEqual({ width: 1200, height: 630 });
    expect(s(14)).toBe(28);
    expect(textStyle(t, 'hero')).toEqual({ fontSize: 80, lineHeight: '88px', fontWeight: 800 });
    expect(textStyle(t, 'body').fontSize).toBe(35);
  });

  it('no text step is under OG_MIN_TEXT on the canvas (readable in a ~340 px chat preview)', () => {
    expect(OG_MIN_TEXT).toBeGreaterThanOrEqual(30);
    for (const step of OG_TYPE_STEPS) {
      const st = textStyle(t, step);
      expect(st.fontSize, step).toBeGreaterThanOrEqual(OG_MIN_TEXT);
      expect(parseFloat(st.lineHeight), step).toBeGreaterThanOrEqual(st.fontSize);
    }
  });

  it('fails loudly when a token is gone', () => {
    expect(() => parseOgTokens(':root {\n}\n')).toThrow(/--bluvi-/);
  });
});
