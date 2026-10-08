import { describe, expect, it } from 'vitest';
import { partidaInviteMessage } from '@/core/partide/domain/deepLinks';
import { cleanCode, codeFromPaste, isCompleteCode } from './code';

describe('cleanCode (fish join onChange)', () => {
  it('uppercases, keeps A–Z0–9 and caps at six', () => {
    expect(cleanCode('k7m2qx')).toBe('K7M2QX');
    expect(cleanCode('k7-m 2_qx!')).toBe('K7M2QX');
    expect(cleanCode('ABCDEFGH')).toBe('ABCDEF');
    expect(cleanCode('ăîșț')).toBe('');
  });
  it('is complete at exactly six', () => {
    expect(isCompleteCode('ABCDE')).toBe(false);
    expect(isCompleteCode('ABCDEF')).toBe(true);
  });
});

describe('codeFromPaste', () => {
  it('cleans a bare code', () => {
    expect(codeFromPaste(' k7m-2qx ')).toBe('K7M2QX');
    expect(codeFromPaste('ab1')).toBe('AB1');
  });
  it('takes the code from a pasted invite', () => {
    expect(codeFromPaste(partidaInviteMessage('K7M2QX'))).toBe('K7M2QX');
    expect(codeFromPaste('https://bluvi-app.wearetribus.com/partide/join/q2w3e4')).toBe('Q2W3E4');
  });
  it('falls back to the first six characters of anything else', () => {
    expect(codeFromPaste('abcdefgh123')).toBe('ABCDEF');
  });
});
