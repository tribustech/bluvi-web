import { describe, expect, it } from 'vitest';
import type { CompetitionWithMyStatus, Registration } from '@/core/competitions';
import { ApiError, GENERIC_ERROR_MESSAGE } from '@/core/transport';
import {
  ACTION_OPTIONS,
  ALREADY_ELIMINATED_MESSAGE,
  APPLY_FAILED_MESSAGE,
  applyErrorOutcome,
  isDirty,
  penaltyKg,
  resolveApplyTarget,
  subjectOf,
  validatePenalty,
} from './model';

const reg = (over: Partial<Registration> = {}): Registration =>
  ({
    id: 1,
    documentId: 'r1',
    registrationStatus: 'registered',
    teamName: 'Nada Grea',
    guestName: null,
    participants: [
      { id: 1, documentId: 'u1', username: 'Andrei Popescu' },
      { id: 2, documentId: 'u2', username: 'Mihai Ionescu' },
    ],
    stand: { id: 10, documentId: 's1', name: '1' },
    ...over,
  }) as Registration;

const comp = (over: Partial<CompetitionWithMyStatus> = {}) =>
  ({
    rankingType: 'quantity',
    competitionStatus: 'started',
    competitionType: 'team',
    sectors: [{ id: 1, documentId: 'secA', name: 'A', stands: [{ id: 10, documentId: 's1', name: '1' }] }],
    ...over,
  }) as CompetitionWithMyStatus;

describe('ACTION_OPTIONS (c3)', () => {
  it('has fish copy and colours, Avertisment first', () => {
    expect(ACTION_OPTIONS.map((o) => [o.label, o.tone])).toEqual([
      ['Avertisment', 'warning'],
      ['Penalizare greutate', 'warning'],
      ['Eliminare', 'danger'],
    ]);
  });
});

describe('resolveApplyTarget (c2)', () => {
  it('waits while a read is out', () => {
    expect(resolveApplyTarget({ competition: undefined, registrations: undefined, registrationId: 'r1' })).toBe('loading');
    expect(resolveApplyTarget({ competition: comp(), registrations: undefined, registrationId: 'r1' })).toBe('loading');
  });
  it('sends an unsupported ranking type to the hub, before anything else', () => {
    expect(resolveApplyTarget({ competition: comp({ rankingType: 'feederRounds' }), registrations: [], registrationId: 'x' })).toBe('hub');
    expect(resolveApplyTarget({ competition: comp({ rankingType: 'nationalChampionship' }), registrations: undefined, registrationId: null })).toBe('hub');
  });
  it('goes back without a registration id or for an unknown one', () => {
    expect(resolveApplyTarget({ competition: undefined, registrations: undefined, registrationId: '' })).toBe('back');
    expect(resolveApplyTarget({ competition: comp(), registrations: [reg()], registrationId: 'nope' })).toBe('back');
  });
  it('sends a competition that is not running to the hub (the CMS refuses outside «started»)', () => {
    for (const competitionStatus of ['draft', 'notStarted', 'completed', 'cancelled'] as const) {
      expect(resolveApplyTarget({ competition: comp({ competitionStatus }), registrations: [reg()], registrationId: 'r1' })).toBe('hub');
      expect(resolveApplyTarget({ competition: comp({ competitionStatus }), registrations: undefined, registrationId: 'r1' })).toBe('hub');
    }
  });
  it('goes back for a registration without a stand, or on a stand outside every sector', () => {
    expect(resolveApplyTarget({ competition: comp(), registrations: [reg({ stand: null })], registrationId: 'r1' })).toBe('back');
    expect(resolveApplyTarget({ competition: comp(), registrations: [reg({ stand: undefined })], registrationId: 'r1' })).toBe('back');
    expect(resolveApplyTarget({ competition: comp({ sectors: [] }), registrations: [reg()], registrationId: 'r1' })).toBe('back');
    const elsewhere = reg({ stand: { id: 99, documentId: 's99', name: '9' } } as Partial<Registration>);
    expect(resolveApplyTarget({ competition: comp(), registrations: [elsewhere], registrationId: 'r1' })).toBe('back');
  });
  it('is ready for a known registration', () => {
    expect(resolveApplyTarget({ competition: comp({ rankingType: 'quantityQuality' }), registrations: [reg()], registrationId: 'r1' })).toBe('ready');
  });
});

