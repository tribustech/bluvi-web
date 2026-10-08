import { describe, expect, it } from 'vitest';
import { groupRevisionsBySession, type WeighingRevision } from '@/core/organizer';
import { catchText, revisionDateTime, revisionSessions, revisionTotals, sessionTitle } from './model';

const author = { id: 146, documentId: 'u', username: 'Andrew' };
const rev = (over: Partial<WeighingRevision> & Pick<WeighingRevision, 'sessionId' | 'action' | 'state' | 'createdAt'>): WeighingRevision => ({
  id: Math.floor(Math.random() * 1e6),
  documentId: `${over.action}-${over.sessionId}`,
  updatedAt: over.createdAt,
  author,
  weighing: { id: 1, documentId: 'w' },
  ...over,
});

// The local CMS's weighing x9yz… (two rounds), as the CMS returns it (createdAt ascending).
const LOG: WeighingRevision[] = [
  rev({ sessionId: 1, action: 'reopen', createdAt: '2026-03-27T09:43:57.527Z', state: { reason: 'Am adăugat greșit', catches: [] } }),
  rev({
    sessionId: 1,
    action: 'closed',
    createdAt: '2026-03-27T09:44:54.732Z',
    state: {
      added: [{ type: 'Crap Oglindă', weight: 7.775, catchId: 'a' }],
      removed: [{ type: 'Crap Oglindă', weight: 7.775, catchId: 'b' }],
      unmodified: [{ type: 'Crap', weight: 10.5, catchId: 'c' }],
    },
  }),
  rev({ sessionId: 2, action: 'reopen', createdAt: '2026-03-27T09:45:03.380Z', state: { reason: '  ', catches: [] } }),
  rev({
    sessionId: 2,
    action: 'closed',
    createdAt: '2026-03-27T09:45:13.363Z',
    state: { added: [], removed: [{ type: 'Crap', weight: 10.5, catchId: 'c' }, { type: 'Crap', weight: 10.5, catchId: 'c' }] },
  }),
];

describe('revisionSessions (fish revisions.tsx + RevisionCard)', () => {
  it('one session per round, ascending, entries in the CMS order', () => {
    const sessions = revisionSessions(groupRevisionsBySession(LOG));
    expect(sessions.map((s) => s.title)).toEqual(['Modificarea 1 [de Andrew]', 'Modificarea 2 [de Andrew]']);
    expect(sessions[0].entries.map((e) => e.kind)).toEqual(['reopen', 'closed']);
  });

  it('a reopen keeps its reason; a blank one is dropped (no empty «Motiv:»)', () => {
    const [one, two] = revisionSessions(groupRevisionsBySession(LOG));
    expect(one.entries[0]).toMatchObject({ kind: 'reopen', reason: 'Am adăugat greșit' });
    expect(two.entries[0]).toMatchObject({ kind: 'reopen', reason: null });
  });

  it('a close lists added and removed as «specie X kg», never the unmodified ones; duplicate ids keep distinct keys', () => {
    const [one, two] = revisionSessions(groupRevisionsBySession(LOG));
    expect(one.entries[1]).toMatchObject({ kind: 'closed', added: [{ text: 'Crap Oglindă 7,775 kg' }], removed: [{ text: 'Crap Oglindă 7,775 kg' }] });
    const removed = two.entries[1].kind === 'closed' ? two.entries[1].removed : [];
    expect(new Set(removed.map((r) => r.key)).size).toBe(2);
  });

  it('numeric session order, not string order (10 after 2)', () => {
    const sessions = revisionSessions({
      10: [rev({ sessionId: 10, action: 'reopen', createdAt: '2026-03-27T10:00:00Z', state: { reason: 'x' } })],
      2: [rev({ sessionId: 2, action: 'reopen', createdAt: '2026-03-27T09:00:00Z', state: { reason: 'y' } })],
    });
    expect(sessions.map((s) => s.sessionId)).toEqual([2, 10]);
  });

  it('no data / no revisions → no sessions', () => {
    expect(revisionSessions(undefined)).toEqual([]);
    expect(revisionSessions({})).toEqual([]);
  });

  it('totals', () => {
    expect(revisionTotals(revisionSessions(groupRevisionsBySession(LOG)))).toEqual({ sessions: 2, added: 1, removed: 3 });
  });
});

describe('copy', () => {
  it('a missing author drops «[de …]»', () => {
    expect(sessionTitle(3, null)).toBe('Modificarea 3');
    expect(sessionTitle(3, ' ')).toBe('Modificarea 3');
    expect(sessionTitle(3, 'Big ios')).toBe('Modificarea 3 [de Big ios]');
  });

  it('the unit is spaced, three fixed Romanian decimals — as the weighing screen lists the same catch', () => {
    expect(catchText({ type: 'Crap', weight: 10.5 })).toBe('Crap 10,500 kg');
    expect(catchText({ type: 'Amur', weight: 12 })).toBe('Amur 12,000 kg');
  });

  it('date and time in Bucharest, 24 h (summer and winter offsets)', () => {
    expect(revisionDateTime('2026-03-27T09:43:57.527Z')).toBe('27.03.2026, 11:43');
    expect(revisionDateTime('2026-09-10T07:31:03.287Z')).toBe('10.09.2026, 10:31');
    expect(revisionDateTime('2026-12-31T22:30:00Z')).toBe('01.01.2027, 00:30');
    expect(revisionDateTime('nope')).toBe('');
  });
});
