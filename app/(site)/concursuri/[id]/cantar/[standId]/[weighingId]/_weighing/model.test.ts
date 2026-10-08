import { describe, expect, it } from 'vitest';
import {
  catchData,
  catchMediaFilename,
  kg,
  reopenAllowed,
  revisionsCopy,
  sanitizeWeight,
  signatureFilename,
  splitDrift,
  splitPreview,
  totalKg,
  validateCatch,
  validateReason,
  weighingPermissions,
  weighingTitle,
  type ReopenContext,
} from './model';

const open: ReopenContext = {
  weighingId: 'w1',
  competition: { competitionStatus: 'started', roundStatus: null },
  standWeighings: [{ documentId: 'w0', weighingStatus: 'finished' }, { documentId: 'w1', weighingStatus: 'finished' }],
};

describe('weighing model (organizer.scale-weighing)', () => {
  it('c1: total of the catches, 3 decimals with a comma', () => {
    expect(kg(totalKg({ catches: [{ weight: 7.2 }, { weight: 5.25 }] as never }))).toBe('12,450');
    expect(kg(totalKg(undefined))).toBe('0,000');
  });

  it('c1: «Cântar N» from the stand list, «(Extra)», plain «Cântar» when unknown', () => {
    const list = [{ documentId: 'a' }, { documentId: 'b' }];
    expect(weighingTitle('b', list, 'normal')).toBe('Cântar 2');
    expect(weighingTitle('a', list, 'extra')).toBe('Cântar 1 (Extra)');
    expect(weighingTitle('x', list, 'normal')).toBe('Cântar');
    expect(weighingTitle('a', undefined, undefined)).toBe('Cântar');
  });

  it('c3: revisions copy with formatCount', () => {
    expect(revisionsCopy(1)).toBe('Acest cântar a avut o modificare.');
    expect(revisionsCopy(3)).toBe('Acest cântar a avut 3 modificări.');
    expect(revisionsCopy(20)).toBe('Acest cântar a avut 20 de modificări.');
  });

  it('c5/c17/c19: permissions per role and status', () => {
    expect(weighingPermissions('referee', 'started')).toEqual({ actions: true, signatures: false, reopen: false });
    expect(weighingPermissions('author', 'finished', open)).toEqual({ actions: false, signatures: true, reopen: true });
    expect(weighingPermissions('referee', 'finished', open).reopen).toBe(false);
    expect(weighingPermissions('referee', 'finished')).toEqual({ actions: false, signatures: true, reopen: false });
    expect(weighingPermissions('participant', 'started')).toEqual({ actions: false, signatures: false, reopen: false });
    expect(weighingPermissions('participant', 'finished')).toEqual({ actions: false, signatures: true, reopen: false });
    expect(weighingPermissions('none', 'finished')).toEqual({ actions: false, signatures: false, reopen: false });
    // Unknown statute: nothing offered (owner rule 4).
    expect(weighingPermissions(undefined, 'finished')).toEqual({ actions: false, signatures: false, reopen: false });
    expect(weighingPermissions('author', undefined).actions).toBe(false);
  });

  it('c19: reopen only when the CMS can accept it (started competition, running leg, no other open weighing)', () => {
    const w = (documentId: string, weighingStatus: 'started' | 'finished') => ({ documentId, weighingStatus });
    const ctx = (over: Partial<ReopenContext> = {}): ReopenContext => ({ ...open, ...over });
    expect(reopenAllowed(ctx())).toBe(true);
    // The weighing itself may be listed as open (a stale list): it does not block itself.
    expect(reopenAllowed(ctx({ standWeighings: [w('w1', 'started'), w('w0', 'finished')] }))).toBe(true);
    expect(reopenAllowed(ctx({ competition: { competitionStatus: 'completed', roundStatus: null } }))).toBe(false);
    expect(reopenAllowed(ctx({ competition: { competitionStatus: 'notStarted' } }))).toBe(false);
    expect(reopenAllowed(ctx({ competition: { competitionStatus: 'started', roundStatus: 'closed' } }))).toBe(false);
    expect(reopenAllowed(ctx({ competition: { competitionStatus: 'started', roundStatus: 'running' } }))).toBe(true);
    expect(reopenAllowed(ctx({ standWeighings: [w('w1', 'finished'), w('w2', 'started')] }))).toBe(false);
    // Unknown: not offered (owner rule 4).
    expect(reopenAllowed(ctx({ standWeighings: undefined }))).toBe(false);
    expect(reopenAllowed(ctx({ competition: undefined }))).toBe(false);
    expect(reopenAllowed(undefined)).toBe(false);
    expect(weighingPermissions('author', 'finished').reopen).toBe(false);
    expect(weighingPermissions('author', 'finished', ctx({ competition: { competitionStatus: 'completed' } })).reopen).toBe(false);
  });

  it('c8: weight required, > 0, ≤ 60, comma or dot', () => {
    expect(validateCatch('', 1, 's').weight).toBe('Acest câmp este obligatoriu');
    expect(validateCatch('0', 1, 's').weight).toBe('Greutatea trebuie să fie mai mare decât 0');
    expect(validateCatch('60,5', 1, 's').weight).toMatch(/^Ai introdus o valoare prea mare/);
    expect(validateCatch('60', 1, 's')).toEqual({});
    expect(validateCatch('4.25', 1, 's')).toEqual({});
  });

  it('c9: quantity required, ≥ 1, ≤ 20; c10: species required', () => {
    expect(validateCatch('4', Number.NaN, 's').quantity).toBe('Acest câmp este obligatoriu');
    expect(validateCatch('4', 0, 's').quantity).toBe('Cantitatea trebuie să fie mai mare ca 1');
    expect(validateCatch('4', 21, 's').quantity).toBe('Max 20');
    expect(validateCatch('4', 2, '').species).toBe('Acest câmp este obligatoriu');
  });

  it('c9: a split whose parts round to 0 kg is refused (deliberate break from fish)', () => {
    expect(validateCatch('0,05', 20, 's').weight).toBe('Greutatea este prea mică pentru 20 de pești');
    expect(validateCatch('0,01', 2, 's').weight).toBe('Greutatea este prea mică pentru 2 pești');
    expect(validateCatch('0,05', 2, 's')).toEqual({});
    expect(validateCatch('0,01', 1, 's')).toEqual({});
  });

  it('c9: the split total when the 0.025 kg steps change it', () => {
    expect(splitDrift('4,26', 2)).toBeCloseTo(4.25, 3);
    expect(splitDrift('4,25', 2)).toBeNull();
    expect(splitDrift('10', 3)).toBeNull();
    expect(splitDrift('4,26', 1)).toBeNull();
  });

  it('c9: split preview in 0.025 steps only above 1 fish', () => {
    expect(splitPreview('10', 1)).toEqual([]);
    expect(splitPreview('', 3)).toEqual([]);
    expect(splitPreview('10', 21)).toEqual([]);
    const parts = splitPreview('10', 3);
    expect(parts).toHaveLength(3);
    expect(parts.reduce((a, b) => a + b, 0)).toBeCloseTo(10, 3);
    for (const p of parts) expect(Math.round(p * 1000) % 25).toBe(0);
  });

  it('c12: the POST body — one rounded catch, or the split parts', () => {
    expect(catchData('4,2504', 1, 'sp')).toEqual([{ weight: 4.25, fishType: 'sp' }]);
    expect(catchData('10', 2, 'sp')).toEqual([
      { weight: 5, fishType: 'sp' },
      { weight: 5, fishType: 'sp' },
    ]);
  });

  it('sanitizes typed weights', () => {
    expect(sanitizeWeight('4,2,5')).toBe('4,25');
    expect(sanitizeWeight('a4.5kg')).toBe('4.5');
  });

  it('c19: reason required, ≤ 100', () => {
    expect(validateReason('  ')).toBe('Acest câmp este obligatoriu');
    expect(validateReason('x'.repeat(101))).toBe('Motivul trebuie să fie mai scurt de 100 de caractere');
    expect(validateReason('Greșeală la cântărire')).toBeUndefined();
  });

  it('file names as fish', () => {
    expect(signatureFilename('referee', 'w1')).toBe('refereeSignature-weighingDocumentId-w1.png');
    expect(catchMediaFilename(12, 'a.jpg')).toBe('CatchID_12_a.jpg');
  });
});
