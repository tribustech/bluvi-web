import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { rankingResponseSchema } from '@/core/competitions/schemas';
import { hydrateRanking, type RankingFixture } from '@/tests/fixtures/rankings/hydrate';
import { paletteLetter, sectorColorMap } from '@/components/ranking/sector';
import { buildRankingTable, sectorLetters } from './ranking';
import { decidingKey, rankingPinKeys } from './tableFixes';

/*
 * fish CompetitionRanking `tableColumns` / `tableRows` on the real ranking payloads
 * (tests/fixtures/rankings, hydrated): which columns each ranking type gets — parity
 * competition-page.clasament c7–c13 (the e2e concurs-clasament-tabel.spec.ts proves the page draws them).
 */

const fixture = (type: string): RankingFixture =>
  JSON.parse(readFileSync(path.resolve(__dirname, '../../../../../tests/fixtures/rankings', `${type}.json`), 'utf8')) as RankingFixture;

const build = (type: string, edit?: (f: RankingFixture) => void, options?: Parameters<typeof hydrateRanking>[1]) => {
  const f = hydrateRanking(fixture(type), options);
  edit?.(f);
  const parsed = rankingResponseSchema.parse(f);
  return buildRankingTable(parsed, 'stand')!;
};
const titles = (type: string, edit?: (f: RankingFixture) => void) => build(type, edit).columns.map(c => c.title);

