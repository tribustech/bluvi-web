import { describe, expect, it } from 'vitest';
import { ApiError } from '../../transport';
import { friendlyCancelError, MIN_CANCEL_REASON_LEN } from './cancelReasons';

const FALLBACK = 'Nu am putut anula rezervarea. Încearcă din nou.';

describe('friendlyCancelError (fish helpers/friendlyCancelError.ts)', () => {
  it("shows the server's Romanian sentence", () => {
    expect(friendlyCancelError('Anularea nu mai este posibilă cu mai puțin de 24 de ore înainte.')).toBe(
      'Anularea nu mai este posibilă cu mai puțin de 24 de ore înainte.'
    );
    expect(
      friendlyCancelError(
        new ApiError({ message: 'Rezervarea nu mai poate fi anulată.', status: 400, code: 'HTTP', bluCode: 'INVALID_STATUS' })
      )
    ).toBe('Rezervarea nu mai poate fi anulată.');
  });

  it('never shows a bare code (an older backend put the code in message)', () => {
    expect(friendlyCancelError('CANCEL_NOTICE_TOO_SHORT')).toBe(FALLBACK);
    expect(friendlyCancelError({ message: 'CANCELLATION_WINDOW_PASSED', bluCode: 'CANCELLATION_WINDOW_PASSED' })).toBe(FALLBACK);
    // The message equals the bluCode even when it is not all caps.
    expect(friendlyCancelError({ message: 'Invalid_status', bluCode: 'Invalid_status' })).toBe(FALLBACK);
  });

  it('falls back when there is no message at all', () => {
    expect(friendlyCancelError(undefined)).toBe(FALLBACK);
    expect(friendlyCancelError(null)).toBe(FALLBACK);
    expect(friendlyCancelError('')).toBe(FALLBACK);
    expect(friendlyCancelError({})).toBe(FALLBACK);
  });
});

describe('MIN_CANCEL_REASON_LEN (fish CancelBookingSheet MIN_REASON_LEN)', () => {
  it('is 5', () => expect(MIN_CANCEL_REASON_LEN).toBe(5));
});
