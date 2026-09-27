import { describe, expect, it } from 'vitest';
import { applyMutedTypes, groupState, mutedTypesOf, toggleGroup, toggleType } from './notificationPreferences';

// ── ported from fish features/notifications/domain/__tests__/preferenceState.test.ts ────────────────
const group = {
  key: 'weighing',
  label: 'Cântare',
  types: [
    { key: 'a', label: 'A', muted: false },
    { key: 'b', label: 'B', muted: true },
    { key: 'c', label: 'C', muted: false },
  ],
};

describe('preferenceState', () => {
  it('reads muted keys from the dto', () => {
    expect(mutedTypesOf({ groups: [group] })).toEqual(['b']);
  });
  it('reads muted keys plus extraMuted, deduped', () => {
    expect(mutedTypesOf({ groups: [group], extraMuted: ['zzz', 'b'] })).toEqual(['b', 'zzz']);
  });
  it('toggles one type', () => {
    expect(toggleType(['b'], 'a', false)).toEqual(['b', 'a']);
    expect(toggleType(['b', 'a'], 'b', true)).toEqual(['a']);
    expect(toggleType(['b'], 'b', false)).toEqual(['b']);
  });
  it('toggles a whole group and reports its state', () => {
    expect(groupState(['b'], group)).toBe('partial');
    expect(groupState([], group)).toBe('on');
    expect(toggleGroup(['b', 'zzz'], group, false)).toEqual(['b', 'zzz', 'a', 'c']);
    expect(groupState(['a', 'b', 'c'], group)).toBe('off');
    expect(toggleGroup(['a', 'b', 'c', 'zzz'], group, true)).toEqual(['zzz']);
  });
  it('derives extraMuted from the submitted list for the optimistic write', () => {
    const result = applyMutedTypes({ groups: [group], extraMuted: ['old'] }, ['b', 'zzz']);
    expect(result.extraMuted).toEqual(['zzz']);
    const [resultGroup] = result.groups;
    expect(resultGroup.types.find(t => t.key === 'b')?.muted).toBe(true);
    expect(resultGroup.types.find(t => t.key === 'a')?.muted).toBe(false);
    expect(resultGroup.types.find(t => t.key === 'c')?.muted).toBe(false);
  });
});
