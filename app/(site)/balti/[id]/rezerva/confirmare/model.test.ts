import { describe, expect, it } from 'vitest';
import { validateStep } from '@/components/templates/T4/validation';
import {
  CONTACT_FIELDS,
  collectsUpFront,
  contactSchema,
  createInput,
  depositOf,
  paymentTermText,
  phoneChanged,
  prefillContact,
  priceRows,
  quoteView,
  totalRow,
  type ContactField,
  type PricedQuote,
} from './model';

const quote = (over: Partial<PricedQuote['basis']> = {}, total = 300): PricedQuote => ({
  total,
  basis: { durationHours: 12, rowLabel: 'Tur 12h', composedFrom: [12], tourPrice: 300, extras: [], ...over },
  refusal: null,
});

describe('contact form (c10–c13)', () => {
  const check = (v: Record<string, string>) => validateStep(contactSchema, v, [...CONTACT_FIELDS]);

  it('fish messages, in form order', () => {
    const r = check({ contactFullname: ' ', contactPhone: '', notes: 'x'.repeat(1001) });
    expect(r.list.map(e => [e.id, e.message])).toEqual([
      ['rezervare-nume', 'Acest câmp este obligatoriu'],
      ['rezervare-telefon', 'Adaugă un număr de telefon.'],
      ['rezervare-detalii', 'Ai voie maxim 1000 de caractere'],
    ]);
    expect(check({ contactFullname: 'Ion', contactPhone: '0712', notes: '' }).byField.contactPhone).toBe(
      'Numărul de telefon trebuie să aibă între 7 și 15 cifre'
    );
    expect(check({ contactFullname: 'Ion', contactPhone: '+40712345678', notes: 'x'.repeat(1000) }).ok).toBe(true);
  });

  it('parses trimmed values (the submit sends them)', () => {
    expect(contactSchema.parse({ contactFullname: ' Ion ', contactPhone: ' 0712345678 ', notes: ' sosesc la 7 ' })).toEqual({
      contactFullname: 'Ion',
      contactPhone: '0712345678',
      notes: 'sosesc la 7',
    });
  });

  it('prefill fills only empty, untouched fields (keepDirtyValues)', () => {
    const empty = { contactFullname: '', contactPhone: '', notes: '' };
    const none = new Set<ContactField>();
    expect(prefillContact(empty, none, { username: 'qa', phone: '0711111111' })).toEqual({ contactFullname: 'qa', contactPhone: '0711111111', notes: '' });
    // Typed before the profile came: kept. Emptied by the user: stays empty.
    const typed = { contactFullname: 'Ana', contactPhone: '', notes: 'n' };
    expect(prefillContact(typed, new Set<ContactField>(['contactFullname', 'contactPhone']), { username: 'qa', phone: '07' })).toBe(typed);
    expect(prefillContact(empty, none, null)).toBe(empty);
    expect(prefillContact(empty, none, { username: null, phone: null })).toBe(empty);
  });

  it('the phone is written back only when it changed', () => {
    expect(phoneChanged('0711111111', { phone: '0711111111' })).toBe(false);
    expect(phoneChanged('0722222222', { phone: '0711111111' })).toBe(true);
    expect(phoneChanged('0722222222', { phone: null })).toBe(true);
  });
});

describe('price block (c6, c7)', () => {
  it('rows from the quote only: the row name when it says more, else «{h}h»; extras with quantities', () => {
    expect(priceRows(quote())).toEqual([{ label: '12h', amount: 300 }]);
    const q = quote({
      rowLabel: 'Pachet weekend',
      durationHours: 36,
      tourPrice: 500,
      extras: [
        { key: 'c', label: 'Cabană', unit: 'perNight', quantity: 2, unitPrice: 150, total: 300 },
        { key: 'b', label: 'Barcă', unit: 'perStay', quantity: 1, unitPrice: 50, total: 50 },
      ] as PricedQuote['basis']['extras'],
    }, 850);
    expect(priceRows(q)).toEqual([
      { label: 'Pachet weekend', amount: 500 },
      { label: 'Cabană × 2', amount: 300 },
      { label: 'Barcă', amount: 50 },
    ]);
  });

  it('total by payment mode', () => {
    expect(totalRow({ paymentMode: 'deposit', depositPercent: 30 }, 333)).toEqual({ label: 'Avans de plată', sub: '30% din 333 lei', amount: 99.9 });
    expect(totalRow({ paymentMode: 'full', depositPercent: null }, 300)).toEqual({ label: 'De plată acum', amount: 300 });
    expect(totalRow({ paymentMode: 'offline', depositPercent: null }, 300)).toEqual({ label: 'Total', sub: 'se plătește la fața locului', amount: 300 });
    expect(totalRow({ paymentMode: null, depositPercent: null }, 300).label).toBe('Total');
    expect(depositOf(100.05, 50)).toBe(50.03);
  });
});

describe('confirmation terms (c14, c15)', () => {
  it('money line per mode', () => {
    expect(paymentTermText({ paymentMode: 'deposit', depositPercent: 30 }, 300)).toBe('Avans 30% din 300 lei, restul la fața locului');
    expect(paymentTermText({ paymentMode: 'full', depositPercent: null }, 300)).toBe('300 lei, se plătesc acum');
    expect(paymentTermText({ paymentMode: 'offline', depositPercent: null }, 300)).toBe('300 lei, se plătesc la fața locului');
  });
  it('the cancellation row only when money is collected up front', () => {
    expect(collectsUpFront('deposit')).toBe(true);
    expect(collectsUpFront('full')).toBe(true);
    expect(collectsUpFront('offline')).toBe(false);
    expect(collectsUpFront(null)).toBe(false);
  });
});

describe('quote view (c3)', () => {
  const refused = { total: null, basis: null, refusal: { code: 'X', message: 'Nu.' } } as const;
  it('priced / quoting / refused / failed', () => {
    expect(quoteView(quote(), false, false)).toEqual({ kind: 'priced', quote: quote(), refreshing: false });
    expect(quoteView(quote(), true, false).kind).toBe('priced');
    expect(quoteView(undefined, true, false)).toEqual({ kind: 'quoting' });
    expect(quoteView(refused, false, false)).toEqual({ kind: 'refused', message: 'Nu.' });
    expect(quoteView(refused, true, false)).toEqual({ kind: 'quoting' });
    expect(quoteView(undefined, false, true)).toEqual({ kind: 'failed' });
    expect(quoteView(undefined, false, false)).toEqual({ kind: 'quoting' });
  });
});

describe('submit body (c18)', () => {
  it('every field, expectedTotal = the quote total', () => {
    const sel = { stand: 's1', start: '2026-10-10T06:00:00+03:00', end: '2026-10-10T18:00:00+03:00' };
    expect(createInput('l', sel, ['cabana'], { contactFullname: 'Ion', contactPhone: '0712345678', notes: '' }, quote({}, 320))).toEqual({
      lake: 'l',
      stand: 's1',
      startDate: sel.start,
      endDate: sel.end,
      extras: ['cabana'],
      notes: '',
      contactFullname: 'Ion',
      contactPhone: '0712345678',
      expectedTotal: 320,
    });
  });
});
