import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { competitionsKeys, registrationGuestMutation, updateRegistrationGuestMutation } from '@/core/competitions';
import { ApiError } from '@/core/transport';
import { createFakeTransport } from '@/tests/transport';
import {
  buildPayload,
  canAddName,
  capacityLine,
  effectiveMembersOnly,
  findGuestRegistration,
  hasErrors,
  isDirty,
  joinedGuestName,
  NAME_PATTERN,
  NAME_PATTERN_MESSAGE,
  REQUIRED,
  sanitizeName,
  seedValues,
  TEAM_NAME_LENGTH,
  TEAM_NAME_PATTERN,
  teamMaxCaption,
  validate,
  writeErrorMessage,
} from './model';

const SINGLE = { isTeam: false, membersOnly: false };
const TEAM = { isTeam: true, membersOnly: false };
const MEMBERS = { isTeam: true, membersOnly: true };

describe('sanitizeName (c6)', () => {
  it('strips leading spaces and collapses repeated ones', () => {
    expect(sanitizeName('   Ion')).toBe('Ion');
    expect(sanitizeName('Ion    Popescu')).toBe('Ion Popescu');
    expect(sanitizeName('Ion  ')).toBe('Ion ');
    expect(sanitizeName('\t Ana\t\tMaria')).toBe('Ana Maria');
    expect(sanitizeName('   ')).toBe('');
  });
});

describe('NAME_PATTERN (c6)', () => {
  it.each(['Ion Popescu', 'Ștefan Țăran', 'Ăâîșț ĂÂÎȘȚ', 'Echipa-2', 'Müller', 'Ion 3'])('accepts %s', name => {
    expect(NAME_PATTERN.test(name)).toBe(true);
  });
  it.each(['Ion, Ana', 'Ion.', 'Ion_Pop', 'Ion@', 'Ion!', '', 'O’Neil'])('refuses %s', name => {
    expect(NAME_PATTERN.test(name)).toBe(false);
  });
});

describe('validate (c6, c7)', () => {
  it('every name is required, then the character rule — the first message per field', () => {
    const e = validate({ names: ['', 'Ion!', 'Ana'], teamName: '' }, TEAM);
    expect(e.names).toEqual({ 0: REQUIRED, 1: NAME_PATTERN_MESSAGE });
    expect(e.teamName).toBeUndefined();
    expect(hasErrors(e)).toBe(true);
  });
  it('a single competition validates its one field', () => {
    expect(validate({ names: [''], teamName: '' }, SINGLE).names).toEqual({ 0: REQUIRED });
    expect(hasErrors(validate({ names: ['Ion Pop'], teamName: 'ignored!!' }, SINGLE))).toBe(false);
  });
  it('the team name is optional, ≤ 30 and uses the same characters', () => {
    expect(validate({ names: ['Ion'], teamName: '' }, TEAM).teamName).toBeUndefined();
    expect(validate({ names: ['Ion'], teamName: 'a'.repeat(30) }, TEAM).teamName).toBeUndefined();
    expect(validate({ names: ['Ion'], teamName: 'a'.repeat(31) }, TEAM).teamName).toBe(TEAM_NAME_LENGTH);
    expect(validate({ names: ['Ion'], teamName: 'Crapul #1' }, TEAM).teamName).toBe(TEAM_NAME_PATTERN);
  });
  it('membersOnly validates only the team name (the names are hidden)', () => {
    const e = validate({ names: ['', 'x!'], teamName: 'Echipa' }, MEMBERS);
    expect(hasErrors(e)).toBe(false);
    expect(validate({ names: [''], teamName: 'x!' }, MEMBERS).teamName).toBe(TEAM_NAME_PATTERN);
  });
});

