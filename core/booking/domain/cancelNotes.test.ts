import { describe, expect, it } from 'vitest';
import { DEFAULT_NO_SHOW_NOTE, meaningfulNoShowNote, stripAppendedCancelReason } from './cancelNotes';

describe('stripAppendedCancelReason', () => {
  it('keeps plain angler notes untouched', () => {
    expect(stripAppendedCancelReason('Vin cu doi copii')).toBe('Vin cu doi copii');
  });

  it('drops the block operatorCancel appends, so the reason is not printed twice', () => {
    expect(stripAppendedCancelReason('Vin cu doi copii\n[Anulare operator] Lac înghețat')).toBe('Vin cu doi copii');
  });

  it('drops the block reject appends too, so the angler never reads the refusal as their own note', () => {
    expect(stripAppendedCancelReason('Vin cu doi copii\n[Refuz operator] Lac închis')).toBe('Vin cu doi copii');
    expect(stripAppendedCancelReason('[Refuz operator] Lac închis')).toBe('');
  });

  it('returns empty when the notes were only the appended reason', () => {
    expect(stripAppendedCancelReason('[Anulare operator] Lac înghețat')).toBe('');
    expect(stripAppendedCancelReason(undefined)).toBe('');
  });
});

describe('meaningfulNoShowNote', () => {
  it('hides the untouched default, which the status pill already says', () => {
    expect(meaningfulNoShowNote(true, DEFAULT_NO_SHOW_NOTE)).toBe('');
    expect(meaningfulNoShowNote(true, `  ${DEFAULT_NO_SHOW_NOTE}  `)).toBe('');
  });

  it('keeps a note the operator actually wrote', () => {
    expect(meaningfulNoShowNote(true, 'A sunat la 7 și a zis că nu mai vine')).toBe(
      'A sunat la 7 și a zis că nu mai vine'
    );
  });

  it('is empty when the booking is not a no-show at all', () => {
    expect(meaningfulNoShowNote(false, 'orice')).toBe('');
    expect(meaningfulNoShowNote(undefined, undefined)).toBe('');
  });
});

