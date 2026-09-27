import { describe, it, expect } from 'vitest';
import {
  PARTIDA_JOIN_FALLBACK,
  PARTIDA_JOIN_MESSAGES,
  partidaJoinErrorMessage,
} from '../partidaJoinError';

describe('partidaJoinErrorMessage', () => {
  it('maps each known join bluCode to its Romanian message', () => {
    expect(partidaJoinErrorMessage({ bluCode: 'PARTIDA:CODE_INVALID' })).toBe('Cod invalid');
    expect(partidaJoinErrorMessage({ bluCode: 'PARTIDA:ENDED' })).toBe('Partida s-a încheiat');
    expect(partidaJoinErrorMessage({ bluCode: 'PARTIDA:FULL' })).toBe('Partida este plină');
  });

  it('covers exactly the documented bluCodes', () => {
    expect(Object.keys(PARTIDA_JOIN_MESSAGES).sort()).toEqual([
      'PARTIDA:ALREADY_ACTIVE',
      'PARTIDA:CODE_INVALID',
      'PARTIDA:ENDED',
      'PARTIDA:FULL',
    ]);
  });

  it('explains the one-live-partidă rule instead of falling back', () => {
    expect(partidaJoinErrorMessage({ bluCode: 'PARTIDA:ALREADY_ACTIVE' })).toContain('deja o partidă');
  });

  it('falls back for an unknown bluCode', () => {
    expect(partidaJoinErrorMessage({ bluCode: 'PARTIDA:SOMETHING_NEW' })).toBe(PARTIDA_JOIN_FALLBACK);
  });

  it('falls back for a bluCode-less error (network / generic Error)', () => {
    expect(partidaJoinErrorMessage(new Error('Network Error'))).toBe(PARTIDA_JOIN_FALLBACK);
    expect(partidaJoinErrorMessage({ message: 'boom' })).toBe(PARTIDA_JOIN_FALLBACK);
    expect(partidaJoinErrorMessage(null)).toBe(PARTIDA_JOIN_FALLBACK);
    expect(partidaJoinErrorMessage(undefined)).toBe(PARTIDA_JOIN_FALLBACK);
    expect(partidaJoinErrorMessage('PARTIDA:FULL')).toBe(PARTIDA_JOIN_FALLBACK);
  });
});
