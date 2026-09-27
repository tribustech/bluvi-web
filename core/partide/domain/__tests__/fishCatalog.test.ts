import { describe, it, expect } from 'vitest';
import { FALLBACK_TARGET_NAMES, mergeSpeciesChips, resolveDefaultTargets, sameSpecies, sortCatalog, speciesKey, type CatalogFish } from '../fishCatalog';

const fish = (over: Partial<CatalogFish>): CatalogFish => ({
  id: 'id',
  name: 'name',
  priority: null,
  defaultRank: null,
  ...over,
});

describe('sortCatalog', () => {
  it('sorts by priority ascending', () => {
    const list = [fish({ id: '1', name: 'B', priority: 2 }), fish({ id: '2', name: 'A', priority: 1 })];
    expect(sortCatalog(list).map(f => f.id)).toEqual(['2', '1']);
  });

  it('sorts entries with a null priority after all entries with a priority', () => {
    const list = [
      fish({ id: '1', name: 'A', priority: null }),
      fish({ id: '2', name: 'B', priority: 5 }),
      fish({ id: '3', name: 'C', priority: 1 }),
    ];
    expect(sortCatalog(list).map(f => f.id)).toEqual(['3', '2', '1']);
  });

  it('breaks ties by name using ro locale collation', () => {
    const list = [
      fish({ id: '1', name: 'Știucă', priority: 1 }),
      fish({ id: '2', name: 'Amur', priority: 1 }),
      fish({ id: '3', name: 'Caras', priority: 1 }),
    ];
    expect(sortCatalog(list).map(f => f.name)).toEqual(['Amur', 'Caras', 'Știucă']);
  });

  it('breaks ties by name among null-priority entries too', () => {
    const list = [fish({ id: '1', name: 'Somn', priority: null }), fish({ id: '2', name: 'Crap', priority: null })];
    expect(sortCatalog(list).map(f => f.name)).toEqual(['Crap', 'Somn']);
  });

  it('does not mutate the input array', () => {
    const list = [fish({ id: '1', name: 'B', priority: 2 }), fish({ id: '2', name: 'A', priority: 1 })];
    const copy = [...list];
    sortCatalog(list);
    expect(list).toEqual(copy);
  });
});

describe('resolveDefaultTargets', () => {
  it('returns ranked entries in rank order with their real ids', () => {
    const catalog = [
      fish({ id: 'crap', name: 'Crap', defaultRank: 2 }),
      fish({ id: 'caras', name: 'Caras', defaultRank: 1 }),
      fish({ id: 'somn', name: 'Somn', defaultRank: null }),
    ];
    expect(resolveDefaultTargets(catalog)).toEqual([
      { id: 'caras', name: 'Caras' },
      { id: 'crap', name: 'Crap' },
    ]);
  });

  it('falls back to the four null-id fallback names when no entry has a rank', () => {
    const catalog = [fish({ id: 'crap', name: 'Crap', defaultRank: null })];
    expect(resolveDefaultTargets(catalog)).toEqual(FALLBACK_TARGET_NAMES.map(name => ({ id: null, name })));
  });

  it('falls back to the four null-id fallback names for an empty catalog', () => {
    expect(resolveDefaultTargets([])).toEqual([
      { id: null, name: 'Crap' },
      { id: null, name: 'Caras' },
      { id: null, name: 'Somn' },
      { id: null, name: 'Știucă' },
    ]);
  });
});

describe('speciesKey', () => {
  it('keys by id when present', () => {
    expect(speciesKey({ id: 'crap-doc-id', name: 'Crap' })).toBe('crap-doc-id');
  });

  it('keys null-id entries by normalized (trimmed, lowercased) name', () => {
    expect(speciesKey({ id: null, name: 'Crap' })).toBe('name:crap');
    expect(speciesKey({ id: null, name: '  Crap  ' })).toBe('name:crap');
    expect(speciesKey({ id: null, name: 'CRAP' })).toBe('name:crap');
  });
});

describe('sameSpecies', () => {
  it('matches a null-id fallback target against the same fish resolved with a real id', () => {
    expect(sameSpecies({ id: null, name: 'Crap' }, { id: 'crap-doc-id', name: 'Crap' })).toBe(true);
    expect(sameSpecies({ id: 'crap-doc-id', name: 'Crap' }, { id: null, name: 'Crap' })).toBe(true);
  });

  it('matches null-id entries by name case- and whitespace-insensitively', () => {
    expect(sameSpecies({ id: null, name: 'Crap' }, { id: null, name: '  crap ' })).toBe(true);
    expect(sameSpecies({ id: null, name: 'CRAP' }, { id: null, name: 'crap' })).toBe(true);
  });

  it('does not match two null-id entries with different names', () => {
    expect(sameSpecies({ id: null, name: 'Crap' }, { id: null, name: 'Caras' })).toBe(false);
  });

  it('compares real ids by id alone, even with different names', () => {
    expect(sameSpecies({ id: 'doc-1', name: 'Crap' }, { id: 'doc-1', name: 'Renamed' })).toBe(true);
    expect(sameSpecies({ id: 'doc-1', name: 'Crap' }, { id: 'doc-2', name: 'Crap' })).toBe(false);
  });
});

describe('mergeSpeciesChips', () => {
  it('keeps a selected species that is absent from the quick list', () => {
    const merged = mergeSpeciesChips([{ id: 'f-somn', name: 'Somn' }], [{ id: 'f-crap', name: 'Crap' }]);
    expect(merged.map(t => t.name)).toEqual(['Somn', 'Crap']);
  });

  it('lists selected species before unselected quick picks', () => {
    const quick = [
      { id: 'f-crap', name: 'Crap' },
      { id: 'f-caras', name: 'Caras' },
    ];
    const merged = mergeSpeciesChips([{ id: 'f-caras', name: 'Caras' }], quick);
    expect(merged.map(t => t.name)).toEqual(['Caras', 'Crap']);
  });

  it('renders a species present in both exactly once', () => {
    const merged = mergeSpeciesChips([{ id: 'f-crap', name: 'Crap' }], [{ id: 'f-crap', name: 'Crap' }]);
    expect(merged).toHaveLength(1);
  });

  it('collapses a fallback null-id entry with its real-id catalog twin', () => {
    const merged = mergeSpeciesChips([{ id: null, name: ' crap ' }], [{ id: 'f-crap', name: 'Crap' }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe(' crap ');
  });

  it('returns the quick list unchanged when nothing is selected', () => {
    const quick = [{ id: 'f-crap', name: 'Crap' }];
    expect(mergeSpeciesChips([], quick)).toEqual(quick);
  });
});
