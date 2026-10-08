import { describe, expect, it } from 'vitest';
import {
  canAddTeammate,
  createPayload,
  findEditedRegistration,
  footerState,
  formatLine,
  isDirty,
  LOCKED_MESSAGE,
  MISSING_REGISTRATION,
  needsEmptyTeamConfirm,
  registrationsSettle,
  PHONE_LENGTH,
  PHONE_REQUIRED,
  seedKey,
  seedValues,
  submitErrorMessage,
  SUBMIT_FALLBACK_ERROR,
  TEAM_NAME_LENGTH,
  teamLimitCaption,
  thumbUrl,
  updatePayload,
  userTag,
  validate,
} from './model';

const person = (documentId: string, username = documentId) => ({
  id: 1,
  documentId,
  username,
  avatar: null,
});
const reg = (over: Partial<Parameters<typeof findEditedRegistration>[0] extends readonly (infer R)[] | undefined ? R : never> = {}) => ({
  documentId: 'r1',
  registrationStatus: 'pending',
  teamName: 'Crapii',
  author: { id: 1, documentId: 'me', username: 'Eu' },
  participants: [person('me', 'Eu'), person('mate', 'Coleg')],
  ...over,
});

describe('findEditedRegistration (c3)', () => {
  const list = [
    reg({ documentId: 'cancelled', registrationStatus: 'cancelled' }),
    reg({ documentId: 'rejected', registrationStatus: 'rejected' }),
    reg({ documentId: 'other', participants: [person('x')] }),
    reg({ documentId: 'mine', registrationStatus: 'registered' }),
  ];
  it('normal mode: the viewer’s registered / pending entry', () => {
    expect(
      findEditedRegistration(list, {
        organizerMode: false,
        viewerDocumentId: 'me',
      })?.documentId,
    ).toBe('mine');
    expect(
      findEditedRegistration(list, {
        organizerMode: false,
        viewerDocumentId: 'nobody',
      }),
    ).toBeNull();
    expect(
      findEditedRegistration(list.slice(0, 2), {
        organizerMode: false,
        viewerDocumentId: 'me',
      }),
    ).toBeNull();
  });
  it('organizer mode: the registration named in the URL, whatever its participants', () => {
    expect(
      findEditedRegistration(list, {
        organizerMode: true,
        registrationId: 'other',
        viewerDocumentId: 'me',
      })?.documentId,
    ).toBe('other');
    expect(
      findEditedRegistration(list, {
        organizerMode: true,
        registrationId: 'gone',
        viewerDocumentId: 'me',
      }),
    ).toBeNull();
  });
  it('no data yet: none', () => {
    expect(
      findEditedRegistration(undefined, {
        organizerMode: false,
        viewerDocumentId: 'me',
      }),
    ).toBeNull();
  });
});

describe('seedValues / seedKey / isDirty (c11)', () => {
  it('drops the viewer in normal mode, the author in organizer mode', () => {
    const r = reg({
      author: { id: 2, documentId: 'captain', username: 'Căpitan' },
      participants: [person('captain'), person('me'), person('mate')],
    });
    expect(
      seedValues(r, {
        organizerMode: false,
        viewerDocumentId: 'me',
        profilePhone: '0712345678',
      }),
    ).toEqual({
      participants: [
        { documentId: 'captain', username: 'captain' },
        { documentId: 'mate', username: 'mate' },
      ],
      teamName: 'Crapii',
      phone: '0712345678',
    });
    expect(
      seedValues(r, {
        organizerMode: true,
        viewerDocumentId: 'me',
      }).participants.map(p => p.documentId),
    ).toEqual(['me', 'mate']);
  });
  it('a new registration starts empty, with the profile phone', () => {
    expect(
      seedValues(null, {
        organizerMode: false,
        viewerDocumentId: 'me',
        profilePhone: null,
      }),
    ).toEqual({ participants: [], teamName: '', phone: '' });
  });
  it('the seed key follows the server data that matters', () => {
    const a = seedKey(reg(), { documentId: 'me', phone: null });
    expect(seedKey(reg(), { documentId: 'me', phone: null })).toBe(a);
    expect(seedKey(reg({ teamName: 'Alta' }), { documentId: 'me', phone: null })).not.toBe(a);
    expect(
      seedKey(reg({ participants: [person('me')] }), {
        documentId: 'me',
        phone: null,
      }),
    ).not.toBe(a);
    expect(seedKey(reg(), { documentId: 'me', phone: '0700000000' })).not.toBe(a);
  });
  it('dirty when a field or the teammate list differs', () => {
    const base = {
      teamName: 'A',
      phone: '',
      participants: [{ documentId: 'x', username: 'x' }],
    };
    expect(isDirty({ ...base }, base)).toBe(false);
    expect(isDirty({ ...base, teamName: 'B' }, base)).toBe(true);
    expect(isDirty({ ...base, participants: [] }, base)).toBe(true);
    expect(isDirty({ ...base, participants: [{ documentId: 'y', username: 'y' }] }, base)).toBe(true);
  });
});

