import { describe, expect, it } from 'vitest';
import {
  canRequestExtraScale,
  hasReachedParticipantsLimit,
  hasRequestedExtraScale,
  isPendingTeamEntryOfSomeoneElse,
  registrationAction,
  type RegistrationActionInput,
} from './competitionActions';

const ME = 'me';
const NOW = new Date('2026-10-05T10:00:00Z');

const entry = (status: string, author: string, participants: string[]) => ({
  registrationStatus: status as 'registered',
  author: { id: 1, documentId: author, username: author },
  participants: participants.map((p, i) => ({ id: i, documentId: p, username: p, avatar: null })),
});

const base = (over: Partial<RegistrationActionInput> = {}): RegistrationActionInput => ({
  competitionStatus: 'notStarted',
  competitionType: 'single',
  registrationDeadline: '2026-10-09T21:00:00Z',
  participantsLimit: 10,
  registrations: [],
  userRegistrationStatus: 'new',
  ...over,
});

describe('registrationAction (fish disabledInscrieTe + NormalUserSheetItems)', () => {
  it('a new viewer before the deadline may register: Înscrie-te, the form for single, the disclaimer for team', () => {
    expect(registrationAction(base(), ME, NOW)).toEqual({ label: 'Înscrie-te', disabled: false, reason: null, target: 'register' });
    expect(registrationAction(base({ competitionType: 'team' }), ME, NOW).target).toBe('teamDisclaimer');
  });

  it('pending / registered say «Modifică înscrierea» and go to the form', () => {
    const r = registrationAction(base({ competitionType: 'team', userRegistrationStatus: 'pending' }), ME, NOW);
    expect(r.label).toBe('Modifică înscrierea');
    expect(r.target).toBe('register');
  });

  it('rejected is disabled with its reason', () => {
    const r = registrationAction(base({ userRegistrationStatus: 'rejected' }), ME, NOW);
    expect(r.disabled).toBe(true);
    expect(r.reason).toBe('Cererea ta de a te înscrie în această competiție a fost respinsă.');
  });

  it('registered: editable only on a team competition before the start', () => {
    expect(registrationAction(base({ userRegistrationStatus: 'registered' }), ME, NOW)).toMatchObject({
      disabled: true,
      reason: 'Nu se mai pot face modificări',
    });
    expect(registrationAction(base({ userRegistrationStatus: 'registered', competitionType: 'team' }), ME, NOW).disabled).toBe(false);
    expect(
      registrationAction(base({ userRegistrationStatus: 'registered', competitionType: 'team', competitionStatus: 'started' }), ME, NOW),
    ).toMatchObject({ disabled: true, reason: 'Nu poți face modificări. Contactează organizatorul.' });
  });

  it('deadline passed or started: «Termenul pentru înscriere a expirat»', () => {
    expect(registrationAction(base({ registrationDeadline: '2026-10-01T00:00:00Z' }), ME, NOW)).toMatchObject({
      disabled: true,
      reason: 'Termenul pentru înscriere a expirat',
    });
    expect(registrationAction(base({ competitionStatus: 'started' }), ME, NOW).disabled).toBe(true);
    // No deadline: open until the start.
    expect(registrationAction(base({ registrationDeadline: null }), ME, NOW).disabled).toBe(false);
  });

  it('limit reached (approved entries only) beats the deadline message', () => {
    const full = base({
      participantsLimit: 1,
      registrationDeadline: '2026-10-01T00:00:00Z',
      registrations: [entry('registered', 'x', ['x']), entry('pending', 'y', ['y'])],
    });
    expect(registrationAction(full, ME, NOW)).toMatchObject({ disabled: true, reason: 'Numărul maxim de participanți a fost atins' });
  });

  it('pending on a team entry someone else filed: disabled with its reason', () => {
    const c = base({ competitionType: 'team', userRegistrationStatus: 'pending', registrations: [entry('pending', 'captain', ['captain', ME])] });
    expect(isPendingTeamEntryOfSomeoneElse(c, ME)).toBe(true);
    expect(registrationAction(c, ME, NOW)).toMatchObject({
      disabled: true,
      reason: 'Nu poți face modificări pentru că nu ești autorul înscrierii.',
    });
    // The captain may edit it.
    expect(registrationAction({ ...c, registrations: [entry('pending', ME, [ME, 'b'])] }, ME, NOW).disabled).toBe(false);
  });
});

describe('hasReachedParticipantsLimit', () => {
  it('compares the approved entries with the limit (fish ===)', () => {
    expect(hasReachedParticipantsLimit({ participantsLimit: 2, registrations: [entry('registered', 'a', ['a']), entry('registered', 'b', ['b'])] })).toBe(true);
    expect(hasReachedParticipantsLimit({ participantsLimit: null, registrations: [] })).toBe(false);
  });
});

describe('extra scale', () => {
  it('canRequestExtraScale: registered and started only', () => {
    expect(canRequestExtraScale({ competitionStatus: 'started', userRegistrationStatus: 'registered' })).toBe(true);
    expect(canRequestExtraScale({ competitionStatus: 'completed', userRegistrationStatus: 'registered' })).toBe(false);
    expect(canRequestExtraScale({ competitionStatus: 'started', userRegistrationStatus: 'pending' })).toBe(false);
  });

  it('hasRequestedExtraScale: a «new» request authored by the viewer', () => {
    const list = [
      { author: { id: 1, documentId: ME, username: 'me' }, extraStatus: 'cancelled' },
      { author: { id: 2, documentId: 'other', username: 'o' }, extraStatus: 'new' },
    ];
    expect(hasRequestedExtraScale(list, ME)).toBe(false);
    expect(hasRequestedExtraScale([...list, { author: { id: 1, documentId: ME, username: 'me' }, extraStatus: 'new' }], ME)).toBe(true);
    expect(hasRequestedExtraScale([{ author: null, extraStatus: 'new' }], ME)).toBe(false);
    expect(hasRequestedExtraScale(undefined, ME)).toBe(false);
  });
});
