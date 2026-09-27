import { describe, expect, it } from 'vitest';
import { offeredExtras } from './offeredExtras';
import { rowLabelAddsMeaning } from './chipModel';
import type { AvailabilityExtra, AvailabilityStand } from '../schemas';

const stand = (keys: string[]) => ({ extras: keys }) as Pick<AvailabilityStand, 'extras'>;
const cabin: AvailabilityExtra = { key: 'cabana100', label: 'Cabana', price: 100, unit: 'perNight' };
const boat: AvailabilityExtra = { key: 'barca', label: 'Barcă', price: 40, unit: 'perStay' };

describe('offeredExtras', () => {
  // Chita, stand 6: one cabin, priced per night. A 06:00–18:00 tour has none.
  it('drops a per-night extra from a booking that crosses no night', () => {
    expect(offeredExtras(stand(['cabana100']), [cabin], 0)).toEqual([]);
  });

  it('keeps it as soon as the booking covers a night', () => {
    expect(offeredExtras(stand(['cabana100']), [cabin], 1)).toEqual([cabin]);
  });

  it('keeps a per-stay extra on a day tour', () => {
    expect(offeredExtras(stand(['barca']), [boat], 0)).toEqual([boat]);
  });

  it('ignores extras the stand does not offer', () => {
    expect(offeredExtras(stand(['barca']), [cabin, boat], 5)).toEqual([boat]);
  });
});

describe('rowLabelAddsMeaning', () => {
  it.each(['Tur 12h', 'Tură 12h', 'tura 12 h', '12h', '12 ore'])('drops %s, which only repeats the duration', label => {
    expect(rowLabelAddsMeaning(label, 12)).toBe(false);
  });

  it('keeps a real package name', () => {
    expect(rowLabelAddsMeaning('Pachet weekend redus', 12)).toBe(true);
  });

  it('keeps a duration that is not this booking’s', () => {
    expect(rowLabelAddsMeaning('Tur 24h', 12)).toBe(true);
  });

  it('has nothing to show when the operator named nothing', () => {
    expect(rowLabelAddsMeaning(null, 12)).toBe(false);
  });
});
