import { describe, expect, it } from 'vitest';
import { validateStep } from '@/components/templates/T4/validation';
import { ApiError } from '@/core/transport';
import {
  accountInput,
  baseInput,
  currentMatch,
  GUEST_FIELDS,
  guestInput,
  guestSchema,
  notesSchema,
  NOTES_FIELD,
  pickerState,
  reputationLine,
  undecided,
  WALK_IN_ERROR_FALLBACK,
  walkInErrorMessage,
  walkInFacts,
  walkInSuccessMessage,
} from './model';
import { totalRow } from '@/app/(site)/balti/[id]/rezerva/confirmare/model';
import { buildBookingChips } from '@/core/booking';
import type { LakeDetail } from '@/core/lakes';

const sel = { stand: 'st1', start: '2026-12-01T06:00:00+02:00', end: '2026-12-01T18:00:00+02:00' };
const base = baseInput('lake1', sel, ['cabana']);
const user = { documentId: 'u1', username: 'Sim QA', avatar: null };

describe('guest form (c9, c14)', () => {
  const check = (v: Partial<Record<'contactFullname' | 'contactPhone' | 'notes', string>>) =>
    validateStep(guestSchema, { contactFullname: '', contactPhone: '', notes: '', ...v }, [...GUEST_FIELDS]);

  it('name and phone are required, with fish copy', () => {
    const r = check({});
    expect(r.byField).toEqual({ contactFullname: 'Acest câmp este obligatoriu', contactPhone: 'Adaugă un număr de telefon.' });
    expect(r.list.map((e) => e.id)).toEqual(['la-poarta-nume', 'la-poarta-telefon']);
  });
  it('7–15 digits with one optional leading +', () => {
    const msg = 'Numărul de telefon trebuie să aibă între 7 și 15 cifre';
    expect(check({ contactFullname: 'Ion', contactPhone: '123456' }).byField.contactPhone).toBe(msg);
    expect(check({ contactFullname: 'Ion', contactPhone: '1234567890123456' }).byField.contactPhone).toBe(msg);
    expect(check({ contactFullname: 'Ion', contactPhone: '+4071234567' }).ok).toBe(true);
    expect(check({ contactFullname: 'Ion', contactPhone: '1234567' }).ok).toBe(true);
  });
  it('notes ≤ 1000 in both modes', () => {
    expect(check({ contactFullname: 'Ion', contactPhone: '0712345678', notes: 'x'.repeat(1001) }).byField.notes).toBe('Ai voie maxim 1000 de caractere');
    expect(validateStep(notesSchema, { notes: 'x'.repeat(1001) }, NOTES_FIELD).list[0]).toMatchObject({ id: 'la-poarta-detalii' });
    expect(validateStep(notesSchema, { notes: 'x'.repeat(1000) }, NOTES_FIELD).ok).toBe(true);
  });
});

describe('account picker (c6)', () => {
  it('hint under 2 characters, spinner while the first answer is out, empty, results', () => {
    expect(pickerState('', false, 0)).toBe('hint');
    expect(pickerState(' s ', true, 0)).toBe('hint');
    expect(pickerState('si', true, 0)).toBe('searching');
    expect(pickerState('si', false, 0)).toBe('empty');
    expect(pickerState('si', true, 3)).toBe('results');
  });
});

describe('reputation line (c7)', () => {
  it('stars with a decimal comma and the plural, or «Fără evaluări încă»', () => {
    expect(reputationLine({ avgStars: 4.25, ratingCount: 1, noShowCount: 0 })).toEqual({ stars: '4,3', count: '1 evaluare', noShows: null });
    expect(reputationLine({ avgStars: 5, ratingCount: 3, noShowCount: 2 })).toEqual({ stars: '5,0', count: '3 evaluări', noShows: '2 neprezentări' });
    expect(reputationLine({ avgStars: null, ratingCount: 0, noShowCount: 1 })).toEqual({ stars: null, count: null, noShows: '1 neprezentare' });
    expect(reputationLine({ avgStars: 4, ratingCount: 20, noShowCount: 21 })).toMatchObject({ count: '20 de evaluări', noShows: '21 de neprezentări' });
  });
});

describe('phone match (c10–c13)', () => {
  const hit = { matched: true, user };
  it('a match belongs to the number it was looked up for', () => {
    expect(currentMatch('0712345678', '0712345678', hit)).toEqual(user);
    expect(currentMatch('07123456789', '0712345678', hit)).toBeNull();
    expect(currentMatch('0712345678', null, hit)).toBeNull();
    expect(currentMatch('0712345678', '0712345678', { matched: false, user: null })).toBeNull();
    expect(currentMatch('0712345678', '0712345678', undefined)).toBeNull();
  });
  it('undecided until answered for this very number', () => {
    expect(undecided(user, '0712345678', null)).toBe(true);
    expect(undecided(user, '0712345678', '0712345678')).toBe(false);
    expect(undecided(user, '0712345679', '0712345678')).toBe(true);
    expect(undecided(null, '0712345678', null)).toBe(false);
  });
});

