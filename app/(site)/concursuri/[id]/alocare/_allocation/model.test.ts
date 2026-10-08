import { describe, expect, it } from 'vitest';
import type { CompetitionDetail, DetailRegistration } from '@/core/competitions';
import type { AllocatedParticipantsResponse } from '@/core/organizer';
import { filterOptions } from '@/components/forms/searchSelect';
import {
  allocationBlock,
  allocationsBody,
  allocationTitle,
  applySeatEdits,
  initialSeats,
  isDirty,
  legIntro,
  legRoundOf,
  occupantOf,
  optionLabel,
  orderedSectors,
  sectorStands,
  optionMembers,
  registrationOptions,
  saveErrorMessage,
  seatCounts,
  unseated,
  withSeatEdit,
} from './model';

type Shape = Pick<CompetitionDetail, 'sectors' | 'registrations' | 'competitionType'>;

const reg = (over: Partial<DetailRegistration> & { documentId: string }): DetailRegistration => ({
  id: 1,
  registrationStatus: 'registered',
  teamName: null,
  guestName: null,
  stand: null,
  club: null,
  author: null,
  participants: [],
  ...over,
});
const user = (id: number, username: string, avatar: string | null = null) => ({ id, documentId: `u${id}`, username, avatar: avatar ? { url: avatar } : null });

const sectors: CompetitionDetail['sectors'] = [
  { id: 1, documentId: 'sA', name: 'A', minFishNumber: null, stands: [{ id: 11, documentId: 'st1', name: '1' }, { id: 12, documentId: 'st2', name: '2' }] },
  { id: 2, documentId: 'sB', name: 'B', minFishNumber: null, stands: [{ id: 13, documentId: 'st3', name: '3' }] },
];

const single: Shape = {
  competitionType: 'single',
  sectors,
  registrations: [
    reg({ id: 7, documentId: 'r1', participants: [user(12, 'ion', '/a.jpg')], club: { name: 'CS Crap' } }),
    reg({ id: 8, documentId: 'r2', participants: [user(13, 'ana')] }),
    reg({ id: 9, documentId: 'r3', guestName: 'Gigel Oaspete' }),
    reg({ id: 10, documentId: 'r4', participants: [user(14, 'respins')], registrationStatus: 'rejected' }),
  ],
};

const team: Shape = {
  competitionType: 'team',
  sectors,
  registrations: [
    reg({ id: 21, documentId: 't1', teamName: 'Rechinii', club: { name: 'CS Crap' }, participants: [user(1, 'ion'), user(2, 'ana')] }),
    reg({ id: 22, documentId: 't2', teamName: null, club: { name: 'Clubul Mare' }, participants: [user(3, 'vlad')] }),
    reg({ id: 23, documentId: 't3', teamName: 'Doi Oaspeți', guestName: 'Doi Oaspeți' }),
    reg({ id: 24, documentId: 't4', teamName: null }),
  ],
};

const allocated: AllocatedParticipantsResponse = {
  st1: { participants: [{ id: 12, documentId: 'u12', name: 'ion' }], registrationId: 'r1', teamName: '', guestName: '', sectorName: 'A', sectorDrawPosition: null },
  st2: null,
  st3: { participants: [], registrationId: 'r3', teamName: '', guestName: 'Gigel Oaspete', sectorName: 'B', sectorDrawPosition: null },
};

describe('legRoundOf / title / intro (c2, c3)', () => {
  it('leg seating only for a whole N > 1', () => {
    expect(legRoundOf('2')).toBe(2);
    expect(legRoundOf(['3'])).toBe(3);
    for (const v of [undefined, null, '', '1', '0', '-2', '2.5', 'x']) expect(legRoundOf(v)).toBeNull();
  });
  it('titles and intro', () => {
    expect(allocationTitle(null)).toBe('Alocare participanți');
    expect(allocationTitle(2)).toBe('Standuri manșa 2');
    expect(legIntro(2)).toBe(
      'Introdu rezultatul tragerii la sorți pentru manșa 2: alege participantul de pe fiecare stand. Sub fiecare nume vezi unde a pescuit în manșa anterioară.',
    );
  });
});

