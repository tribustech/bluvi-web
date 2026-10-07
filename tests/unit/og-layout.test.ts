import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { MiniRanking, MiniRow } from '@/app/(site)/concursuri/_list/desktop/model';
import { ADVANCE, MEASURED_CHARS } from '@/lib/server/og/metrics';
import { BAND_W, drawnWhole, entityLayout, factsWidth, measure, MEDIA_W, mediaWidth, podiumNameRoom, PODIUM_MEDIA_W } from '@/lib/server/og/layout';
import { competitionCard, type OgCompetition } from '@/lib/server/og/model';
import { renderCard } from '@/lib/server/og/render';
import { parseOgTokens } from '@/lib/server/og/tokens';
import { advanceWidths, FONT_FILES } from './og-ttf';

/* parity global.b.seo-og-images — the card's geometry (lib/server/og/layout.ts), measured with Nunito. */

const t = parseOgTokens(readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8'));

const row = (position: number, name: string, value: number, catches = 2): MiniRow => ({
  key: `${position}-${name}`,
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

const kg = (rows: MiniRow[]): MiniRanking => ({ rows, valueLabel: 'kg total', unit: 'kg', lowerIsBetter: false, totalKg: null, totalCatches: null, biggestCatch: null });

const competition: OgCompetition = {
  name: 'SIM3 Cupa C&B Ed 8',
  competitionStatus: 'completed',
  competitionType: 'team',
  rankingType: 'quantity',
  sectors: [1, 2, 3],
  startDate: '2026-10-10T05:00:00.000Z',
  endDate: '2026-10-11T12:00:00.000Z',
  lake: { name: 'Chita Lake' },
  banner: null,
};

/** A tied 1st place with two long team names (the reported «Voicu Ionel si Ivan …» card). */
const tied = kg([row(1, 'Voicu Ionel si Ivan Marius', 48.35), row(1, 'Costea Gabriel si Florea Dan', 48.35), row(3, 'Echipa Crapului', 31.2)]);

describe('metrics (Nunito advance widths)', () => {
  it('the table is the bundled fonts\' (a font change prints the fresh table)', () => {
    for (const weight of [600, 700, 800] as const) {
      const fresh = advanceWidths(weight, MEASURED_CHARS);
      const table = [...MEASURED_CHARS].map(c => fresh[c]);
      expect(ADVANCE[weight], `${FONT_FILES[weight]}: ${JSON.stringify(table)}`).toEqual(table);
    }
  });
});

describe('podium (finding: tie caption on the name row)', () => {
  it('a tied 1st place with two long team names: each name fits its row whole, the tie takes no room from it', () => {
    const card = competitionCard(competition, tied, null);
    expect(card.podium.map(l => [l.position, l.tied])).toEqual([
      [1, true],
      [1, true],
      [3, false],
    ]);
    const layout = entityLayout(t, card);
    expect(layout.legend, '«= la egalitate» said once, under the podium').toBe(true);
    for (const line of card.podium) {
      expect(measure(t, line.name, 'body-strong'), line.name).toBeLessThanOrEqual(podiumNameRoom(t, card, line));
    }
    // The same names without a tie: the «=1» badge costs a few px, never a «la egalitate» caption.
    const untied = competitionCard(competition, kg([row(1, 'Voicu Ionel si Ivan Marius', 48.35), row(2, 'Costea Gabriel si Florea Dan', 40)]), null);
    expect(podiumNameRoom(t, untied, untied.podium[0]) - podiumNameRoom(t, card, card.podium[0])).toBeLessThanOrEqual(12);
  });

  it('with a banner the photo narrows to PODIUM_MEDIA_W so a two-angler team name still reads', () => {
    const card = competitionCard(competition, tied, 'data:image/jpeg;base64,x');
    expect(mediaWidth(card)).toBe(PODIUM_MEDIA_W);
    expect(measure(t, 'Voicu Ionel si Ivan Marius', 'body-strong')).toBeLessThanOrEqual(podiumNameRoom(t, card, card.podium[0]));
  });

  it('renders the tied card (PNG 1200×630) — written to test-results/og/ for a look', async () => {
    const out = join(process.cwd(), 'test-results/og');
    mkdirSync(out, { recursive: true });
    for (const [name, card] of [
      ['tie-brand', competitionCard(competition, tied, null)],
      ['title-photo', competitionCard({ ...competition, competitionStatus: 'started', name: 'Cupa Bluvi — Etapa 3 de primăvară la Chita' }, null, null)],
      ['six-brand', competitionCard({ ...competition, sectors: [1, 2, 3, 4, 5, 6] }, kg([1, 2, 3, 4, 5, 6].map(p => row(p, `Pescar Numărul ${p} și Coechipier`, 30 - p))), null)],
    ] as const) {
      const png = Buffer.from(await renderCard(card));
      expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
      writeFileSync(join(out, `${name}.png`), png);
    }
  }, 30_000);
});

describe('meta lines by the space left (finding: a results card without its date)', () => {
  const card = (places: number, name = competition.name) =>
    competitionCard(
      { ...competition, name, sectors: Array(places).fill(0) },
      kg(Array.from({ length: places }, (_, i) => row(i + 1, `Pescar ${i + 1}`, 30 - i))),
      null,
    );
  const drawn = (c: ReturnType<typeof card>) => entityLayout(t, c).meta.map(m => [m.text, m.tail ?? null]);

  it('1–3 places: the lake and the dates, on two lines when the title is short', () => {
    for (const places of [1, 2, 3]) {
      expect(drawn(card(places)), `${places}`).toEqual([
        ['Chita Lake', null],
        ['10–11 octombrie 2026', null],
      ]);
    }
  });

  it('4 places: both still, as the space allows; 5–6 places, or a two-line title: one line («Chita Lake · 10–11 oct. 2026»), never none', () => {
    expect(drawn(card(4)).flat().join(' ')).toMatch(/Chita Lake.*10–11 oct/);
    for (const places of [5, 6]) expect(drawn(card(places)), `${places}`).toEqual([['Chita Lake', '10–11 oct. 2026']]);
    const long = card(3, 'Campionatul Național de Pescuit la Crap pe Echipe — Etapa a Doua');
    expect(entityLayout(t, long).titleLines).toBe(2);
    expect(drawn(long).flat().join(' ')).toContain('10–11');
  });

  it('every layout fits the card (the facts never run past its foot)', () => {
    for (const places of [1, 2, 3, 4, 5, 6]) {
      const c = card(places, 'Campionatul Național de Pescuit la Crap pe Echipe — Etapa a Doua');
      expect(entityLayout(t, c).meta.length, `${places}`).toBeGreaterThan(0);
    }
  });
});

describe('width (finding: the brand panel takes 43% of the card)', () => {
  it('no picture: a narrow brand band, the facts take the width; a picture keeps its panel', () => {
    const brand = competitionCard(competition, null, null);
    expect(mediaWidth(brand)).toBe(BAND_W);
    expect(factsWidth(brand)).toBeGreaterThan(800);
    expect(mediaWidth(competitionCard({ ...competition, competitionStatus: 'notStarted' }, null, 'data:x'))).toBe(MEDIA_W);
  });
});

describe('pictures (finding: dark slivers beside a near-portrait cover)', () => {
  it('a picture within 15% of the panel\'s shape is cropped, never drawn whole on its blurred copy', () => {
    // 520×630 panel: aspect 0.825.
    expect(drawnWhole('whole', 800, 1000, 520)).toBe(false); // 0.80 — near: crop
    expect(drawnWhole('whole', 1000, 1000, 520)).toBe(true); // square — clearly wider: whole
    expect(drawnWhole('whole', 1600, 900, 520)).toBe(true); // landscape: whole
    expect(drawnWhole('whole', 600, 1200, 520)).toBe(true); // tall story: whole (a crop would cut its text)
    expect(drawnWhole('auto', 900, 1000, 520)).toBe(false); // near: crop
    expect(drawnWhole('auto', 1600, 900, 520)).toBe(true); // clearly landscape: whole
    expect(drawnWhole('auto', 600, 1200, 520)).toBe(false); // portrait poster: crop
    expect(drawnWhole('cover', 1600, 900, 520)).toBe(false);
  });
});

describe('titles (finding: greedy wraps, «Etapa 3» alone)', () => {
  it('a short name on one line is not balanced (a clamp would cut it); a name over two lines drawn whole is', () => {
    const one = competitionCard(competition, tied, null);
    expect(entityLayout(t, one)).toMatchObject({ titleLines: 1, balance: false });
    const two = competitionCard({ ...competition, competitionStatus: 'started', name: 'Cupa Bluvi — Etapa 3 de primăvară' }, null, 'data:x');
    expect(entityLayout(t, two)).toMatchObject({ balance: true });
  });
});