describe('the submit (c8, c13, c17)', () => {
  it('account mode sends the account and the notes only', () => {
    expect(accountInput(base, 'u1', '  sosește la 7 ')).toEqual({
      lake: 'lake1',
      stand: 'st1',
      startDate: sel.start,
      endDate: sel.end,
      extras: ['cabana'],
      angler: 'u1',
      notes: 'sosește la 7',
    });
  });
  it('guest mode sends the contact, and the account only when linked', () => {
    const contact = guestSchema.parse({ contactFullname: ' Ion Pop ', contactPhone: '0712345678', notes: '' });
    const unlinked = guestInput(base, contact, null);
    expect(unlinked).toEqual({ ...base, contactFullname: 'Ion Pop', contactPhone: '0712345678', notes: '' });
    expect('angler' in unlinked).toBe(false);
    expect(guestInput(base, contact, 'u1')).toMatchObject({ angler: 'u1', contactPhone: '0712345678' });
  });
  it('success toast with the code only when returned', () => {
    expect(walkInSuccessMessage('AB12')).toBe('Rezervare adăugată! Cod: AB12.');
    expect(walkInSuccessMessage(null)).toBe('Rezervare adăugată!');
  });
});

describe('refusals (c18)', () => {
  const err = (bluCode: string | undefined, status = 400, message = 'Mesajul serverului.') =>
    new ApiError({ message, status, code: 'HTTP', bluCode });
  it.each([
    ['STAND_TAKEN', 'Standul tocmai a fost rezervat. Alege altul.'],
    ['NAME_REQUIRED', 'Adaugă numele pescarului.'],
    ['PHONE_REQUIRED', 'Adaugă un număr de telefon.'],
    ['PHONE_MISMATCH', 'Numărul nu corespunde contului selectat. Reîncearcă.'],
    ['ANGLER_NOT_FOUND', 'Contul selectat nu mai există. Alege altul.'],
    ['WINDOW_ENDED', 'Intervalul ales s-a încheiat deja.'],
    ['INVALID_DURATION', 'Durata selectată nu este validă.'],
    ['INVALID_SLOT_ALIGNMENT', 'Intervalul ales nu începe la o oră de start validă.'],
    ['BOOKING_DISABLED', 'Rezervările nu sunt active pentru acest lac.'],
    ['FORBIDDEN', 'Nu ai dreptul să adaugi rezervări pentru acest lac.'],
  ])('%s', (code, copy) => {
    expect(walkInErrorMessage(err(code))).toBe(copy);
  });
  it('the owner gate (a bare 403) is FORBIDDEN', () => {
    expect(walkInErrorMessage(err(undefined, 403, 'generic'))).toBe('Nu ai dreptul să adaugi rezervări pentru acest lac.');
  });
  it('an unknown code says the server sentence; no code, the fallback', () => {
    expect(walkInErrorMessage(err('NEW_RULE'))).toBe('Mesajul serverului.');
    expect(walkInErrorMessage(err(undefined, 500, 'generic'))).toBe(WALK_IN_ERROR_FALLBACK);
    expect(walkInErrorMessage(new Error('x'))).toBe(WALK_IN_ERROR_FALLBACK);
  });
});

describe('c19: what a created walk-in invalidates (core createWalkInBookingMutation)', () => {
  it('every bookings query, the owned-lakes stats and every per-lake operator stats', async () => {
    const { WALK_IN_INVALIDATES } = await import('@/core/booking');
    expect(WALK_IN_INVALIDATES).toEqual([['bookings'], ['operator-stats', 'owned'], ['operator-stats', 'lake']]);
  });
});

describe('walkInFacts (c1, c4, c15)', () => {
  const depositLake = {
    documentId: 'lake1',
    name: 'Balta cu avans',
    county: 'Ilfov',
    countyRef: null,
    paymentMode: 'deposit',
    depositPercent: 30,
    confirmationMode: 'manual',
    checkoutBufferMinutes: 30,
    regulationUrl: null,
    cancellationPolicy: null,
  } as unknown as LakeDetail;

  it('a walk-in is always cash at the gate: «Numerar», «Total · se plătește la fața locului», no deposit', () => {
    const f = walkInFacts('lake1', depositLake, 'Alt nume');
    expect(f).toMatchObject({ name: 'Balta cu avans', county: 'Ilfov', paymentMode: 'offline', depositPercent: null, checkoutBufferMinutes: 30 });
    expect(totalRow(f, 300)).toEqual({ label: 'Total', sub: 'se plătește la fața locului', amount: 300 });
    expect(buildBookingChips({ standName: '3', hours: 12, startHour: 6, paymentMode: f.paymentMode })).toContainEqual({ variant: 'payment', label: 'Numerar' });
    expect(walkInFacts('lake1', { ...depositLake, paymentMode: 'full' } as LakeDetail, undefined).paymentMode).toBe('offline');
  });

  it('a lake the public read does not know keeps the owned-lakes name, no county, null facts', () => {
    expect(walkInFacts('lake1', null, 'Balta mea')).toEqual({
      documentId: 'lake1',
      name: 'Balta mea',
      county: null,
      paymentMode: 'offline',
      depositPercent: null,
      confirmationMode: null,
      checkoutBufferMinutes: null,
      regulationUrl: null,
      cancellationPolicy: null,
    });
    expect(walkInFacts('lake1', null, undefined).name).toBe('');
  });
});