describe('subjectOf (c1)', () => {
  it('team: sector + stand, «Echipa», members as bullets', () => {
    expect(subjectOf(comp(), reg())).toEqual({
      title: 'Sector A, Stand 1',
      line: 'Echipa Nada Grea',
      people: ['Andrei Popescu', 'Mihai Ionescu'],
    });
  });
  it('single: the guest, else the first participant; no bullets', () => {
    const single = comp({ competitionType: 'single' });
    expect(subjectOf(single, reg({ guestName: 'Ion Guest' }))).toMatchObject({ line: 'Ion Guest', people: [] });
    expect(subjectOf(single, reg())).toMatchObject({ line: 'Andrei Popescu', people: [] });
    expect(subjectOf(single, reg({ participants: [] }))).toMatchObject({ line: '—' });
  });
  it('a team without a name falls back like fish', () => {
    expect(subjectOf(comp(), reg({ teamName: null })).line).toBe('Andrei Popescu');
  });
});

describe('validatePenalty (c4, c5)', () => {
  const ok = 'Comportament nesportiv';
  it('passes a warning with a reason', () => {
    expect(validatePenalty({ action: 'WARNING', value: '', reason: ok })).toEqual({});
  });
  it('reason 5–255', () => {
    expect(validatePenalty({ action: 'WARNING', value: '', reason: 'abc' }).reason).toBe('Motivul trebuie să aibă cel puțin 5 caractere');
    expect(validatePenalty({ action: 'WARNING', value: '', reason: 'x'.repeat(256) }).reason).toBe('Motivul nu poate depăși 255 caractere');
  });
  it('measures the trimmed reason, the one that is sent', () => {
    expect(validatePenalty({ action: 'WARNING', value: '', reason: '   abcd' }).reason).toBe('Motivul trebuie să aibă cel puțin 5 caractere');
    expect(validatePenalty({ action: 'WARNING', value: '', reason: '  abcd  \n' }).reason).toBe('Motivul trebuie să aibă cel puțin 5 caractere');
    expect(validatePenalty({ action: 'WARNING', value: '', reason: '  abcde  ' })).toEqual({});
  });
  it('weight: missing, zero, negative refused; comma or dot accepted', () => {
    const msg = 'Valoare obligatorie (kg) — trebuie să fie un număr mai mare ca 0';
    for (const value of ['', '0', '-1', 'abc']) expect(validatePenalty({ action: 'DEDUCT_TOTAL_WEIGHT', value, reason: ok }).value).toBe(msg);
    expect(validatePenalty({ action: 'DEDUCT_TOTAL_WEIGHT', value: '1,5', reason: ok })).toEqual({});
    expect(validatePenalty({ action: 'DEDUCT_TOTAL_WEIGHT', value: '0.250', reason: ok })).toEqual({});
  });
  it('a stale weight does not block another action', () => {
    expect(validatePenalty({ action: 'ELIMINATE', value: 'x', reason: ok })).toEqual({});
  });
});

describe('isDirty / penaltyKg', () => {
  it('dirty once anything changes', () => {
    expect(isDirty({ action: 'WARNING', value: '', reason: '  ' })).toBe(false);
    expect(isDirty({ action: 'ELIMINATE', value: '', reason: '' })).toBe(true);
    expect(isDirty({ action: 'WARNING', value: '', reason: 'a' })).toBe(true);
  });
  it('formats a valid weight with a comma', () => {
    expect(penaltyKg('1.5')).toBe('1,5');
    expect(penaltyKg('2,250')).toBe('2,25');
    expect(penaltyKg('0')).toBeNull();
    expect(penaltyKg('')).toBeNull();
  });
});

describe('applyErrorOutcome (c7)', () => {
  it('ALREADY_ELIMINATED is inline', () => {
    const e = new ApiError({ message: 'x', status: 409, code: 'HTTP', bluCode: 'PENALTY:ALREADY_ELIMINATED' });
    expect(applyErrorOutcome(e)).toEqual({ inline: ALREADY_ELIMINATED_MESSAGE });
  });
  it('another bluCode toasts its own message', () => {
    const e = new ApiError({ message: 'Penalizările pot fi aplicate doar în timpul competiției.', status: 400, code: 'HTTP', bluCode: 'PENALTY:INVALID_COMPETITION_STATUS' });
    expect(applyErrorOutcome(e)).toEqual({ toast: 'Penalizările pot fi aplicate doar în timpul competiției.' });
  });
  it('anything else toasts the fallback', () => {
    expect(applyErrorOutcome(new ApiError({ message: GENERIC_ERROR_MESSAGE, status: 500, code: 'HTTP' }))).toEqual({ toast: APPLY_FAILED_MESSAGE });
    expect(applyErrorOutcome(new Error('boom'))).toEqual({ toast: APPLY_FAILED_MESSAGE });
  });
});
