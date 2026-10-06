import { describe, expect, it } from 'vitest';
import type { CompetitionSuggestion } from '../schemas';
import { countyListComplete, countyOptions, filterCounties, normalizeCountyText } from './countyOptions';
import {
  isPersistableCompetitionSearch,
  parseRecentCompetitionSearches,
  pushRecentCompetitionSearch,
  RECENT_COMPETITION_SEARCHES_KEY,
} from './recentSearches';

const pick = (id: string, type: CompetitionSuggestion['type'] = 'lake'): CompetitionSuggestion => ({
  id,
  type,
  value: `v-${id}`,
  title: `T ${id}`,
  subtitle: 'Baltă · Ilfov',
});

describe('recent competition searches', () => {
  it('keeps fish’s storage key', () => {
    expect(RECENT_COMPETITION_SEARCHES_KEY).toBe('recentCompetitionSearches');
  });

  it('stores only lake / organizer / competition picks', () => {
    expect(isPersistableCompetitionSearch(pick('a'))).toBe(true);
    expect(isPersistableCompetitionSearch(pick('b', 'organizer'))).toBe(true);
    expect(isPersistableCompetitionSearch(pick('c', 'competition'))).toBe(true);
    expect(isPersistableCompetitionSearch({ ...pick('d'), type: 'text' })).toBe(false);
    expect(isPersistableCompetitionSearch({ id: 'x' })).toBe(false);
    expect(isPersistableCompetitionSearch(null)).toBe(false);
  });

  it('parses unreadable storage to an empty list', () => {
    expect(parseRecentCompetitionSearches(null)).toEqual([]);
    expect(parseRecentCompetitionSearches('not json')).toEqual([]);
    expect(parseRecentCompetitionSearches('{"a":1}')).toEqual([]);
  });

  it('drops invalid rows and caps at 5', () => {
    const rows = [pick('1'), { bad: true }, pick('2'), pick('3'), pick('4'), pick('5'), pick('6')];
    expect(parseRecentCompetitionSearches(JSON.stringify(rows)).map((r) => r.id)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('pushes newest first, deduplicated by id, max 5', () => {
    const current = ['1', '2', '3', '4', '5'].map((id) => pick(id));
    expect(pushRecentCompetitionSearch(current, pick('3')).map((r) => r.id)).toEqual(['3', '1', '2', '4', '5']);
    expect(pushRecentCompetitionSearch(current, pick('9')).map((r) => r.id)).toEqual(['9', '1', '2', '3', '4']);
  });

  it('ignores an unpersistable pick', () => {
    const current = [pick('1')];
    expect(pushRecentCompetitionSearch(current, { ...pick('t'), type: 'text' as never })).toBe(current);
  });
});

describe('county options', () => {
  const s = (type: 'county' | 'city' | 'lake', title: string, countyId?: string) => ({ type, title, countyId });

  it('keeps counties with an id, sorted in Romanian order, deduplicated', () => {
    const list = [s('county', 'Vâlcea', 'v'), s('county', 'Argeș', 'a'), s('county', 'Ilfov', 'i'), s('county', 'Argeș', 'a'), s('county', 'Fără id'), s('city', 'Buftea', 'i')];
    expect(countyOptions(list)).toEqual([
      { id: 'a', name: 'Argeș' },
      { id: 'i', name: 'Ilfov' },
      { id: 'v', name: 'Vâlcea' },
    ]);
  });

  it('is complete once a city or a lake appears', () => {
    expect(countyListComplete([s('county', 'Ilfov', 'i')])).toBe(false);
    expect(countyListComplete([s('county', 'Ilfov', 'i'), s('city', 'Buftea')])).toBe(true);
    expect(countyListComplete([s('lake', 'Chita')])).toBe(true);
  });

  it('filters diacritic- and case-insensitively, by contains', () => {
    const counties = [
      { id: 'a', name: 'Argeș' },
      { id: 'b', name: 'Brașov' },
      { id: 'v', name: 'Vâlcea' },
    ];
    expect(normalizeCountyText('Vâlcea')).toBe('valcea');
    expect(filterCounties(counties, 'ARGES').map((c) => c.id)).toEqual(['a']);
    expect(filterCounties(counties, 'as').map((c) => c.id)).toEqual(['b']);
    expect(filterCounties(counties, 'valc').map((c) => c.id)).toEqual(['v']);
    expect(filterCounties(counties, '  ')).toBe(counties);
    expect(filterCounties(counties, 'zzz')).toEqual([]);
  });
});
