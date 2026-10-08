import { describe, expect, it } from 'vitest';
import { OPERATOR_CANCEL_REASONS, friendlyActionError, type BookingDTO } from '@/core/booking';
import {
  acceptSummary,
  cancelWrite,
  confirmLabelFor,
  prefillFor,
  reasonError,
  REASON_PICK_REQUIRED,
  REASON_REQUIRED,
} from './model';

const base: BookingDTO = {
  documentId: 'b1',
  code: 'BK-1',
  startDate: '2026-10-20T03:00:00.000Z',
  endDate: '2026-10-20T15:00:00.000Z',
  bookingStatus: 'pending',
  priceTotal: 250,
  depositAmount: 0,
  paymentStatus: 'none',
  contactPhone: '+40700000000',
};

describe('reasonError (c5, c8)', () => {
  it('free text: ≥ 5 characters after trim', () => {
    expect(reasonError('')).toBe(REASON_REQUIRED);
    expect(reasonError('   abcd   ')).toBe(REASON_REQUIRED);
    expect(reasonError(' abcde ')).toBeNull();
    expect(REASON_REQUIRED).toBe('Motivul este obligatoriu (minim 5 caractere).');
  });
  it('with a reason list the pick is required first', () => {
    expect(reasonError('Un motiv lung', { reasons: OPERATOR_CANCEL_REASONS })).toBe(REASON_PICK_REQUIRED);
    expect(REASON_PICK_REQUIRED).toBe('Alege un motiv din listă.');
    expect(reasonError('', { reasons: OPERATOR_CANCEL_REASONS, optionKey: 'other' })).toBe(REASON_REQUIRED);
    expect(reasonError('Ploaie', { reasons: OPERATOR_CANCEL_REASONS, optionKey: 'weather' })).toBeNull();
  });
});

describe('reason list (c7, c8, c9, c10)', () => {
  it('six reasons in fish order', () => {
    expect(OPERATOR_CANCEL_REASONS.map((r) => r.label)).toEqual([
      'Pescarul nu s-a prezentat',
      'Pescarul a anunțat telefonic',
      'Condiții meteo',
      'Lucrări sau închidere',
      'Standul nu e disponibil',
      'Alt motiv',
    ]);
  });
  it('a pick prefills its text; «Alt motiv» leaves it empty', () => {
    const [noShow, , weather, , , other] = OPERATOR_CANCEL_REASONS;
    expect(prefillFor(noShow)).toBe('Pescarul nu s-a prezentat.');
    expect(prefillFor(weather)).toBe('Condiții meteo nefavorabile.');
    expect(prefillFor(other)).toBe('');
  });
  it('confirm label follows the pick', () => {
    expect(confirmLabelFor(OPERATOR_CANCEL_REASONS, undefined, 'Da, anulează')).toBe('Da, anulează');
    expect(confirmLabelFor(OPERATOR_CANCEL_REASONS, 'noShow', 'Da, anulează')).toBe('Da, marchează');
    expect(confirmLabelFor(OPERATOR_CANCEL_REASONS, 'weather', 'Da, anulează')).toBe('Da, anulează');
    expect(confirmLabelFor(undefined, undefined, 'Da, respinge')).toBe('Da, respinge');
  });
  it('no-show is its own write, everything else cancels', () => {
    expect(cancelWrite('noShow')).toBe('noShow');
    for (const k of ['anglerCalled', 'weather', 'closure', 'standUnavailable', 'other', undefined]) {
      expect(cancelWrite(k)).toBe('operatorCancel');
    }
  });
});

describe('acceptSummary (c2)', () => {
  it('stand, extras and the amount', () => {
    const s = acceptSummary({
      ...base,
      angler: { documentId: 'u1', username: 'ionel', avatar: null },
      stand: { documentId: 's1', name: 'A10' },
      basis: {
        durationHours: 12,
        rowLabel: null,
        composedFrom: [12],
        tourPrice: 200,
        extras: [
          { key: 'boat', label: 'Barcă', unit: 'perStay', unitPrice: 30, quantity: 1, total: 30 },
          { key: 'night', label: 'Noapte', unit: 'perNight', unitPrice: 20, quantity: 1, total: 20 },
        ],
      },
    });
    expect(s.anglerName).toBe('ionel');
    expect(s.standName).toBe('A10');
    expect(s.rows).toEqual([
      { label: 'Stand', value: 'A10' },
      { label: 'Extra', value: 'Barcă, Noapte' },
    ]);
    expect(s.amount).toBe(250);
    expect(s.period).toContain('→');
  });
  it('no stand, no extras: no rows; guest name falls back to the contact, then «Pescar»', () => {
    expect(acceptSummary({ ...base, contactFullname: 'Ion Pop' })).toMatchObject({ anglerName: 'Ion Pop', standName: null, rows: [] });
    expect(acceptSummary(base).anglerName).toBe('Pescar');
  });
});

describe('friendlyActionError (c11)', () => {
  it('maps by bluCode, else the server sentence, else the generic line', () => {
    expect(friendlyActionError({ bluCode: 'STAND_TAKEN', message: 'x' })).toBe('Standul are deja o rezervare confirmată pe acel interval.');
    expect(friendlyActionError({ bluCode: 'INVALID_STATUS' })).toBe('Rezervarea nu mai poate fi modificată.');
    expect(friendlyActionError({ bluCode: 'REJECT_REASON_REQUIRED' })).toBe(REASON_REQUIRED);
    expect(friendlyActionError({ bluCode: 'CANCEL_REASON_REQUIRED' })).toBe(REASON_REQUIRED);
    expect(friendlyActionError({ message: 'Lacul e închis.' })).toBe('Lacul e închis.');
    expect(friendlyActionError(undefined)).toBe('Acțiunea nu a putut fi finalizată. Încearcă din nou.');
  });
});