describe('seedValues (c8)', () => {
  it('add mode: one empty name', () => {
    expect(seedValues(null, { isTeam: true })).toEqual({ names: [''], teamName: '' });
  });
  it('edit, team: guestName split on «, », the team name', () => {
    expect(seedValues({ guestName: 'Ion Pop, Ana Maria, ', teamName: 'Crapii' }, { isTeam: true })).toEqual({
      names: ['Ion Pop', 'Ana Maria'],
      teamName: 'Crapii',
    });
  });
  it('edit, single: the whole guestName in the one field', () => {
    expect(seedValues({ guestName: 'Ion Pop', teamName: null }, { isTeam: false })).toEqual({ names: ['Ion Pop'], teamName: '' });
  });
  it('edit with no guest name: one empty field', () => {
    expect(seedValues({ guestName: null, teamName: null }, { isTeam: true })).toEqual({ names: [''], teamName: '' });
  });
});

describe('isDirty (c14)', () => {
  const base = { names: ['Ion'], teamName: '' };
  it('compares names, their count and the team name', () => {
    expect(isDirty(base, base)).toBe(false);
    expect(isDirty({ names: ['Ion', ''], teamName: '' }, base)).toBe(true);
    expect(isDirty({ names: ['Ioan'], teamName: '' }, base)).toBe(true);
    expect(isDirty({ names: ['Ion'], teamName: 'x' }, base)).toBe(true);
  });
});

describe('team size (c5)', () => {
  it('adds while fewer than teamParticipants (fish: ?? 1)', () => {
    expect(canAddName(1, 3)).toBe(true);
    expect(canAddName(3, 3)).toBe(false);
    expect(canAddName(1, null)).toBe(false);
  });
  it('the caption uses Romanian plurals', () => {
    expect(teamMaxCaption(1)).toBe('Maxim 1 participant/echipă');
    expect(teamMaxCaption(3)).toBe('Maxim 3 participanți/echipă');
    expect(teamMaxCaption(20)).toBe('Maxim 20 de participanți/echipă');
  });
});

describe('buildPayload (c9–c12)', () => {
  const ctx = { competitionId: 'c1', registrationId: null };
  it('add, team: names trimmed, empties dropped, joined with «, »; the team name trimmed', () => {
    expect(buildPayload({ names: [' Ion Pop ', '', 'Ana '], teamName: 'Crapii ' }, { ...ctx, ...TEAM })).toEqual({
      kind: 'create',
      payload: { competitionId: 'c1', guestName: 'Ion Pop, Ana', teamName: 'Crapii' },
    });
  });
  it('add, single: the one field, teamName «» as fish', () => {
    expect(buildPayload({ names: ['Ion '], teamName: 'x' }, { ...ctx, ...SINGLE })).toEqual({
      kind: 'create',
      payload: { competitionId: 'c1', guestName: 'Ion', teamName: '' },
    });
  });
  it('c10 — nothing left: no write', () => {
    expect(buildPayload({ names: ['  ', ''], teamName: '' }, { ...ctx, ...TEAM })).toEqual({ kind: 'empty' });
    expect(joinedGuestName({ names: [' '], teamName: '' }, { isTeam: false })).toBe('');
  });
  it('edit: PUT data with guestName and teamName', () => {
    expect(buildPayload({ names: ['Ion', 'Ana'], teamName: '' }, { ...ctx, registrationId: 'r1', ...TEAM })).toEqual({
      kind: 'update',
      payload: { registrationId: 'r1', guestName: 'Ion, Ana', teamName: '' },
    });
  });
  it('c9 — membersOnly: guestName is not sent, even with no names', () => {
    const built = buildPayload({ names: [''], teamName: 'Noul nume' }, { ...ctx, registrationId: 'r1', ...MEMBERS });
    expect(built).toEqual({ kind: 'update', payload: { registrationId: 'r1', teamName: 'Noul nume' } });
    expect(built.kind === 'update' && 'guestName' in built.payload).toBe(false);
  });
});

describe('findGuestRegistration', () => {
  const guest = { documentId: 'g', guestName: 'Ion', participants: [] };
  const account = { documentId: 'a', guestName: null, participants: [{ id: 1, documentId: 'u', username: 'u', avatar: null }] };
  it('finds a guest entry; an account entry goes to the registration page, doarEchipa or not', () => {
    expect(findGuestRegistration([guest, account], 'g')).toEqual({ kind: 'found', registration: guest });
    expect(findGuestRegistration([guest, account], 'a').kind).toBe('account');
    expect(findGuestRegistration([guest], 'zzz').kind).toBe('missing');
  });
});

