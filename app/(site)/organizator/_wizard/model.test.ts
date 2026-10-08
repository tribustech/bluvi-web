import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCompetitionDefaultValues } from '@/core/organizer';
import { ApiError } from '@/core/transport';
import { AUTO_SAVE_DEBOUNCE_MS, createAutoSaveScheduler } from './autosave';
import {
  exitTarget,
  fieldErrors,
  isLocalBanner,
  isPublishBlocked,
  recoveryHref,
  reviewErrors,
  triageEditError,
  valuesEqual,
  wizardBasePath,
  wizardSegments,
  wizardStepPath,
  wizardSteps,
} from './model';
import { stepFromPath, stepIndex, WIZARD_STEP_DEFS } from './stepDefs';

describe('wizard steps', () => {
  it('six steps with fish titles (c1)', () => {
    expect(WIZARD_STEP_DEFS.map(s => s.title)).toEqual([
      'Detalii de bază',
      'Configurare competiție',
      'Tip clasament',
      'Lac și sectoare',
      'Alocă standuri',
      'Revizuire',
    ]);
    expect(stepIndex('standuri')).toBe(4);
    expect(stepIndex('nope')).toBe(0);
    expect(stepFromPath('/organizator/concursuri/nou/clasament')).toBe('clasament');
    expect(stepFromPath('/concursuri/x/editeaza/revizuire/')).toBe('revizuire');
    expect(stepFromPath('/concursuri/x')).toBeNull();
  });

  it('step list: filled by position like the segment bar (c3), completeness apart, everything reachable', () => {
    const steps = wizardSteps('clasament', [1, 5]);
    expect(steps.map(s => s.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming']);
    expect(steps.map(s => s.summary)).toEqual(['Completat', 'De completat', undefined, undefined, 'Completat', undefined]);
    expect(steps.every(s => s.reachable)).toBe(true);
    // A new competition on the review step: steps 1–5 are passed (filled), none complete.
    expect(wizardSteps('revizuire', []).map(s => s.state)).toEqual(['done', 'done', 'done', 'done', 'done', 'current']);
    // c3: the segment bar fills by position (up to and including the current step).
    expect(wizardSegments('clasament').map(s => s.state)).toEqual(['done', 'done', 'current', 'upcoming', 'upcoming', 'upcoming']);
  });
});

describe('wizard model', () => {
  it('review errors + the frame publish gate (fish step-review hasAnyError)', () => {
    expect(isPublishBlocked(createCompetitionDefaultValues)).toBe(true);
    expect(reviewErrors(createCompetitionDefaultValues)).toEqual({
      basics: ['name', 'startDate', 'endDate'],
      config: ['participantsLimit', 'fishSpeciesIds'],
      ranking: ['rankingType'],
      lakeSectors: ['lake', 'sectors'],
    });
    const valid = {
      ...createCompetitionDefaultValues,
      name: 'Cupa',
      startDate: '2026-11-14T05:00:00.000Z',
      endDate: '2026-11-15T12:00:00.000Z',
      participantsLimit: '12',
      fishSpeciesIds: ['crap'],
      rankingType: 'quantity',
      lake: 'lac',
      sectors: [{ name: 'A', minFishNumber: 1 }],
    };
    expect(isPublishBlocked(valid)).toBe(false);
    expect(reviewErrors({ ...valid, rankingType: 'bestOf' }).ranking).toEqual(['bestOfFishCount', 'numberOfWinners']);
    expect(reviewErrors({ ...valid, rankingType: 'bestOfTiers', bestOfTierSizes: [3, 3] }).ranking).toEqual(['bestOfTierSizesInvalid']);
    expect(reviewErrors({ ...valid, competitionType: 'team', teamParticipants: '11' }).config).toEqual(['teamParticipants']);
    expect(isPublishBlocked({ ...valid, registerFee: '60000' })).toBe(true);
  });

  it('field errors from the schema, first message per field', () => {
    expect(fieldErrors({ ...createCompetitionDefaultValues, name: 'ab', registerFee: '60000' })).toEqual({
      name: 'Numele trebuie să aibă cel puțin 3 caractere',
      registerFee: 'Taxa de înscriere trebuie să fie între 0 și 50.000 RON.',
    });
    expect(fieldErrors({ ...createCompetitionDefaultValues, name: 'Cupa' })).toEqual({});
  });

  it('dirty check ignores key order and undefined', () => {
    const a = { ...createCompetitionDefaultValues, name: 'Cupa', description: undefined };
    const b = { ...createCompetitionDefaultValues, name: 'Cupa' };
    expect(valuesEqual(a, b)).toBe(true);
    expect(valuesEqual(a, { ...b, sectors: [{ name: 'A', minFishNumber: 1 }] })).toBe(false);
  });

  it('local banner = object URL', () => {
    expect(isLocalBanner('blob:http://localhost/1')).toBe(true);
    expect(isLocalBanner('https://cdn/x.jpg')).toBe(false);
    expect(isLocalBanner(undefined)).toBe(false);
  });

  it('paths and exit targets (c6, c20)', () => {
    expect(wizardStepPath('configurare', null)).toBe('/organizator/concursuri/nou/configurare');
    expect(wizardStepPath('revizuire', 'c1')).toBe('/concursuri/c1/editeaza/revizuire');
    expect(wizardBasePath('c1')).toBe('/concursuri/c1/editeaza/');
    expect(exitTarget('/concursuri/x?tab=1', 'c1')).toBe('/concursuri/x?tab=1');
    expect(exitTarget(null, 'c1')).toBe('/concursuri/c1');
    expect(exitTarget(null, null)).toBe('/organizator');
    expect(recoveryHref({ kind: 'organizer' })).toBe('/organizator');
    expect(recoveryHref({ kind: 'competition', competitionId: 'c1' })).toBe('/concursuri/c1');
  });

  it('edit error triage (c12, c14)', () => {
    const risk = new ApiError({
      message: 'Confirmare necesară pentru modificări cu impact.',
      status: 409,
      code: 'HTTP',
      bluCode: 'ORGANIZER:EDIT_RISK_CONFIRMATION_REQUIRED',
      details: { bluCode: 'x', risks: [{ riskCode: 'PARTICIPANTS_LIMIT_BELOW_REGISTERED' }], impact: { registeredCount: 4 } },
    });
    expect(triageEditError(risk)).toEqual({
      kind: 'risk',
      details: {
        risks: [{ riskCode: 'PARTICIPANTS_LIMIT_BELOW_REGISTERED' }],
        impact: { registeredCount: 4, pendingCount: 0, allocatedRegistrationsCount: 0, allocatedStandsCount: 0 },
      },
    });
    const blocking = new ApiError({ message: 'Prea mulți', status: 400, code: 'HTTP', bluCode: 'ORGANIZER:INVALID_PARTICIPANTS_LIMIT' });
    expect(triageEditError(blocking)).toEqual({ kind: 'blocking', bluCode: 'ORGANIZER:INVALID_PARTICIPANTS_LIMIT', message: 'Prea mulți' });
    expect(triageEditError(new ApiError({ message: '', status: 400, code: 'HTTP', bluCode: 'ORGANIZER:DUPLICATE_SECTOR_NAMES' }))).toMatchObject({
      message: 'Datele introduse nu sunt valide pentru salvare.',
    });
    expect(triageEditError(new Error('boom'))).toEqual({ kind: 'other', message: 'boom' });
  });
});

describe('auto-save scheduler (fish createAutoSaveScheduler)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces, flushes, cancels and re-binds', async () => {
    const calls: string[] = [];
    const s = createAutoSaveScheduler({ save: async () => void calls.push('a'), delayMs: AUTO_SAVE_DEBOUNCE_MS });
    s.schedule();
    vi.advanceTimersByTime(400);
    s.schedule();
    vi.advanceTimersByTime(400);
    expect(calls).toEqual([]);
    expect(s.pending()).toBe(true);
    vi.advanceTimersByTime(100);
    expect(calls).toEqual(['a']);
    s.setSave(async () => void calls.push('b'));
    s.schedule();
    await s.flush();
    expect(calls).toEqual(['a', 'b']);
    vi.advanceTimersByTime(1000);
    expect(calls).toEqual(['a', 'b']);
    s.schedule();
    s.cancel();
    vi.advanceTimersByTime(1000);
    expect(calls).toEqual(['a', 'b']);
  });

  it('a failing save never rejects flush', async () => {
    const s = createAutoSaveScheduler({ save: () => Promise.reject(new Error('x')), delayMs: 500 });
    await expect(s.flush()).resolves.toBeUndefined();
  });
});
