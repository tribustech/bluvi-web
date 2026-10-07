import { describe, expect, it } from 'vitest';
import type { PublicWaterType } from '@/core/lakes';
import { registeredLine, waterDetailDescription, waterSubDescription } from '@/lib/seo/describe';
import { lakeReviewScore, reviewScoreSentence, reviewsJsonLd } from '@/lib/seo/reviews';

/* global.b.seo-metadata — meta-description copy: Romanian plurals, one score, the venue named as the title names it. */

describe('registeredLine (competition Participanți description)', () => {
  it('counts through formatCount: «de» from 20', () => {
    expect(registeredLine(1, false)).toBe('1 participant înscris');
    expect(registeredLine(19, false)).toBe('19 participanți înscriși');
    expect(registeredLine(20, false)).toBe('20 de participanți înscriși');
    expect(registeredLine(101, false)).toBe('101 participanți înscriși');
    expect(registeredLine(25, false)).toBe('25 de participanți înscriși');
  });
  it('counts teams for a team competition', () => {
    expect(registeredLine(1, true)).toBe('1 echipă înscrisă');
    expect(registeredLine(19, true)).toBe('19 echipe înscrise');
    expect(registeredLine(20, true)).toBe('20 de echipe înscrise');
    expect(registeredLine(101, true)).toBe('101 echipe înscrise');
  });
});

const lake = (over: Partial<{ name: string | null; type: PublicWaterType; county: string | null; countyIds: number[]; areaKm2: number | null; basin: string | null }> = {}) => ({
  name: 'Nebunul' as string | null,
  type: 'natural_lake' as PublicWaterType,
  county: null as string | null,
  countyIds: [] as number[],
  areaKm2: null as number | null,
  basin: null as string | null,
  ...over,
});

describe('waterSubDescription', () => {
  it('names a named water as its title does', () => {
    expect(waterSubDescription(lake({ name: 'Lacul Snagov' }), 'statistici')).toMatch(/^Lacul Snagov: statisticile partidelor/);
  });
  it('m1: qualifies the water with its county (ANAR names repeat), a river across counties with their count', () => {
    expect(waterSubDescription(lake({ county: 'Ialomița', countyIds: [21] }), 'partide')).toMatch(/^Nebunul \(județul Ialomița\): partidele/);
    expect(waterSubDescription(lake({ type: 'river', county: 'Olt', countyIds: [1, 2, 3] }), 'clasament')).toMatch(/^Nebunul \(3 județe\): clasamentul/);
  });
  it('an unnamed ANAR water reads «Apă publică» (publicWaterName), never «această apă»', () => {
    for (const page of ['partide', 'statistici', 'clasament', 'capturi'] as const) {
      for (const name of [null, '  ']) {
        const d = waterSubDescription(lake({ name }), page);
        expect(d.startsWith('Apă publică: '), `${page} ${name}`).toBe(true);
        expect(d).not.toContain('această apă');
      }
    }
  });
});

describe('waterDetailDescription', () => {
  it('m1: a sentence, the county a proper noun, «·» kept for titles', () => {
    const d = waterDetailDescription(lake({ name: 'Borănești', county: 'Ialomița', countyIds: [21], areaKm2: 0.02, basin: 'Ialomița' }));
    expect(d).toBe('Borănești, lac natural în județul Ialomița, 0,02 km², bazinul hidrografic Ialomița. Hartă, partide de pescuit și capturi pe Borănești în Bluvi.');
    expect(d).not.toContain('·');
  });
  it('each fact only when known', () => {
    expect(waterDetailDescription(lake({ type: 'river', county: 'Olt', countyIds: [1, 2] }))).toBe('Nebunul, râu în 2 județe. Hartă, partide de pescuit și capturi pe Nebunul în Bluvi.');
    expect(waterDetailDescription(lake({ type: 'reservoir_lake' }))).toBe('Nebunul, lac de acumulare. Hartă, partide de pescuit și capturi pe Nebunul în Bluvi.');
  });
});

describe('the lake reviews score (description = AggregateRating)', () => {
  const meta = { quality: 4, facilities: 4, atmosphere: 5, count: 1, overall: 4.666 };
  it('one score: the mean of the three shown scores, one decimal, «din 5 (N recenzii)»', () => {
    expect(lakeReviewScore(meta)).toBe(4.3);
    expect(reviewScoreSentence(meta)).toBe(' Nota medie 4,3 din 5 (1 recenzie).');
    expect(reviewScoreSentence({ ...meta, count: 25 })).toBe(' Nota medie 4,3 din 5 (25 de recenzii).');
    const ld = reviewsJsonLd({ documentId: 'lk1', name: 'Balta', reviewsMeta: meta }, '/balti/lk1/recenzii', []);
    expect(ld?.aggregateRating.ratingValue).toBe(lakeReviewScore(meta));
  });
  it('no score → no sentence (never «0,00»)', () => {
    expect(reviewScoreSentence(null)).toBe('');
    expect(reviewScoreSentence({ ...meta, count: 0 })).toBe('');
    expect(reviewScoreSentence({ quality: 0, facilities: 0, atmosphere: 0, count: 3 })).toBe('');
  });
});
