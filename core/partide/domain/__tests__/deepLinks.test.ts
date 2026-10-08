import { describe, expect, it } from 'vitest';
import { partidaInviteMessage, partidaJoinDeepLink, partidaShareMessage, partidaSpectateDeepLink, shareVisible } from '../deepLinks';

describe('partidaSpectateDeepLink (fish helpers/deepLinks.ts)', () => {
  it('is the universal link on the app domain, keyed by documentId', () => {
    expect(partidaSpectateDeepLink('abc123')).toBe('https://bluvi-app.wearetribus.com/partide/comunitate/abc123');
  });
  it('the share message is fish’s', () => {
    expect(partidaShareMessage('abc')).toBe('Vezi partida mea pe Bluvi 🎣 https://bluvi-app.wearetribus.com/partide/comunitate/abc');
  });
});

describe('shareVisible', () => {
  it('no session → not shareable', () => {
    expect(shareVisible(null)).toBe(false);
    expect(shareVisible(undefined)).toBe(false);
  });
  it('visibleOnProfile false → not shareable (a dead link otherwise)', () => {
    expect(shareVisible({ visibleOnProfile: false })).toBe(false);
  });
  it('true, null or absent → the default, visible', () => {
    expect(shareVisible({ visibleOnProfile: true })).toBe(true);
    expect(shareVisible({ visibleOnProfile: null })).toBe(true);
    expect(shareVisible({})).toBe(true);
  });
});

describe('partidaJoinDeepLink / partidaInviteMessage (fish components/CoopCard.tsx)', () => {
  it('is the join universal link keyed by the code', () => {
    expect(partidaJoinDeepLink('K7M2QX')).toBe('https://bluvi-app.wearetribus.com/partide/join/K7M2QX');
  });
  it('the invite message is fish’s', () => {
    expect(partidaInviteMessage('K7M2QX')).toBe(
      'Hai în partida mea pe Bluvi! Folosește codul K7M2QX sau deschide linkul: https://bluvi-app.wearetribus.com/partide/join/K7M2QX',
    );
  });
});