describe('validate (c5 / c6)', () => {
  const v = (phone: string, teamName = '') => ({
    phone,
    teamName,
    participants: [],
  });
  it('phone: required, then 7–15 characters — only for a new registration', () => {
    expect(validate(v(''), { isNew: true, isTeam: false })).toEqual({
      phone: PHONE_REQUIRED,
    });
    expect(validate(v('123456'), { isNew: true, isTeam: false })).toEqual({
      phone: PHONE_LENGTH,
    });
    expect(validate(v('1'.repeat(16)), { isNew: true, isTeam: false })).toEqual({ phone: PHONE_LENGTH });
    expect(validate(v('1234567'), { isNew: true, isTeam: false })).toEqual({});
    expect(validate(v('1'.repeat(15)), { isNew: true, isTeam: false })).toEqual({});
    expect(validate(v(''), { isNew: false, isTeam: false })).toEqual({});
  });
  it('team name: at most 30, team competitions only', () => {
    expect(validate(v('0712345678', 'x'.repeat(31)), { isNew: true, isTeam: true })).toEqual({ teamName: TEAM_NAME_LENGTH });
    expect(validate(v('0712345678', 'x'.repeat(30)), { isNew: true, isTeam: true })).toEqual({});
    expect(validate(v('0712345678', 'x'.repeat(31)), { isNew: true, isTeam: false })).toEqual({});
  });
});

describe('footerState (c12 / c21)', () => {
  it('no registration → create', () => {
    expect(
      footerState({
        registration: null,
        organizerMode: false,
        competitionStatus: 'notStarted',
      }),
    ).toEqual({ kind: 'create' });
  });
  it('normal mode after the start → locked text', () => {
    expect(
      footerState({
        registration: reg(),
        organizerMode: false,
        competitionStatus: 'started',
      }),
    ).toEqual({ kind: 'locked', message: LOCKED_MESSAGE });
  });
  it('pending, notStarted → save + leave; approved → save only', () => {
    expect(
      footerState({
        registration: reg(),
        organizerMode: false,
        competitionStatus: 'notStarted',
      }),
    ).toEqual({ kind: 'update', canLeave: true });
    expect(
      footerState({
        registration: reg({ registrationStatus: 'registered' }),
        organizerMode: false,
        competitionStatus: 'notStarted',
      }),
    ).toEqual({
      kind: 'update',
      canLeave: false,
    });
  });
  it('organizer mode: never locked, never leave', () => {
    expect(
      footerState({
        registration: reg(),
        organizerMode: true,
        competitionStatus: 'started',
      }),
    ).toEqual({ kind: 'update', canLeave: false });
  });
});

describe('team rules (c7 / c8 / c13)', () => {
  it('add teammates until teammates + 1 reaches the team size', () => {
    expect(canAddTeammate(0, 3)).toBe(true);
    expect(canAddTeammate(1, 3)).toBe(true);
    expect(canAddTeammate(2, 3)).toBe(false);
    expect(canAddTeammate(0, 1)).toBe(false);
    expect(canAddTeammate(5, null)).toBe(true);
  });
  it('confirm only for a team with nobody added', () => {
    expect(needsEmptyTeamConfirm('team', 0)).toBe(true);
    expect(needsEmptyTeamConfirm('team', 1)).toBe(false);
    expect(needsEmptyTeamConfirm('single', 0)).toBe(false);
  });
  it('caption with Romanian plurals', () => {
    expect(teamLimitCaption(3)).toBe(
      'Această competiție permite înscrierea unui număr maxim de 3 participanți/echipă. Vă rugăm să adăugați un număr maxim de 2 coechipieri.',
    );
    expect(teamLimitCaption(2)).toContain('un număr maxim de 1 coechipier.');
    expect(teamLimitCaption(21)).toContain('de 21 de participanți/echipă');
  });
});

