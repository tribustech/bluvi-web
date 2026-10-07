import { describe, expect, it } from 'vitest';
import { ApiError } from '../../transport';
import {
  BOOKING_ERROR_COPY,
  BOOKING_ERROR_FALLBACK,
  bookingSubmitFailure,
  bookingSuccessMessage,
  friendlyBookingError,
  isBookingRequest,
  priceChangedMessage,
} from './bookingErrors';

const coded = (bluCode: string, message = 'Fraza serverului.', status = 400, details: Record<string, unknown> = {}) =>
  new ApiError({ message, status, code: 'HTTP', bluCode, details: { bluCode, ...details } });

describe('friendlyBookingError (fish review.tsx:37-69)', () => {
  it('maps the ten codes fish was taught, whatever the server says', () => {
    for (const [code, copy] of Object.entries(BOOKING_ERROR_COPY)) {
      expect(friendlyBookingError(coded(code))).toBe(copy);
    }
    expect(Object.keys(BOOKING_ERROR_COPY)).toHaveLength(10);
    expect(friendlyBookingError(coded('END_TIME_NOT_ALLOWED'))).toBe(
      'Balta nu acceptă rezervări care se încheie la ora aceasta. Alege alt interval.'
    );
  });

  it('any other code shows the server sentence', () => {
    expect(friendlyBookingError(coded('ANGLER_BOOKING_QUOTA', 'Ai deja numărul maxim de rezervări active la această baltă.'))).toBe(
      'Ai deja numărul maxim de rezervări active la această baltă.'
    );
  });

  it('no code: the fallback (the transport hides an uncoded message)', () => {
    expect(friendlyBookingError(new ApiError({ message: 'A apărut o eroare necunoscută.', status: 500, code: 'HTTP' }))).toBe(
      BOOKING_ERROR_FALLBACK
    );
    expect(friendlyBookingError(new Error('boom'))).toBe(BOOKING_ERROR_FALLBACK);
    expect(friendlyBookingError(null)).toBe(BOOKING_ERROR_FALLBACK);
    expect(friendlyBookingError(coded('WHATEVER', ''))).toBe(BOOKING_ERROR_FALLBACK);
  });

  it('a bare code string (the payment branch) is mapped', () => {
    expect(friendlyBookingError('PAYMENTS_NOT_CONFIGURED')).toBe('Plățile online nu sunt disponibile momentan.');
    expect(friendlyBookingError('CANCELED')).toBe(BOOKING_ERROR_FALLBACK);
  });
});

describe('bookingSubmitFailure (fish review.tsx:218-257)', () => {
  it('409 / PRICE_CHANGED: stay, with or without the fresh figure', () => {
    expect(bookingSubmitFailure(coded('PRICE_CHANGED', 'x', 409, { priceTotal: 360 }))).toEqual({
      kind: 'price-changed',
      fresh: 360,
      message: 'Prețul s-a actualizat la 360 lei. Verifică și confirmă din nou.',
    });
    expect(bookingSubmitFailure(coded('PRICE_CHANGED', 'x', 409))).toEqual({
      kind: 'price-changed',
      fresh: null,
      message: 'Prețul s-a actualizat. Verifică noul total și confirmă din nou.',
    });
    // A bare 409 is a price change too (fish: status === 409 || bluCode === 'PRICE_CHANGED').
    expect(bookingSubmitFailure(new ApiError({ message: 'x', status: 409, code: 'HTTP' })).kind).toBe('price-changed');
  });

  it('STAND_TAKEN / STAND_BLOCKED: back to the grid', () => {
    expect(bookingSubmitFailure(coded('STAND_TAKEN'))).toEqual({
      kind: 'stand-gone',
      code: 'STAND_TAKEN',
      message: 'Standul tocmai a fost rezervat. Am actualizat intervalele — alege altul.',
    });
    expect(bookingSubmitFailure(coded('STAND_BLOCKED')).message).toBe(
      'Intervalul nu mai este disponibil. Am actualizat intervalele — alege altul.'
    );
  });

  it('everything else: the friendly copy', () => {
    expect(bookingSubmitFailure(coded('START_IN_PAST'))).toEqual({ kind: 'other', message: 'Nu poți rezerva un interval din trecut.' });
    expect(bookingSubmitFailure(new Error('net'))).toEqual({ kind: 'other', message: BOOKING_ERROR_FALLBACK });
  });

  it('price changed copy', () => {
    expect(priceChangedMessage(299.5)).toBe('Prețul s-a actualizat la 299.5 lei. Verifică și confirmă din nou.');
  });
});

describe('success copy and request lakes', () => {
  it('the code only when returned', () => {
    expect(bookingSuccessMessage(true, 'BK7Q2')).toBe('Cererea a fost trimisă! Cod: BK7Q2. Vei fi notificat când este confirmată.');
    expect(bookingSuccessMessage(true, '')).toBe('Cererea a fost trimisă! Vei fi notificat când este confirmată.');
    expect(bookingSuccessMessage(false, 'BK7Q2')).toBe('Rezervare confirmată! Cod: BK7Q2.');
    expect(bookingSuccessMessage(false, null)).toBe('Rezervare confirmată!');
  });

  it('manual confirmation or offline payment is a request', () => {
    expect(isBookingRequest({ confirmationMode: 'manual', paymentMode: 'full' })).toBe(true);
    expect(isBookingRequest({ confirmationMode: 'instant', paymentMode: 'offline' })).toBe(true);
    expect(isBookingRequest({ confirmationMode: 'instant', paymentMode: 'deposit' })).toBe(false);
    expect(isBookingRequest({ confirmationMode: null, paymentMode: null })).toBe(false);
  });
});