describe('buildRankingTable — fish column sets per ranking type (clasament c7–c13)', () => {
  it('every hydrated fixture parses as a ranking response', () => {
    for (const t of ['quantity', 'quality', 'quantityQuality', 'qualityQuantity', 'bestOf', 'bestOfTiers', 'calitateCalitate', 'calitateCantitateCMMC']) {
      expect(() => rankingResponseSchema.parse(hydrateRanking(fixture(t))), t).not.toThrow();
    }
  });

  it('c7 quantity', () => {
    expect(titles('quantity')).toEqual(['Stand', 'Participant', 'C.M.M.C', 'Cantitate', 'Nr. Buc', 'Puncte cantitate', 'Poziție sector', 'Poziție generală']);
  });

  it('c8 quality: catch columns 1..N, N = the largest sectorMinNumberOfFish (7)', () => {
    expect(titles('quality')).toEqual(['Stand', 'Participant', '1', '2', '3', '4', '5', '6', '7', 'Calitate', 'Nr. Buc', 'Poziție sector', 'Poziție generală']);
  });

  it('c9 quantityQuality and qualityQuantity', () => {
    const tail = ['Calitate', 'Cantitate', 'Nr. Buc', 'Puncte calitate', 'Puncte cantitate', 'Puncte total', 'Poziție sector', 'Poziție generală'];
    expect(titles('quantityQuality')).toEqual(['Stand', 'Participant', '1', '2', '3', '4', '5', '6', '7', '8', ...tail]);
    expect(titles('qualityQuantity')).toEqual(['Stand', 'Participant', '1', '2', '3', '4', '5', '6', ...tail]);
  });

  it('c10 bestOf: Nr buc., catches 1..maxBestOfFishCount, Medie (kg); Poziție sector only with more than one sector', () => {
    expect(titles('bestOf')).toEqual(['Stand', 'Participant', 'Nr buc.', '1', '2', '3', '4', 'Medie (kg)', 'Poziție generală']);
    expect(titles('bestOf', f => (f.metadata.numberOfSectors = 2))).toContain('Poziție sector');
    // No maxBestOfFishCount: 3 catch columns (fish `|| 3`).
    expect(titles('bestOf', f => (f.metadata.maxBestOfFishCount = 0)).filter(t => /^\d+$/.test(t))).toEqual(['1', '2', '3']);
  });

  it('c11 bestOfTiers: catch columns = min(largest catchCount, largest tier), one Best N per tier ascending', () => {
    const table = build('bestOfTiers');
    expect(table.columns.map(c => c.title)).toEqual(['Stand', 'Participant', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Nr. Buc', 'Best 3', 'Best 5', 'Best 7', 'Best 9', 'Poziție generală']);
    expect(table.columns.filter(c => c.isTier).map(c => c.key)).toEqual(['tier3', 'tier5', 'tier7', 'tier9']);
    // Fewer catches than the biggest tier: the catch columns follow the data.
    const few = build('bestOfTiers', f => f.rankings.forEach(r => {
      r.catchCount = 4;
      r.catches = (r.catches as unknown[]).slice(0, 4);
    }));
    expect(few.columns.filter(c => /^catch\d+$/.test(c.key))).toHaveLength(4);
    // tierWonAt marks the won Best-N cell (tiers in the metadata's order 9, 7, 5, 3: tierWonAt 1 = Best 9).
    expect(table.rows[0].tier9).toMatchObject({ isTier: true, isTierWin: true });
  });

  it('c12 calitateCalitate', () => {
    expect(titles('calitateCalitate')).toEqual([
      'Stand', 'Participant', '1', '2', '3', '4', '5', '6', '7',
      'Calitate 1', 'C.M.M.C', 'Nr. Buc', 'Puncte Cal. 1', 'Puncte Cal. 2', 'Puncte total', 'Poziție sector', 'Poziție generală',
    ]);
  });

  it('c13 calitateCantitateCMMC', () => {
    expect(titles('calitateCantitateCMMC')).toEqual([
      'Stand', 'Participant', '1', '2', '3', '4', '5', '6', '7', '8',
      'Calitate', 'Cantitate', 'C.M.M.C', 'Nr. Buc', 'Pct. Cal.', 'Pct. Cant.', 'Pct. CMMC', 'Puncte total', 'Poziție sector', 'Poziție generală',
    ]);
  });

  it('c18 winners per type: numberOfWinners (bestOf), the tiers (bestOfTiers), the sectors otherwise', () => {
    const winners = (table: ReturnType<typeof build>) => table.rows.filter(r => r.isWinner).map(r => r.generalPosition).sort();
    expect(winners(build('quantity', f => (f.metadata.numberOfSectors = 2)))).toEqual([1, 2]);
    expect(winners(build('bestOf', undefined, { numberOfWinners: 2 }))).toEqual([1, 2]);
    expect(winners(build('bestOfTiers', f => (f.metadata.bestOfTierSizes = [9, 3])))).toEqual([1, 2]);
    expect(winners(build('calitateCantitateCMMC'))).toEqual([1, 2, 3]); // numberOfSectors 4, 3 rows
  });

  it('c14 the participant: team → usernames → guest → «-» (named «Stand liber» on the web)', () => {
    const rows = build('qualityQuantity', f => {
      f.rankings[0].participant = { username: 'ana' };
      f.rankings[0].guestName = 'Oaspete';
      f.rankings[2].teamName = '';
      f.rankings[2].guestName = null;
    }).rows;
    const names = Object.fromEntries(rows.map(r => [r.position, r.participant]));
    expect(names['A/8']).toBe('ana');
    expect(names['C/3']).toBe('Echipa 2');
    expect(names['B/10']).toBe('Stand liber');
  });
});

describe('sector colours — fish getColorsBySector: the palette by the sorted sector names, by index (clasament c17)', () => {
  it('sectors B and C alone take palette[0] and palette[1] (A’s and B’s tokens), not their own letters', () => {
    // The quantity fixture's sectors are B and C.
    const table = build('quantity');
    const colour = (sector: string) => table.rows.find(r => r.position.startsWith(`${sector}/`))!.backgroundColor;
    expect(colour('B')).toBe('var(--color-sector-a)');
    expect(colour('C')).toBe('var(--color-sector-b)');
    expect(sectorLetters(table.rows)).toEqual(new Map([['B', 'A'], ['C', 'B']]));
  });

  it('a sector named outside A–X («1», «Sector 2») is coloured too, in sorted order', () => {
    const table = build('quantity', f => {
      f.rankings[0].sectorName = '1';
      f.rankings[1].sectorName = 'Sector 2';
      f.rankings[2].sectorName = '1';
    });
    expect(table.rows.map(r => [r.position.split('/')[0], r.backgroundColor])).toEqual([
      ['1', 'var(--color-sector-a)'],
      ['1', 'var(--color-sector-a)'],
      ['Sector 2', 'var(--color-sector-b)'],
    ]);
  });

  it('sectorColorMap without names keeps every letter on its own token (the kit demo); paletteLetter reads it back', () => {
    expect(sectorColorMap().C).toBe('var(--color-sector-c)');
    expect(sectorColorMap(['C', 'B', 'B'])).toEqual({ B: 'var(--color-sector-a)', C: 'var(--color-sector-b)' });
    expect(paletteLetter('var(--color-sector-x)')).toBe('X');
    expect(paletteLetter('#1976D2')).toBeNull();
  });
});

describe('rankingPinKeys — the deciding columns pinned at the right, fish’s order untouched (clasament c7–c13)', () => {
  it('quantity (no catch columns): Loc, then Cantitate (in the middle of the table)', () => {
    expect(rankingPinKeys(build('quantity').columns)).toEqual(['generalPosition', 'quantity']);
  });
  it('quality: Loc, Calitate, then the totals after the last catch from the right', () => {
    expect(rankingPinKeys(build('quality').columns)).toEqual(['generalPosition', 'quality', 'sectorPosition', 'catchCount']);
  });
  it('the point rankings decide on «Puncte total»', () => {
    const keys = rankingPinKeys(build('qualityQuantity').columns);
    expect(keys.slice(0, 2)).toEqual(['generalPosition', 'totalPoints']);
  });
  it('bestOf: Loc and Medie (kg)', () => {
    expect(rankingPinKeys(build('bestOf').columns).slice(0, 2)).toEqual(['generalPosition', 'topNCatchesAvarage']);
  });
  it('bestOfTiers: Loc and the Best N that decided the most rows (ties: the smaller N); without rows the smallest', () => {
    const table = build('bestOfTiers');
    // tierWonAt 1, 2, 3 of the tiers 9, 7, 5, 3: Best 9, 7 and 5 one green cell each — Best 5 (the smaller N).
    expect(rankingPinKeys(table.columns, table.rows)).toEqual(['generalPosition', 'tier5']);
    expect(decidingKey(table.columns)).toBe('tier3');
  });
});
