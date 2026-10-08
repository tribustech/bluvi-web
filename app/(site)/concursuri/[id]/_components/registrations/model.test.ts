import { describe, expect, it } from 'vitest';
import type { Registration } from '@/core/competitions';
import { ApiError, networkError } from '@/core/transport';
import {
  STATUS_ERROR_RETRY,
  accountParticipantIds,
  confirmOf,
  editHref,
  filterCounts,
  filterFromParam,
  matchesFilter,
  paramOfFilter,
  phoneHref,
  refreshKeys,
  registrationName,
  rowActions,
  sortRegistrations,
  statusErrorMessage,
  statusText,
  toDetailRegistration,
} from './model';

const reg = (documentId: string, registrationStatus: string, stand: string | null, over: Partial<Registration> = {}): Registration => ({
  id: 1,
  documentId,
  registrationStatus,
  teamName: null,
  guestName: null,
  participants: [],
  stand: stand ? { id: 1, documentId: `s-${stand}`, name: stand } : null,
  ...over,
});
const user = (documentId: string, username: string | null) => ({ id: 1, documentId, username, avatar: null });

describe('filters (fish RegistrationsList FilterKey ↔ ?filtru=)', () => {
  it('reads the URL, default Toți', () => {
    expect(filterFromParam('in-asteptare')).toBe('pending');
    expect(filterFromParam('aprobati')).toBe('registered');
    expect(filterFromParam('respinsi')).toBe('rejected');
    expect(filterFromParam(null)).toBe('all');
    expect(filterFromParam('pending')).toBe('all');
  });
  it('writes the URL (Toți has no param)', () => {
    expect(paramOfFilter('all')).toBeUndefined();
    expect(paramOfFilter('pending')).toBe('in-asteptare');
    expect(paramOfFilter('registered')).toBe('aprobati');
    expect(paramOfFilter('rejected')).toBe('respinsi');
  });
  it('counts per status; Toți counts every registration', () => {
    const list = [reg('a', 'pending', null), reg('b', 'registered', '1'), reg('c', 'rejected', null), reg('d', 'cancelled', null)];
    expect(filterCounts(list)).toEqual({ all: 4, registered: 1, pending: 1, rejected: 1 });
    expect(list.filter(r => matchesFilter(r, 'all'))).toHaveLength(4);
    expect(list.filter(r => matchesFilter(r, 'pending')).map(r => r.documentId)).toEqual(['a']);
  });
});

describe('sortRegistrations (fish sortedRegistrations)', () => {
  it('unallocated first, by stand naturally, unallocated rejected last', () => {
    const list = [reg('r', 'rejected', null), reg('s10', 'registered', '10'), reg('u', 'pending', null), reg('s2', 'registered', '2'), reg('rs', 'rejected', '5')];
    expect(sortRegistrations(list).map(r => r.documentId)).toEqual(['u', 's2', 'rs', 's10', 'r']);
  });
  it('sector-named stands compare naturally (A2 before A10)', () => {
    expect(sortRegistrations([reg('x', 'registered', 'A10'), reg('y', 'registered', 'A2')]).map(r => r.documentId)).toEqual(['y', 'x']);
  });
});

describe('registrationName (fish ParticipantName)', () => {
  it('individual: username, guest name, else «Cont șters»', () => {
    expect(registrationName(reg('a', 'pending', null, { participants: [user('u', 'Ion')] }), 'single')).toEqual({ name: 'Ion', members: null });
    expect(registrationName(reg('a', 'pending', null, { guestName: 'Gigel' }), 'single').name).toBe('Gigel');
    expect(registrationName(reg('a', 'pending', null), 'single').name).toBe('Cont șters');
  });
  it('team: «Echipa: X» + members; no team name → the members; nothing → «–»', () => {
    expect(registrationName(reg('a', 'pending', null, { teamName: 'Crapii', participants: [user('1', 'Ion'), user('2', 'Ana')] }), 'team')).toEqual({
      name: 'Echipa: Crapii',
      members: 'Ion, Ana',
    });
    expect(registrationName(reg('a', 'pending', null, { teamName: 'Crapii', guestName: 'Ion si Ana' }), 'team')).toEqual({ name: 'Echipa: Crapii', members: 'Ion si Ana' });
    expect(registrationName(reg('a', 'pending', null, { participants: [user('1', 'Ion'), user('2', null)] }), 'team')).toEqual({ name: 'Ion, Cont șters', members: null });
    expect(registrationName(reg('a', 'pending', null), 'team').name).toBe('–');
  });
});

