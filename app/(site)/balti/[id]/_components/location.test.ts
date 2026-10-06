import { describe, expect, it } from 'vitest';
import { lakeLocationLine } from './location';

describe('lakeLocationLine (lakes.detail.c9)', () => {
  it('drops the city and county the address already names (case, diacritics, «jud. X»)', () => {
    expect(lakeLocationLine({ address: 'Belin, nr. 360, jud. Covasna', cityRef: { name: 'Belin' }, countyRef: { name: 'Covasna' } })).toBe(
      'Belin, nr. 360, jud. Covasna',
    );
    expect(lakeLocationLine({ address: 'str. Mare 1, Bălănești', cityRef: { name: 'BALANESTI' }, countyRef: { name: 'Gorj' } })).toBe(
      'str. Mare 1, Bălănești, Gorj',
    );
  });

  it('keeps a city that only shares a prefix with a word of the address', () => {
    expect(lakeLocationLine({ address: 'DN1 km 30, Brazi', cityRef: { name: 'Braz' }, countyRef: null, county: 'Prahova' })).toBe(
      'DN1 km 30, Brazi, Braz, Prahova',
    );
  });

  it('without an address: city, county (core order)', () => {
    expect(lakeLocationLine({ address: null, cityRef: { name: 'Chitila' }, countyRef: { name: 'Ilfov' } })).toBe('Chitila, Ilfov');
    expect(lakeLocationLine({ address: '  ', cityRef: null, countyRef: null })).toBeNull();
  });
});
