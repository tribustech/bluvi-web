import { describe, expect, it } from 'vitest';
import { competitionInitials, mutedSummary } from './summary';

describe('competitionInitials (fish notification-preferences.tsx)', () => {
  it('keeps letters only before taking the initials', () => {
    expect(competitionInitials('[AUDIT27] Start maine')).toBe('AS');
    expect(competitionInitials('Cupa C&B 2026')).toBe('CC');
    expect(competitionInitials('Ștefan')).toBe('ȘT');
  });
  it('falls back to the raw name when it has no letters', () => {
    expect(competitionInitials('2026')).toBe('20');
  });
});

describe('mutedSummary', () => {
  it('says all on at 0, and counts with Romanian plurals', () => {
    expect(mutedSummary(0)).toBe('Toate notificările pornite');
    expect(mutedSummary(1)).toBe('1 tip oprit');
    expect(mutedSummary(3)).toBe('3 tipuri oprite');
    expect(mutedSummary(20)).toBe('20 de tipuri oprite');
  });
});