describe('effectiveMembersOnly', () => {
  it('doarEchipa holds on a team competition only (a single one falls back to the normal edit)', () => {
    expect(effectiveMembersOnly(true, { isTeam: true })).toBe(true);
    expect(effectiveMembersOnly(true, { isTeam: false })).toBe(false);
    expect(effectiveMembersOnly(false, { isTeam: true })).toBe(false);
  });
});

describe('writeErrorMessage (c11, c12)', () => {
  it('maps the CMS refusals to Romanian; else the message; else a fallback', () => {
    const limit = new ApiError({ message: 'Competition participants limit reached', status: 400, code: 'bad_request' as never, bluCode: 'REGISTRATION:COMPETITION_PARTICIPANTS_LIMIT_REACHED' });
    expect(writeErrorMessage(limit)).toBe('Concursul a atins numărul maxim de participanți.');
    const forbidden = new ApiError({ message: 'Forbidden', status: 403, code: 'forbidden' as never });
    expect(writeErrorMessage(forbidden)).toBe('Doar organizatorul concursului poate modifica participanții.');
    expect(writeErrorMessage(new Error('Serverul a refuzat.'))).toBe('Serverul a refuzat.');
    expect(writeErrorMessage(null)).toBe('A apărut o eroare. Te rugăm să încerci din nou.');
  });
  it('the CMS 500s keep their bluCode: their undiacritised message is replaced by an accented line', () => {
    const add = new ApiError({
      message: 'A aparut o eroare la inregistrarea invitatilor. Daca problema persista, contactati echipa de suport.',
      status: 500,
      code: 'server' as never,
      bluCode: 'REGISTRATION:REGISTER_GUESTS_ERROR',
    });
    expect(writeErrorMessage(add)).toBe('A apărut o eroare la adăugarea participanților. Dacă problema persistă, contactează echipa de suport.');
    const edit = new ApiError({
      message: 'A aparut o eroare la actualizarea inregistrarii. Daca problema persista, contactati echipa de suport.',
      status: 500,
      code: 'server' as never,
      bluCode: 'REGISTRATION:UPDATE_GUEST_ERROR',
    });
    expect(writeErrorMessage(edit)).toBe('A apărut o eroare la actualizarea înscrierii. Dacă problema persistă, contactează echipa de suport.');
  });
});

describe('capacityLine', () => {
  it('counts approved entries against the limit', () => {
    expect(capacityLine([{ registrationStatus: 'registered' }, { registrationStatus: 'pending' }], 30)).toBe('1 din 30');
    expect(capacityLine([], null)).toBeNull();
  });
});

describe('the writes (c11–c13): core mutations as this page uses them', () => {
  it('add POSTs /registrations/guests {data}, edit PUTs /registrations/guests/{id}; both invalidate competitions.all + my', async () => {
    for (const [factory, payload, method, path, body] of [
      [registrationGuestMutation, { competitionId: 'c1', guestName: 'Ion', teamName: '' }, 'POST', '/registrations/guests', { data: { competitionId: 'c1', guestName: 'Ion', teamName: '' } }],
      [updateRegistrationGuestMutation, { registrationId: 'r1', teamName: 'Crapii' }, 'PUT', '/registrations/guests/r1', { data: { guestName: undefined, teamName: 'Crapii' } }],
    ] as const) {
      const { transport, calls } = createFakeTransport([null]);
      const qc = new QueryClient();
      const spy = vi.spyOn(qc, 'invalidateQueries');
      const opts = factory(transport, qc);
      await (opts.mutationFn as (p: unknown) => Promise<unknown>)(payload);
      expect(calls[0]).toMatchObject({ method, path, body, auth: 'required' });
      (opts.onSettled as () => void)();
      expect(spy.mock.calls.map(c => c[0]?.queryKey)).toEqual([competitionsKeys.all, competitionsKeys.my]);
    }
  });
});
