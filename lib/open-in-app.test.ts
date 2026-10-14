import { describe, expect, it } from 'vitest';
import { answeredRecently, isQuietPath, OPEN_IN_APP_QUIET_MS, openInAppHref, phoneOf } from './open-in-app';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15';
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

describe('open in app', () => {
  it('offers it on phones only', () => {
    expect(phoneOf(IPHONE)).toBe('ios');
    expect(phoneOf(ANDROID)).toBe('android');
    expect(phoneOf(MAC, 5)).toBe('ios'); // iPadOS
    expect(phoneOf(MAC, 0)).toBeNull();
    expect(phoneOf(WINDOWS)).toBeNull();
  });

  it('stays quiet on the sign-in page only', () => {
    expect(isQuietPath('/intra')).toBe(true);
    expect(isQuietPath('/intra/callback')).toBe(true);
    expect(isQuietPath('/intrari')).toBe(false);
    expect(isQuietPath('/balti/balta-alesteu')).toBe(false);
    expect(isQuietPath('/')).toBe(false);
  });

  it('keeps away for 3 days after an answer', () => {
    const now = 1_800_000_000_000;
    expect(answeredRecently(null, now)).toBe(false);
    expect(answeredRecently('garbage', now)).toBe(false);
    expect(answeredRecently(String(now - 1000), now)).toBe(true);
    expect(answeredRecently(String(now - OPEN_IN_APP_QUIET_MS + 1), now)).toBe(true);
    expect(answeredRecently(String(now - OPEN_IN_APP_QUIET_MS), now)).toBe(false);
  });

  it('links to the same page on app.bluvi.ro', () => {
    expect(openInAppHref('/concursuri/cn-2026/participanti', '?x=1')).toBe('https://app.bluvi.ro/concursuri/cn-2026/participanti?x=1');
    expect(openInAppHref('/', '')).toBe('https://app.bluvi.ro/');
  });
});
