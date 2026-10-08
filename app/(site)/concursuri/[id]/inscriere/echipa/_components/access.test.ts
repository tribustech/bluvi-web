import { describe, expect, it } from 'vitest';
import { competitionFacts, disclaimerAccess } from './access';

const NOW = new Date('2026-10-08T09:00:00Z');
const ME = 'viewer';
type Input = Parameters<typeof disclaimerAccess>[0];
const open: Input = {
  competitionStatus: 'notStarted',
  competitionType: 'team',
  registrationDeadline: '2099-01-01T00:00:00.000Z',
  participantsLimit: 30,
  registrations: [],
  userRegistrationStatus: null,
};

describe('team disclaimer access (c6)', () => {
  it('a new entry on an open team competition: the disclaimer', () => {
    expect(disclaimerAccess(open, ME, NOW)).toEqual({ kind: 'show' });
  });
  it('a single competition, a pending / approved entry: on to the form', () => {
    expect(disclaimerAccess({ ...open, competitionType: 'single' }, ME, NOW)).toEqual({ kind: 'sendOn' });
    expect(disclaimerAccess({ ...open, userRegistrationStatus: 'pending' }, ME, NOW)).toEqual({ kind: 'sendOn' });
    expect(disclaimerAccess({ ...open, userRegistrationStatus: 'registered' }, ME, NOW)).toEqual({ kind: 'sendOn' });
  });
  it('rejected, deadline passed, limit reached, started: closed with fish copy', () => {
    expect(disclaimerAccess({ ...open, userRegistrationStatus: 'rejected' }, ME, NOW)).toEqual({
      kind: 'closed',
      title: 'Înscrierea nu este disponibilă',
      reason: 'Cererea ta de a te înscrie în această competiție a fost respinsă.',
    });
    expect(disclaimerAccess({ ...open, registrationDeadline: '2026-10-08T08:00:00Z' }, ME, NOW)).toMatchObject({
      kind: 'closed',
      reason: 'Termenul pentru înscriere a expirat',
    });
    const full = { ...open, participantsLimit: 1, registrations: [{ registrationStatus: 'registered', author: null, participants: [] }] } as Input;
    expect(disclaimerAccess(full, ME, NOW)).toMatchObject({ kind: 'closed', reason: 'Numărul maxim de participanți a fost atins' });
    expect(disclaimerAccess({ ...open, competitionStatus: 'started' }, ME, NOW)).toMatchObject({ kind: 'closed' });
  });
  it('an approved team entry once started: closed, worded as an edit', () => {
    expect(disclaimerAccess({ ...open, competitionStatus: 'started', userRegistrationStatus: 'registered' }, ME, NOW)).toEqual({
      kind: 'closed',
      title: 'Înscrierea nu mai poate fi modificată',
      reason: 'Nu poți face modificări. Contactează organizatorul.',
    });
  });
  it('draft, completed, cancelled: closed', () => {
    expect(disclaimerAccess({ ...open, competitionStatus: 'cancelled' }, ME, NOW)).toMatchObject({ kind: 'closed', reason: 'Concursul a fost anulat.' });
    expect(disclaimerAccess({ ...open, competitionStatus: 'completed' }, ME, NOW)).toMatchObject({ kind: 'closed' });
    expect(disclaimerAccess({ ...open, competitionStatus: 'draft' }, ME, NOW)).toMatchObject({ kind: 'closed' });
  });
});

const base = {
  lake: { name: 'Iaz Suharau' },
  startDate: '2026-10-10T05:00:00.000Z',
  endDate: '2026-10-11T12:00:00.000Z',
  teamParticipants: 3,
} as Parameters<typeof competitionFacts>[0];

describe('team disclaimer facts', () => {
  it('lake, dates, team size', () => {
    expect(competitionFacts(base, NOW)).toEqual([
      { label: 'Baltă', value: 'Iaz Suharau' },
      { label: 'Perioada', value: 'sâm, 10 - dum, 11 oct' },
      { label: 'Echipa', value: 'până la 3 pescari' },
    ]);
  });
  it('leaves out what is not known (rule 4) and a team size of one; «de» from 20', () => {
    expect(competitionFacts({ ...base, lake: null, startDate: 'x', teamParticipants: 1 }, NOW)).toEqual([]);
    expect(competitionFacts({ ...base, lake: null, startDate: 'x', teamParticipants: 20 }, NOW)).toEqual([
      { label: 'Echipa', value: 'până la 20 de pescari' },
    ]);
  });
});
