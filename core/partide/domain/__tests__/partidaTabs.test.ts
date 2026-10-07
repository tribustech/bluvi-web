import { describe, expect, it } from 'vitest';
import { initialTab, tabAfterEndedChange, visibleTabs } from '../partidaTabs';

describe('visibleTabs (fish helpers/partidaTabs.ts)', () => {
  it('live → the five tabs, Cronometre first', () => {
    expect(visibleTabs(false)).toEqual(['crono', 'jurnal', 'galerie', 'stats', 'info']);
  });
  it('ended → the same without Cronometre', () => {
    expect(visibleTabs(true)).toEqual(['jurnal', 'galerie', 'stats', 'info']);
  });
});

describe('initialTab', () => {
  it('ended → Jurnal, whatever the rods', () => {
    expect(initialTab(true, 0)).toBe('jurnal');
    expect(initialTab(true, 3)).toBe('jurnal');
  });
  it('live with rods → Cronometre; live without → Jurnal', () => {
    expect(initialTab(false, 1)).toBe('crono');
    expect(initialTab(false, 0)).toBe('jurnal');
  });
});

describe('tabAfterEndedChange (fish [id].tsx live → ended effect)', () => {
  it('keeps a tab that still exists', () => {
    expect(tabAfterEndedChange('stats', true, 2)).toBe('stats');
    expect(tabAfterEndedChange('info', true, 0)).toBe('info');
  });
  it('a vanished tab (Cronometre) lands on the ended initial tab', () => {
    expect(tabAfterEndedChange('crono', true, 4)).toBe('jurnal');
  });
});