describe('row actions (fish CollapsableActions)', () => {
  it('before the start: every status action the status allows, in fish order', () => {
    expect(rowActions('notStarted', 'pending')).toEqual({ edit: true, call: true, status: ['reject', 'approve'] });
    expect(rowActions('notStarted', 'registered')).toEqual({ edit: true, call: true, status: ['pending', 'reject'] });
    expect(rowActions('notStarted', 'rejected')).toEqual({ edit: false, call: true, status: ['pending', 'approve'] });
  });
  it('started: edit + call only; completed / cancelled: call only', () => {
    expect(rowActions('started', 'registered')).toEqual({ edit: true, call: true, status: [] });
    expect(rowActions('completed', 'registered')).toEqual({ edit: false, call: true, status: [] });
    expect(rowActions('cancelled', 'pending')).toEqual({ edit: false, call: true, status: [] });
  });
  it('the confirmations carry fish copy', () => {
    expect(confirmOf('pending', 'registered')).toMatchObject({ title: 'Mută în lista de așteptare', confirm: 'Mută' });
    expect(confirmOf('reject', 'registered')).toMatchObject({ label: 'Elimină', question: 'Ești sigur că vrei să elimini participantul?' });
    expect(confirmOf('reject', 'pending')).toMatchObject({ label: 'Respinge', question: 'Ești sigur că vrei să respingi cererea de participare la concurs?' });
    expect(confirmOf('approve', 'pending')).toMatchObject({ title: 'Acceptă înregistrarea', confirm: 'Acceptă' });
  });
});

describe('links', () => {
  it('Editează: guests → the guests form, accounts → the registration form in organizer mode', () => {
    expect(editHref('c1', reg('g', 'pending', null, { guestName: 'Gigel' }))).toBe('/concursuri/c1/inscriere/fara-cont?inscriere=g');
    expect(editHref('c1', reg('a', 'pending', null, { participants: [user('u', 'Ion')] }))).toBe('/concursuri/c1/inscriere?organizator=1&inscriere=a');
  });
  it('Apelează: tel: of the author, null without a phone', () => {
    expect(phoneHref({ author: { id: 1, documentId: 'a', phone: '+40 712 345 678' } })).toBe('tel:+40712345678');
    expect(phoneHref({ author: { id: 1, documentId: 'a', phone: null } })).toBeNull();
    expect(phoneHref({ author: null })).toBeNull();
  });
});

describe('statusText / toDetailRegistration', () => {
  it('words for the three statuses, none for others', () => {
    expect(statusText('pending')?.label).toBe('În așteptare');
    expect(statusText('registered')?.label).toBe('Aprobat');
    expect(statusText('rejected')?.label).toBe('Respins');
    expect(statusText('cancelled')).toBeNull();
  });
  it('maps a list row onto the popover shape', () => {
    const d = toDetailRegistration(reg('a', 'pending', '3', { participants: [user('u', null)] }));
    expect(d.participants[0]).toEqual({ id: 1, documentId: 'u', username: 'Cont șters', avatar: null });
    expect(d.guestName).toBeNull();
  });
});

describe('refreshKeys (fish onRefresh + refreshActionSheetQueries)', () => {
  it('the list, the competition, the statute, the allocations', () => {
    expect(refreshKeys('c1')).toEqual([
      ['competitions', 'c1', 'registrations'],
      ['competitions', 'c1'],
      expect.arrayContaining(['c1']),
      expect.arrayContaining(['c1']),
    ]);
    expect(JSON.stringify(refreshKeys('c1')[2])).toMatch(/statute/i);
    expect(JSON.stringify(refreshKeys('c1')[3])).toMatch(/allocat/i);
  });
});

describe('statusErrorMessage (fish showErrorToast(err.message))', () => {
  const http = (status: number, message: string, bluCode?: string) => new ApiError({ status, message, code: 'HTTP', bluCode });
  it('maps the CMS refusals to Romanian with diacritics', () => {
    expect(statusErrorMessage(http(400, 'Numarul maxim de participanti a fost atins.', 'REGISTRATION:PARTICIPANTS_LIMIT_EXCEEDED'))).toBe('Numărul maxim de participanți a fost atins.');
    expect(statusErrorMessage(http(400, 'Numarul de participanti depaseste limita de participanti pentru o echipa.', 'REGISTRATION:PARTICIPANTS_LIMIT_EXCEEDED'))).toBe('Echipa are mai mulți membri decât permite concursul.');
    expect(statusErrorMessage(http(400, 'x', 'REGISTRATION:COMPETITION_STATUS_NOT_STARTED'))).toBe('Concursul a început; înscrierile nu mai pot fi schimbate.');
    expect(statusErrorMessage(http(400, 'x', 'REGISTRATION:CANNOT_REJECT_WHEN_CANCELLED_BY_USER'))).toBe('Nu poți respinge o cerere anulată de participant.');
  });
  it('another 4xx: the CMS message; 5xx, network, non-ApiError: try again', () => {
    expect(statusErrorMessage(http(400, 'Altceva.', 'REGISTRATION:NEW'))).toBe('Altceva.');
    expect(statusErrorMessage(http(500, 'boom', 'REGISTRATION:ACCEPT_REGISTRATION_ERROR'))).toBe(STATUS_ERROR_RETRY);
    expect(statusErrorMessage(networkError('/x', new Error('offline')))).toBe(STATUS_ERROR_RETRY);
    expect(statusErrorMessage(new Error('x'))).toBe(STATUS_ERROR_RETRY);
  });
});

describe('accountParticipantIds', () => {
  it('every account, whatever the status, once', () => {
    const regs = [
      reg('a', 'pending', null, { participants: [user('u1', 'A')] }),
      reg('b', 'rejected', null, { participants: [user('u2', 'B'), user('u1', 'A')] }),
      reg('c', 'registered', '1', { guestName: 'Oaspete' }),
    ];
    expect(accountParticipantIds(regs)).toEqual(['u1', 'u2']);
  });
});
