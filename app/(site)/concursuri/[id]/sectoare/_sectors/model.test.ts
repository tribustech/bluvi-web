import { describe, expect, it } from 'vitest';
import {
  allocationsBody,
  applyEdits,
  initialSlots,
  isDirty,
  isEditable,
  placedStands,
  saveErrorMessage,
  sectorPalette,
  setSlot,
  standNames,
  standOptions,
  standsPerSector,
  withEdit,
} from './model';

const st = (id: string, name = id) => ({ id: 1, documentId: id, name });
const sector = (id: string, name: string, stands: string[]) => ({
  id: 1,
  documentId: id,
  name,
  minFishNumber: null,
  stands: stands.map((s) => st(s)),
});
const lake = (stands: string[]) => ({ id: 1, documentId: 'lake', name: 'Lac', contact: [], stands: stands.map((s) => st(s, `Stand ${s}`)) });

const competition = {
  participantsLimit: 5,
  competitionStatus: 'notStarted' as const,
  sectors: [sector('sa', 'A', ['s1', 's2']), sector('sb', 'B', [])],
  lake: lake(['s1', 's2', 's3', 's4']),
};

describe('organizer.sectors model', () => {
  it('c3: only notStarted is editable', () => {
    expect(isEditable({ competitionStatus: 'notStarted' })).toBe(true);
    for (const s of ['started', 'completed', 'cancelled', 'draft'] as const) expect(isEditable({ competitionStatus: s })).toBe(false);
  });

  it('c4: ceil(limit / sectors), 1 when unknown', () => {
    expect(standsPerSector(competition)).toBe(3);
    expect(standsPerSector({ participantsLimit: 6, sectors: competition.sectors })).toBe(3);
    expect(standsPerSector({ participantsLimit: null, sectors: competition.sectors })).toBe(1);
    expect(standsPerSector({ participantsLimit: 0, sectors: competition.sectors })).toBe(1);
    expect(standsPerSector({ participantsLimit: 10, sectors: [] })).toBe(1);
  });

  it('c5: slots prefilled in order; never fewer slots than stands', () => {
    expect(initialSlots(competition)).toEqual({ sa: ['s1', 's2', null], sb: [null, null, null] });
    expect(initialSlots({ participantsLimit: 2, sectors: [sector('sa', 'A', ['s1', 's2', 's3'])] })).toEqual({ sa: ['s1', 's2', 's3'] });
  });

  it('c6: every lake stand, the placed ones disabled', () => {
    const slots = initialSlots(competition);
    expect(placedStands(slots)).toEqual(new Set(['s1', 's2']));
    expect(standOptions(competition, slots)).toEqual([
      { standId: 's1', name: 'Stand s1', disabled: true },
      { standId: 's2', name: 'Stand s2', disabled: true },
      { standId: 's3', name: 'Stand s3', disabled: false },
      { standId: 's4', name: 'Stand s4', disabled: false },
    ]);
    expect(standOptions({ lake: null }, slots)).toEqual([]);
  });

  it('c6/c7: setSlot fills and empties one slot without touching the rest', () => {
    const slots = initialSlots(competition);
    const filled = setSlot(slots, 'sb', 1, 's3');
    expect(filled).toEqual({ sa: ['s1', 's2', null], sb: [null, 's3', null] });
    expect(slots.sb).toEqual([null, null, null]);
    expect(isDirty(slots, filled)).toBe(true);
    expect(isDirty(slots, setSlot(setSlot(filled, 'sb', 1, null), 'sa', 0, 's1'))).toBe(false);
  });

  it('c8: every sector present, empties skipped, slot order kept', () => {
    let slots = initialSlots(competition);
    slots = setSlot(slots, 'sa', 0, null);
    slots = setSlot(slots, 'sb', 2, 's4');
    slots = setSlot(slots, 'sb', 0, 's1');
    expect(allocationsBody(competition, slots)).toEqual({ allocations: { sa: ['s2'], sb: ['s1', 's4'] } });
    expect(allocationsBody(competition, { sa: [null], sb: [null] })).toEqual({ allocations: { sa: [], sb: [] } });
  });

  it('edits are a diff: applied over the latest competition, back to the server value = clean', () => {
    const base = initialSlots(competition);
    let edits = withEdit(base, {}, 'sb', 0, 's3');
    edits = withEdit(base, edits, 'sa', 1, null);
    expect(edits).toEqual({ 'sb:0': 's3', 'sa:1': null });
    expect(applyEdits(base, edits)).toEqual({ sa: ['s1', null, null], sb: ['s3', null, null] });
    // Back to the server's value: no edit left, the page is clean.
    const undone = withEdit(base, withEdit(base, edits, 'sb', 0, null), 'sa', 1, 's2');
    expect(undone).toEqual({});
    expect(applyEdits(base, undone)).toBe(base);
  });

  it('a sector added after the edit is sent with its server stands', () => {
    const before = initialSlots(competition);
    const edits = withEdit(before, {}, 'sb', 0, 's3');
    // The competition refetched: a sector added in the wizard (with stands), a higher limit.
    const after = { ...competition, participantsLimit: 9, sectors: [...competition.sectors, sector('sc', 'C', ['s4'])] };
    const slots = applyEdits(initialSlots(after), edits);
    expect(slots).toEqual({ sa: ['s1', 's2', null], sb: ['s3', null, null], sc: ['s4', null, null] });
    expect(allocationsBody(after, slots)).toEqual({ allocations: { sa: ['s1', 's2'], sb: ['s3'], sc: ['s4'] } });
    // A slot or sector that is gone drops its edit.
    const fewer = { ...competition, participantsLimit: 2, sectors: [sector('sa', 'A', ['s1'])] };
    expect(applyEdits(initialSlots(fewer), { ...edits, 'sa:3': 's4' })).toEqual({ sa: ['s1', null] });
  });

  it('names: the lake first, the sector copy for a stand off the lake list', () => {
    const names = standNames({ sectors: [sector('sa', 'A', ['gone'])], lake: lake(['s1']) });
    expect(names.get('s1')).toBe('Stand s1');
    expect(names.get('gone')).toBe('gone');
  });

  it('sector colours follow the ranking palette (sorted names, by index)', () => {
    const p = sectorPalette({ sectors: [sector('sc', 'C', []), sector('sa', 'A', [])] });
    expect(p.get('sa')).toEqual({ color: 'var(--color-sector-a)', letter: 'A' });
    expect(p.get('sc')).toEqual({ color: 'var(--color-sector-b)', letter: 'B' });
  });

  it('errors: the server message, else a fallback', () => {
    expect(saveErrorMessage(new Error('Standul 4 este deja alocat'))).toBe('Standul 4 este deja alocat');
    expect(saveErrorMessage(new Error('  '))).toMatch(/Încearcă din nou/);
    expect(saveErrorMessage('x')).toMatch(/Încearcă din nou/);
  });
});