describe('payloads (c14 / c17)', () => {
  const values = {
    teamName: 'Crapii',
    phone: '0712345678',
    participants: [
      { documentId: 'a', username: 'A' },
      { documentId: 'b', username: 'B' },
    ],
  };
  it('create: teammates then the viewer; phone null when the profile has one', () => {
    expect(
      createPayload(values, {
        competitionId: 'c1',
        viewerDocumentId: 'me',
        profilePhone: '0700',
      }),
    ).toEqual({
      competition: 'c1',
      teamName: 'Crapii',
      registrationStatus: '',
      participants: ['a', 'b', 'me'],
      phone: null,
    });
    expect(
      createPayload({ ...values, participants: [] }, { competitionId: 'c1', viewerDocumentId: 'me', profilePhone: null }),
    ).toMatchObject({
      participants: ['me'],
      phone: '0712345678',
    });
  });
  it('update: teammates then the anchor; a missing registration throws fish’s message', () => {
    expect(
      updatePayload(values, {
        competitionId: 'c1',
        registrationId: 'r1',
        anchor: 'captain',
      }),
    ).toEqual({
      competition: 'c1',
      registrationId: 'r1',
      teamName: 'Crapii',
      participants: ['a', 'b', 'captain'],
    });
    expect(() =>
      updatePayload(values, {
        competitionId: 'c1',
        registrationId: null,
        anchor: 'me',
      }),
    ).toThrow(MISSING_REGISTRATION);
  });
});

describe('small helpers', () => {
  it('error text: the server’s, else fish’s fallback', () => {
    expect(submitErrorMessage(new Error('Esti deja inregistrat in aceasta competitie.'))).toBe(
      'Esti deja inregistrat in aceasta competitie.',
    );
    expect(submitErrorMessage(new Error(''))).toBe(SUBMIT_FALLBACK_ERROR);
    expect(submitErrorMessage('x')).toBe(SUBMIT_FALLBACK_ERROR);
  });
  it('picker tag and thumb', () => {
    expect(userTag({ username: 'Ion', id: 42 })).toBe('#Ion42');
    expect(thumbUrl({ url: '/o.jpg', formats: { thumbnail: { url: '/t.jpg' } } })).toBe('/t.jpg');
    expect(thumbUrl({ url: '/o.jpg', formats: null })).toBe('/o.jpg');
    expect(thumbUrl(null)).toBeNull();
  });
  it('format line', () => {
    expect(formatLine('single', 1)).toBe('Individual');
    expect(formatLine('team', 3)).toBe('Echipe · max 3/echipă');
    expect(formatLine('team', null)).toBe('Echipe');
    expect(formatLine(undefined, null)).toBeNull();
  });
});

describe('registrationsSettle — the edge copy against my-status', () => {
  it('is ok when both agree', () => {
    expect(registrationsSettle('pending', { registrationStatus: 'pending' })).toBe('ok');
    expect(registrationsSettle('registered', { registrationStatus: 'registered' })).toBe('ok');
    expect(registrationsSettle(null, null)).toBe('ok');
    expect(registrationsSettle('rejected', null)).toBe('ok');
  });
  it('is stale right after a create (status pending, no entry yet) and after a leave (no status, entry still there)', () => {
    expect(registrationsSettle('pending', null)).toBe('stale');
    expect(registrationsSettle('registered', null)).toBe('stale');
    expect(registrationsSettle(null, { registrationStatus: 'pending' })).toBe('stale');
    expect(registrationsSettle('new', { registrationStatus: 'pending' })).toBe('stale');
  });
});

describe('footerState — lockedReason', () => {
  it('locks the viewer’s own entry with the entry’s reason, never the organizer mode', () => {
    expect(
      footerState({
        registration: { registrationStatus: 'pending' },
        organizerMode: false,
        competitionStatus: 'notStarted',
        lockedReason: 'Termenul pentru înscriere a expirat',
      }),
    ).toEqual({
      kind: 'locked',
      message: 'Termenul pentru înscriere a expirat',
    });
    expect(
      footerState({
        registration: { registrationStatus: 'pending' },
        organizerMode: true,
        competitionStatus: 'notStarted',
        lockedReason: 'x',
      }),
    ).toEqual({ kind: 'update', canLeave: false });
  });
});
