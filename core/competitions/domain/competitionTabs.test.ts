import { describe, expect, it } from 'vitest';
import {
  approvedParticipantIds,
  approvedRegistrationsByStand,
  competitionProgress,
  extraScaleStand,
  extraScaleState,
  registrationCounts,
  registrationDisplayName,
  registrationTeamSubtitle,
  soloParticipant,
} from './competitionTabs';

const stand = (name: string) => ({ id: 1, documentId: `s-${name}`, name });
const reg = (status: string, standName: string | null, over: Record<string, unknown> = {}) => ({
  registrationStatus: status,
  stand: standName ? stand(standName) : null,
  teamName: null as string | null,
  guestName: null as string | null,
  club: null as { name: string } | null,
  participants: [] as { documentId: string; username: string }[],
  ...over,
});

describe('registrationCounts (fish CompetitionInfo)', () => {
  it('counts approved and pending, ignores the rest', () => {
    expect(registrationCounts([reg('registered', '1'), reg('pending', null), reg('pending', null), reg('rejected', null)])).toEqual({ approved: 1, pending: 2 });
  });
});

describe('competitionProgress (fish passedPercentage)', () => {
  const start = '2026-10-05T10:00:00Z';
  const end = '2026-10-05T20:00:00Z';
  it('is 0 before the start, 100 from the end, the rounded share between', () => {
    expect(competitionProgress(start, end, new Date('2026-10-05T09:00:00Z'))).toBe(0);
    expect(competitionProgress(start, end, new Date('2026-10-05T12:30:00Z'))).toBe(25);
    expect(competitionProgress(start, end, new Date('2026-10-05T20:00:00Z'))).toBe(100);
    expect(competitionProgress(start, end, new Date('2026-10-06T00:00:00Z'))).toBe(100);
  });
  it('treats a zero or unreadable duration as ended once started', () => {
    expect(competitionProgress(start, start, new Date('2026-10-05T10:00:00Z'))).toBe(100);
    expect(competitionProgress(start, 'x', new Date('2026-10-05T11:00:00Z'))).toBe(100);
    expect(competitionProgress('x', end, new Date())).toBe(0);
  });
});

describe('approvedRegistrationsByStand (fish sortedRegistrations)', () => {
  it('keeps approved only, unallocated first, then by stand number', () => {
    const rows = [reg('registered', '12'), reg('pending', '1'), reg('registered', '2'), reg('registered', null, { teamName: 'X' }), reg('registered', '1')];
    expect(approvedRegistrationsByStand(rows).map(r => r.stand?.name ?? '-')).toEqual(['-', '1', '2', '12']);
  });
  it('orders stands named with their sector naturally', () => {
    const rows = [reg('registered', 'A10'), reg('registered', 'B1'), reg('registered', 'A2')];
    expect(approvedRegistrationsByStand(rows).map(r => r.stand?.name)).toEqual(['A2', 'A10', 'B1']);
  });
});

describe('registrationDisplayName / registrationTeamSubtitle (fish getDisplayNames / getTeamSubtitle)', () => {
  const p = (u: string) => ({ documentId: u, username: u });
  it('individual: username, else guest name, else –', () => {
    expect(registrationDisplayName(reg('registered', '1', { participants: [p('Ana')] }), 'single')).toBe('Ana');
    expect(registrationDisplayName(reg('registered', '1', { guestName: 'Ion' }), 'single')).toBe('Ion');
    expect(registrationDisplayName(reg('registered', '1'), 'single')).toBe('–');
    expect(registrationTeamSubtitle(reg('registered', '1', { participants: [p('Ana')] }), 'single')).toBeNull();
  });
  it('team: team name, else club, else –; members (or guest name) as the subtitle', () => {
    expect(registrationDisplayName(reg('registered', '1', { teamName: ' Nada ', participants: [p('A'), p('B')] }), 'team')).toBe('Nada');
    expect(registrationDisplayName(reg('registered', '1', { teamName: '', club: { name: 'Moldova' } }), 'team')).toBe('Moldova');
    expect(registrationDisplayName(reg('registered', '1', { teamName: '' }), 'team')).toBe('–');
    expect(registrationTeamSubtitle(reg('registered', '1', { participants: [p('A'), p('B')] }), 'team')).toBe('A, B');
    expect(registrationTeamSubtitle(reg('registered', '1', { guestName: 'Echipa X' }), 'team')).toBe('Echipa X');
    expect(registrationTeamSubtitle(reg('registered', '1'), 'team')).toBeNull();
  });
});

describe('soloParticipant / approvedParticipantIds', () => {
  it('is the one user of a one-user registration only', () => {
    expect(soloParticipant({ participants: [{ documentId: 'a' }] })).toEqual({ documentId: 'a' });
    expect(soloParticipant({ participants: [{ documentId: 'a' }, { documentId: 'b' }] })).toBeNull();
    expect(soloParticipant({ participants: [] })).toBeNull();
  });
  it('collects the approved registrations’ participants', () => {
    const rows = [
      { registrationStatus: 'registered', participants: [{ documentId: 'a' }, { documentId: 'b' }] },
      { registrationStatus: 'pending', participants: [{ documentId: 'c' }] },
    ];
    expect(approvedParticipantIds(rows)).toEqual(['a', 'b']);
  });
});

describe('extraScaleState / extraScaleStand (fish ScaleItem)', () => {
  it('done = anything but new; disabled when done or the competition ended', () => {
    expect(extraScaleState({ extraStatus: 'new' }, 'started')).toEqual({ completed: false, disabled: false });
    expect(extraScaleState({ extraStatus: 'new' }, 'completed')).toEqual({ completed: false, disabled: true });
    expect(extraScaleState({ extraStatus: 'done' }, 'started')).toEqual({ completed: true, disabled: true });
    expect(extraScaleState({ extraStatus: 'cancelled' }, 'started')).toEqual({ completed: true, disabled: true });
  });
  it('needs stand name, stand id and a sector to open the stand', () => {
    const s = { id: 1, documentId: 'st', name: '3', sectors: [{ id: 2, documentId: 'sec', name: 'A' }], sectorDrawPosition: null };
    expect(extraScaleStand({ stand: s })).toEqual({ standId: 'st', standName: '3', sectorName: 'A' });
    expect(extraScaleStand({ stand: { ...s, sectors: [] } })).toBeNull();
    expect(extraScaleStand({ stand: { ...s, name: '' } })).toBeNull();
  });
});
