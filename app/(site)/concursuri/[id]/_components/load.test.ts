import { describe, expect, it } from 'vitest';
import { classifyLoose, type LooseCompetitionDetail } from './load';

/*
 * parity competition-page.clasament.c2: a strict read that failed is classified on `rankingType`
 * alone (fish CompetitionRankingWrapper) — never «this ranking type is not available» for a field
 * drift elsewhere in the core.
 */
const loose = (rankingType: string) => ({ documentId: 'c1', name: 'Concurs', rankingType }) as unknown as LooseCompetitionDetail;

describe('classifyLoose', () => {
  it('a ranking type newer than this build → unsupported (the «not available on the web» state)', () => {
    expect(classifyLoose(loose('newFancyRanking'))).toMatchObject({ kind: 'unsupported', competition: { rankingType: 'newFancyRanking' } });
  });

  it('no ranking type (null / missing, read as «») → the page without a ranking area, not invalid', () => {
    expect(classifyLoose(loose(''))).toMatchObject({ kind: 'unsupported', competition: { rankingType: '' } });
  });

  it('a known ranking type with the strict read failing elsewhere, or the loose read failing too → invalid', () => {
    expect(classifyLoose(loose('quantity'))).toEqual({ kind: 'invalid' });
    expect(classifyLoose(null)).toEqual({ kind: 'invalid' });
  });
});
