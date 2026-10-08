import { describe, expect, it } from 'vitest';
import { availableSourcesCount, filterOutCurrentCompetitionSource, hasMeaningfulEditorContent } from './regulationCopy';

describe('hasMeaningfulEditorContent (fish createCompetitionRegulationCopy)', () => {
  it.each([
    [undefined, false],
    [null, false],
    ['', false],
    ['<p></p>', false],
    ['<p> </p><p></p>', false],
    ['<p>&nbsp;</p>', false],
    ['<p><br></p><p><br/></p>', false],
    ['<ul><li><p></p></li></ul>', false],
    ['<p>Regulament</p>', true],
    ['<h2><strong>Premii</strong></h2>', true],
    ['<ul><li><p>a</p></li></ul>', true],
  ])('%j → %s', (html, expected) => {
    expect(hasMeaningfulEditorContent(html)).toBe(expected);
  });
});

describe('filterOutCurrentCompetitionSource', () => {
  const items = [{ documentId: 'a' }, { documentId: 'b' }, { documentId: 'c' }];
  it('keeps every item without a current id', () => {
    expect(filterOutCurrentCompetitionSource(items, undefined)).toBe(items);
    expect(filterOutCurrentCompetitionSource(items, null)).toBe(items);
  });
  it('drops the current draft / competition', () => {
    expect(filterOutCurrentCompetitionSource(items, 'b').map(i => i.documentId)).toEqual(['a', 'c']);
  });
});

describe('availableSourcesCount', () => {
  it('subtracts the current competition, never below 0', () => {
    expect(availableSourcesCount(5, 'x')).toBe(4);
    expect(availableSourcesCount(5, undefined)).toBe(5);
    expect(availableSourcesCount(0, 'x')).toBe(0);
  });
});