describe('seats (c5)', () => {
  it('prefills from the allocations outside leg seating, empty in leg seating', () => {
    expect(initialSeats({ sectors }, allocated, null)).toEqual({ st1: 'r1', st2: '', st3: 'r3' });
    expect(initialSeats({ sectors }, allocated, 2)).toEqual({ st1: '', st2: '', st3: '' });
    expect(initialSeats({ sectors }, undefined, null)).toEqual({ st1: '', st2: '', st3: '' });
  });
  it('edits are a diff: undoing one leaves the page clean; a gone stand is dropped', () => {
    const initial = initialSeats({ sectors }, allocated, null);
    let edits = withSeatEdit(initial, {}, 'st2', 'r2');
    expect(applySeatEdits(initial, edits)).toEqual({ st1: 'r1', st2: 'r2', st3: 'r3' });
    expect(isDirty(initial, applySeatEdits(initial, edits))).toBe(true);
    edits = withSeatEdit(initial, edits, 'st2', '');
    expect(edits).toEqual({});
    expect(applySeatEdits(initial, { gone: 'r2' })).toEqual(initial);
  });
  it('counts seated stands over registered entrants (c9)', () => {
    expect(seatCounts(single, { st1: 'r1', st2: '', st3: 'r3' })).toEqual({ seated: 2, registered: 3 });
  });
});

describe('occupantOf (c4)', () => {
  it('single: club, then the username or the guest', () => {
    expect(occupantOf(single, 'r1')).toMatchObject({ club: 'CS Crap', team: null, people: 'ion', avatar: { src: '/a.jpg', square: false }, name: 'CS Crap, ion' });
    expect(occupantOf(single, 'r3')).toMatchObject({ club: null, people: 'Gigel Oaspete' });
    expect(occupantOf(single, '')).toBeNull();
  });
  it('team: «Echipă: participanți», a guest team not repeated', () => {
    expect(occupantOf(team, 't1')).toMatchObject({ club: 'CS Crap', team: 'Rechinii', people: 'ion, ana', avatar: { square: true } });
    expect(occupantOf(team, 't3')).toMatchObject({ team: 'Doi Oaspeți', people: null, name: 'Doi Oaspeți' });
  });
  it('falls back to the allocation for a registration the detail does not list', () => {
    expect(occupantOf(single, 'ghost', { st9: { participants: [], registrationId: 'ghost', teamName: '', guestName: 'Fantomă', clubName: 'X', sectorName: 'A', sectorDrawPosition: null } })).toMatchObject({
      club: 'X',
      people: 'Fantomă',
    });
    expect(occupantOf(single, 'ghost', {})).toBeNull();
  });
});

describe('picker options (c7)', () => {
  it('fish labels', () => {
    expect(optionLabel(single.registrations[0], 'single')).toBe('CS Crap - ion');
    expect(optionLabel(single.registrations[1], 'single')).toBe('ana');
    expect(optionLabel(single.registrations[2], 'single')).toBe('Gigel Oaspete');
    expect(optionLabel(team.registrations[0], 'team')).toBe('CS Crap - Rechinii');
    expect(optionLabel(team.registrations[1], 'team')).toBe('Clubul Mare');
    expect(optionLabel(team.registrations[2], 'team')).toBe('Doi Oaspeți');
    expect(optionLabel(team.registrations[3], 'team')).toBe('Echipa -');
    expect(optionMembers(team.registrations[0], 'team')).toBe('ion, ana');
    expect(optionMembers(team.registrations[2], 'team')).toBe('Doi Oaspeți');
    expect(optionMembers(single.registrations[0], 'single')).toBeUndefined();
  });
  it('registered only; seated disabled and last with their stand; the stand’s own marked selected', () => {
    const opts = registrationOptions(single, { st1: 'r1', st2: '', st3: '' }, 'st1');
    expect(opts.map((o) => o.id)).toEqual(['r2', 'r3', 'r1']);
    expect(opts[2]).toMatchObject({ disabled: true, disabledReason: 'Stand A1', selected: true });
    expect(opts[0]).toMatchObject({ disabled: false, selected: undefined, keywords: 'ana13' });
    expect(opts[1].keywords).toBe('Fără cont #9');
  });
  it('helper: members and the previous leg joined « · »', () => {
    const opts = registrationOptions(team, { st1: '', st2: '', st3: '' }, 'st1', { t1: 'M1: A/4', t3: 'M1: B/2' });
    expect(opts.find((o) => o.id === 't1')?.helper).toBe('ion, ana · M1: A/4');
    expect(opts.find((o) => o.id === 't3')?.helper).toBe('Doi Oaspeți · M1: B/2');
    expect(opts.find((o) => o.id === 't2')?.keywords).toBeUndefined();
  });
  it('search matches the label and the username+id or «Fără cont #id»', () => {
    const opts = registrationOptions(single, { st1: '', st2: '', st3: '' }, 'st1');
    expect(filterOptions(opts, 'crap').map((o) => o.id)).toEqual(['r1']);
    expect(filterOptions(opts, 'ion12').map((o) => o.id)).toEqual(['r1']);
    expect(filterOptions(opts, 'fara cont #9').map((o) => o.id)).toEqual(['r3']);
    expect(filterOptions(opts, 'zzz')).toEqual([]);
  });
  it('unseated: registered entrants without a stand', () => {
    expect(unseated(single, { st1: 'r1', st2: '', st3: '' }).map((u) => u.label)).toEqual(['ana', 'Gigel Oaspete']);
  });
});

