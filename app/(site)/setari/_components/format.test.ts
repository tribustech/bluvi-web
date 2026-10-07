import { describe, expect, it } from 'vitest';
import { avatarThumb, formatActiveSince, formatPhone, formatProvider, organizerState } from './format';

describe('formatPhone (account.settings.c15)', () => {
  it('spaces a 10-digit number as fish: 0712 345 678', () => {
    expect(formatPhone('0712345678')).toBe('0712 345 678');
  });
  it('shows anything else as stored, «-» when missing', () => {
    expect(formatPhone('+40712345678')).toBe('+40712345678');
    expect(formatPhone(null)).toBe('-');
    expect(formatPhone('  ')).toBe('-');
  });
});

describe('formatActiveSince (account.settings.c15, fish dd LLL yyyy ro)', () => {
  it('uses the ro short months and Romania\'s day', () => {
    expect(formatActiveSince('2025-11-05T10:00:00.000Z')).toBe('05 noi 2025');
    expect(formatActiveSince('2025-09-05T10:00:00.000Z')).toBe('05 sep 2025');
    expect(formatActiveSince('2025-05-01T10:00:00.000Z')).toBe('01 mai 2025');
    // 23:30 UTC on 31 Dec is already 1 Jan in Bucharest.
    expect(formatActiveSince('2025-12-31T23:30:00.000Z')).toBe('01 ian 2026');
  });
  it('«-» without a date or with a broken one', () => {
    expect(formatActiveSince(undefined)).toBe('-');
    expect(formatActiveSince('nope')).toBe('-');
  });
});

describe('formatProvider', () => {
  it('capitalises the provider', () => {
    expect(formatProvider('google')).toBe('Google');
    expect(formatProvider('local')).toBe('Local');
    expect(formatProvider(null)).toBe('-');
  });
});

describe('organizerState (account.settings.c5–c7)', () => {
  const role = (name: string) => ({ id: 1, documentId: 'r', name });
  it('organizer wins over a request', () => {
    expect(organizerState({ role: role('Organizer'), hasRequestedOrganizerRole: true })).toBe('organizer');
  });
  it('requested, not yet organizer → pending', () => {
    expect(organizerState({ role: role('Authenticated'), hasRequestedOrganizerRole: true })).toBe('pending');
  });
  it('neither (null counts as not requested) → none', () => {
    expect(organizerState({ role: role('Authenticated'), hasRequestedOrganizerRole: null })).toBe('none');
  });
});

describe('avatarThumb', () => {
  it('prefers the thumbnail, then the original, else null', () => {
    expect(avatarThumb({ avatar: { id: 1, documentId: 'a', url: '/o.jpg', formats: { thumbnail: { url: '/t.jpg' } } } })).toBe('/t.jpg');
    expect(avatarThumb({ avatar: { id: 1, documentId: 'a', url: '/o.jpg', formats: null } })).toBe('/o.jpg');
    expect(avatarThumb({ avatar: null })).toBeNull();
  });
});
