import { describe, expect, it } from 'vitest';
import {
  BIO_MAX_ERROR,
  PHONE_ERROR,
  sanitizePhoneInput,
  toProfileRequest,
  USERNAME_MAX_ERROR,
  USERNAME_MIN_ERROR,
  validateProfile,
  BLU_CODE_FIELD,
} from '@/components/account/profile-form/schema';
import { buildAvatarUrl, DICEBEAR_PERSONAS } from '@/components/account/profile-form/generatedAvatar';

const ok = { username: 'Sim QA', phone: '', bio: '' };

describe('profile form schema (fish userProfile.schema + phone.schema)', () => {
  it('account.edit-profile.c5 username 3–20 with fish copy', () => {
    expect(validateProfile({ ...ok, username: 'ab' })).toEqual({ username: USERNAME_MIN_ERROR });
    expect(validateProfile({ ...ok, username: 'a'.repeat(21) })).toEqual({ username: USERNAME_MAX_ERROR });
    expect(validateProfile({ ...ok, username: 'abc' })).toEqual({});
    expect(validateProfile({ ...ok, username: 'a'.repeat(20) })).toEqual({});
  });

  it('account.edit-profile.c6 phone: empty, or optional + and 7–15 digits', () => {
    for (const phone of ['', '0712345', '+40712345678', '123456789012345']) expect(validateProfile({ ...ok, phone })).toEqual({});
    for (const phone of ['071234', '1234567890123456', '+', '07 12 34 56'])
      expect(validateProfile({ ...ok, phone })).toEqual({ phone: PHONE_ERROR });
  });

  it('account.edit-profile.c6 sanitises typed input to digits and one leading +', () => {
    expect(sanitizePhoneInput('+40 712-345 678')).toBe('+40712345678');
    expect(sanitizePhoneInput('  +4+0')).toBe('+40');
    expect(sanitizePhoneInput('07a1(2)3')).toBe('0712' + '3');
    expect(sanitizePhoneInput('4+0')).toBe('40');
  });

  it('account.edit-profile.c7 bio at most 200', () => {
    expect(validateProfile({ ...ok, bio: 'x'.repeat(200) })).toEqual({});
    expect(validateProfile({ ...ok, bio: 'x'.repeat(201) })).toEqual({ bio: BIO_MAX_ERROR });
  });

  it('account.edit-profile.c12 empty phone and blank bio are sent as null', () => {
    expect(toProfileRequest({ username: 'a', phone: '', bio: '   ' })).toEqual({ username: 'a', phone: null, bio: null });
    expect(toProfileRequest({ username: 'a', phone: '0712345', bio: ' hi ' })).toEqual({ username: 'a', phone: '0712345', bio: ' hi ' });
  });

  it('account.edit-profile.c13 maps the server bluCodes to their fields', () => {
    expect(BLU_CODE_FIELD).toEqual({
      USERNAME_ALREADY_IN_USE: 'username',
      PHONE_NUMBER_ALREADY_IN_USE: 'phone',
      'UPDATE_PROFILE:BIO_TOO_LONG': 'bio',
    });
  });

  it('builds fish buildAvatarUrl (DiceBear personas, same options)', () => {
    const url = new URL(buildAvatarUrl(0.5));
    expect(`${url.origin}${url.pathname}`).toBe(DICEBEAR_PERSONAS);
    expect(url.searchParams.get('seed')).toBe('0.5');
    expect(url.searchParams.get('hair')).toBe('beanie,buzzcut,cap,curlyHighTop,fade,mohawk,shortCombover');
    expect(url.searchParams.get('facialHairProbability')).toBe('25');
    expect(url.searchParams.get('radius')).toBe('15');
    expect(url.searchParams.get('backgroundColor')?.split(',')).toHaveLength(16);
  });
});