describe('save (c8)', () => {
  it('sends { registrationId: standId } for filled stands only', () => {
    expect(allocationsBody({ st1: 'r1', st2: '', st3: 'r3' })).toEqual({ allocations: { r1: 'st1', r3: 'st3' } });
    expect(allocationsBody({ st1: '' })).toEqual({ allocations: {} });
  });
  it('toasts the server message, else a fallback', () => {
    expect(saveErrorMessage(new Error('Standul nu există'))).toBe('Standul nu există');
    expect(saveErrorMessage(new Error(' '))).toBe('Nu am putut salva alocarea. Încearcă din nou.');
    expect(saveErrorMessage('x')).toBe('Nu am putut salva alocarea. Încearcă din nou.');
  });
});

describe('order (web: natural «ro» by name, not the CMS order)', () => {
  const raw: CompetitionDetail['sectors'] = [
    { id: 3, documentId: 'sC', name: 'C', minFishNumber: null, stands: [{ id: 1, documentId: 'c14', name: '14' }, { id: 2, documentId: 'c11', name: '11' }] },
    { id: 1, documentId: 'sA', name: 'A', minFishNumber: null, stands: [{ id: 3, documentId: 'a10', name: '10' }, { id: 4, documentId: 'a9', name: '9' }] },
  ];
  it('sectors by name, stands by name inside, the input untouched', () => {
    expect(orderedSectors({ sectors: raw }).map((s) => [s.name, s.stands.map((st) => st.name)])).toEqual([
      ['A', ['9', '10']],
      ['C', ['11', '14']],
    ]);
    expect(raw[0].name).toBe('C');
    expect(sectorStands({ sectors: raw }).map((s) => s.standId)).toEqual(['a9', 'a10', 'c11', 'c14']);
  });
});

describe('allocationBlock (when the editor may open)', () => {
  const feeder = { rankingType: 'feederRounds', roundsCount: 3 } as const;
  it('normal allocation: only before the start', () => {
    expect(allocationBlock({ competitionStatus: 'notStarted' }, null)).toBeNull();
    for (const st of ['started', 'completed', 'cancelled', 'draft'] as const) {
      expect(allocationBlock({ competitionStatus: st }, null)).toEqual({
        title: 'Alocarea nu mai poate fi modificată',
        description: 'Competiția a început deja, nu se mai pot face modificări',
      });
    }
  });
  it('leg seating: only the leg after a closed one', () => {
    expect(allocationBlock({ ...feeder, competitionStatus: 'started', currentRound: 1, roundStatus: 'closed' }, 2)).toBeNull();
    const no = (c: Parameters<typeof allocationBlock>[0], n: number) => expect(allocationBlock(c, n)?.title).toBe(`Standurile pentru manșa ${n} nu se pot stabili acum`);
    no({ ...feeder, competitionStatus: 'started', currentRound: 1, roundStatus: 'closed' }, 3);
    no({ ...feeder, competitionStatus: 'started', currentRound: 1, roundStatus: 'closed' }, 9);
    no({ ...feeder, competitionStatus: 'started', currentRound: 2, roundStatus: 'running' }, 2);
    no({ ...feeder, competitionStatus: 'started', currentRound: 1, roundStatus: 'running' }, 2);
    no({ ...feeder, competitionStatus: 'notStarted' }, 2);
    no({ rankingType: 'standard', competitionStatus: 'started', currentRound: 1, roundStatus: 'closed' }, 2);
  });
});
