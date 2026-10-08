import { describe, expect, it } from 'vitest';
import {
  addScaleItem,
  canWeigh,
  confirmTone,
  organizerMenuOptions,
  organizerRegisterItem,
  organizerSheetItems,
  penaltiesTile,
  refereeOptions,
  refereeScaleTile,
  roleOf,
  successToast,
  type OrganizerCompetition,
} from './model';

const stand = (id: string) => ({ id: 1, documentId: id, name: id });
const reg = (status: 'registered' | 'pending' | 'rejected', i: number) => ({
  id: i,
  documentId: `r${i}`,
  registrationStatus: status,
  teamName: null,
  guestName: `G${i}`,
  stand: null,
  club: null,
  author: null,
  participants: [],
});

function comp(over: Partial<OrganizerCompetition> & { userRegistrationStatus?: string | null; registrationDeadline?: string | null } = {}) {
  return {
    documentId: 'c1',
    competitionStatus: 'notStarted',
    rankingType: 'quantity',
    sectors: [{ id: 1, documentId: 'sA', name: 'A', minFishNumber: null, stands: [stand('s1'), stand('s2')] }],
    registrations: [reg('registered', 1), reg('pending', 2)],
    participantsLimit: 10,
    roundsCount: null,
    currentRound: null,
    roundStatus: null,
    userRegistrationStatus: null,
    registrationDeadline: null,
    ...over,
  } as OrganizerCompetition & { userRegistrationStatus: null; registrationDeadline: null };
}

const labels = (o: { label: string }[]) => o.map(x => x.label);
const RETURN = '/concursuri/c1';

describe('organizerMenuOptions', () => {
  it('c1 — only the author, never once completed', () => {
    expect(organizerMenuOptions({ competition: comp(), role: 'referee', allocated: {}, returnTo: RETURN })).toEqual([]);
    expect(organizerMenuOptions({ competition: comp(), role: null, allocated: {}, returnTo: RETURN })).toEqual([]);
    expect(organizerMenuOptions({ competition: comp({ competitionStatus: 'completed' }), role: 'author', allocated: {}, returnTo: RETURN })).toEqual([]);
  });

  it('c2 — before the start, in fish order, with the edit link returning here', () => {
    const opts = organizerMenuOptions({ competition: comp(), role: 'author', allocated: undefined, returnTo: RETURN });
    expect(labels(opts)).toEqual([
      'Modifică competiția',
      'Alocă standuri pe sectoare',
      'Alocă participanții pe standuri',
      'Adaugă participanți fără cont',
      'Start concurs',
      'Adaugă arbitru',
      'Șterge arbitru',
    ]);
    expect(opts[0].action).toEqual({ type: 'link', href: '/concursuri/c1/editeaza/detalii?inapoi=%2Fconcursuri%2Fc1' });
    expect(opts[1].action).toEqual({ type: 'link', href: '/concursuri/c1/sectoare' });
    expect(opts[2].action).toEqual({ type: 'link', href: '/concursuri/c1/alocare' });
    expect(opts[3].action).toEqual({ type: 'link', href: '/concursuri/c1/inscriere/fara-cont' });
    expect(opts[4].action).toEqual({ type: 'confirm', run: 'start', message: 'Ești sigur că vrei să dai start competiției?' });
  });

  it('c2 — no stands: no participants allocation; limit reached: no guests', () => {
    const c = comp({ sectors: [{ id: 1, documentId: 'sA', name: 'A', minFishNumber: null, stands: [] }], participantsLimit: 1 });
    expect(labels(organizerMenuOptions({ competition: c, role: 'author', allocated: {}, returnTo: RETURN }))).toEqual([
      'Modifică competiția',
      'Alocă standuri pe sectoare',
      'Start concurs',
      'Adaugă arbitru',
      'Șterge arbitru',
    ]);
  });

  it('c4 c5 c6 — started: cannot-edit dialog, scale only with someone seated, penalties, end', () => {
    const c = comp({ competitionStatus: 'started' });
    const seated = organizerMenuOptions({ competition: c, role: 'author', allocated: { s1: null, s2: { registrationId: 'r1' } as never }, returnTo: RETURN });
    expect(labels(seated)).toEqual(['Modifică competiția', 'Adaugă cântar', 'Adaugă arbitru', 'Șterge arbitru', 'Penalizări', 'Încheie concurs']);
    expect(seated[0].action).toEqual({ type: 'dialog', dialog: 'cannotEdit' });
    expect(seated[1].action).toEqual({ type: 'link', href: '/concursuri/c1/cantar' });
    expect(seated[4].action).toEqual({ type: 'link', href: '/concursuri/c1/penalizari' });
    expect(seated[5].action).toEqual({ type: 'confirm', run: 'end', message: 'Ești sigur că vrei să închei competiția?' });
    // Nobody seated, or not known yet: no «Adaugă cântar»; quality: no «Penalizări».
    const q = comp({ competitionStatus: 'started', rankingType: 'quality' });
    expect(labels(organizerMenuOptions({ competition: q, role: 'author', allocated: undefined, returnTo: RETURN }))).toEqual([
      'Modifică competiția',
      'Adaugă arbitru',
      'Șterge arbitru',
      'Încheie concurs',
    ]);
  });

  it('c7 — feeder legs replace «Încheie concurs»', () => {
    const base = { competitionStatus: 'started', rankingType: 'feederRounds', roundsCount: 3 } as const;
    const running = organizerMenuOptions({ competition: comp({ ...base, currentRound: 1, roundStatus: 'running' }), role: 'author', allocated: { s1: {} as never }, returnTo: RETURN });
    expect(labels(running)).toEqual(['Modifică competiția', 'Adaugă cântar', 'Adaugă arbitru', 'Șterge arbitru', 'Închide manșa 1']);
    expect(running.at(-1)!.action).toEqual({ type: 'confirm', run: 'closeRound', round: 1, message: 'Închizi manșa 1? Cântarele ei nu mai pot fi redeschise.' });
    const closed = organizerMenuOptions({ competition: comp({ ...base, currentRound: 1, roundStatus: 'closed' }), role: 'author', allocated: { s1: {} as never }, returnTo: RETURN });
    // A closed leg: no weighing can be added.
    expect(labels(closed)).toEqual(['Modifică competiția', 'Adaugă arbitru', 'Șterge arbitru', 'Reașază pentru manșa 2', 'Pornește manșa 2']);
    expect(closed[3].action).toEqual({ type: 'link', href: '/concursuri/c1/alocare?mansa=2' });
    expect(closed[4].action).toEqual({ type: 'confirm', run: 'startNext', round: 2, message: 'Pornești manșa 2? Standurile trase sunt salvate?' });
    const last = organizerMenuOptions({ competition: comp({ ...base, currentRound: 3, roundStatus: 'running' }), role: 'author', allocated: {}, returnTo: RETURN });
    expect(labels(last).at(-1)).toBe('Încheie concurs');
  });
});

describe('sheet items', () => {
  it('c12 — completed: only «Vezi cântarele din concurs» → the scale page', () => {
    const items = organizerSheetItems({ competition: comp({ competitionStatus: 'completed' }), allocated: {}, registrationHref: '/r', now: new Date() });
    expect(items).toEqual([{ key: 'vezi-cantare', label: 'Vezi cântarele din concurs', icon: 'weighings', action: { type: 'link', href: '/concursuri/c1/cantar' } }]);
  });

  it('c12 — started: every item with fish’s reasons', () => {
    const items = organizerSheetItems({ competition: comp({ competitionStatus: 'started' }), allocated: { s1: {} as never }, registrationHref: '/r', now: new Date() });
    expect(labels(items)).toEqual([
      'Înscrie-te',
      'Încheie concurs',
      'Adaugă arbitru',
      'Șterge arbitru',
      'Adaugă participanți fără cont',
      'Alocă standuri pe sectoare',
      'Alocă participanții pe standuri',
      'Adaugă cântar',
    ]);
    expect(items[0]).toMatchObject({ disabled: true, reason: 'Termenul pentru înscriere a expirat' });
    expect(items[4]).toMatchObject({ disabled: true, reason: 'Competiția a început deja, nu se mai pot face modificări' });
    expect(items[5]).toMatchObject({ disabled: true, reason: 'Competiția a început deja, nu se mai pot face modificări' });
    expect(items[6]).toMatchObject({ disabled: true, reason: 'Competiția a început deja, nu se mai pot face modificări' });
    expect(items[7]).toMatchObject({ disabled: false, reason: undefined });
  });

  it('c12 — before the start: open items; no stands / limit reached say why', () => {
    const c = comp({ sectors: [{ id: 1, documentId: 'sA', name: 'A', minFishNumber: null, stands: [] }], participantsLimit: 1 });
    const items = organizerSheetItems({ competition: c, allocated: {}, registrationHref: '/r', now: new Date('2020-01-01') });
    expect(items[0]).toMatchObject({ label: 'Înscrie-te', disabled: true, reason: 'Numărul maxim de participanți a fost atins' });
    expect(items[1]).toMatchObject({ label: 'Start concurs', action: { type: 'confirm', run: 'start' } });
    expect(items[4]).toMatchObject({ disabled: true, reason: 'Numărul maxim de participanți a fost atins' });
    expect(items[5]).toMatchObject({ disabled: false });
    expect(items[6]).toMatchObject({ disabled: true, reason: 'Te rugăm să aloci mai întâi standurile pe fiecare sector' });
    expect(items[7]).toMatchObject({ label: 'Vezi cântarele din concurs', disabled: true, reason: 'Competiția încă nu a început' });
  });

  it('register item — rejected / registered reasons, «Modifică înscrierea»', () => {
    const now = new Date('2020-01-01');
    expect(organizerRegisterItem(comp({ userRegistrationStatus: 'rejected' }), '/r', now)).toMatchObject({
      disabled: true,
      reason: 'Cererea ta de a te înscrie în această competiție a fost respinsă.',
    });
    expect(organizerRegisterItem(comp({ userRegistrationStatus: 'registered' }), '/r', now)).toMatchObject({ label: 'Modifică înscrierea', disabled: false });
    expect(organizerRegisterItem(comp({ userRegistrationStatus: 'registered', competitionStatus: 'started' }), '/r', now)).toMatchObject({
      disabled: true,
      reason: 'Nu se mai pot face modificări',
    });
  });

  it('c13 — the add-weighing item', () => {
    expect(addScaleItem(comp({ competitionStatus: 'started' }), {})).toMatchObject({ label: 'Adaugă cântar', disabled: true, reason: 'Te rugăm să aloci mai întâi participanții pe standuri' });
    expect(addScaleItem(comp({ competitionStatus: 'started' }), { s2: {} as never })).toMatchObject({ disabled: false });
    expect(addScaleItem(comp({ competitionStatus: 'completed' }), { s2: {} as never })).toMatchObject({ label: 'Vezi cântarele din concurs', disabled: false });
  });
});

describe('roles and tiles', () => {
  it('roleOf, c14 canWeigh, c11 referee tile, bara-actiuni c10 penalties tile', () => {
    expect(roleOf('author')).toBe('author');
    expect(roleOf('participant')).toBe(null);
    expect(canWeigh('referee', 'started')).toBe(true);
    expect(canWeigh('author', 'completed')).toBe(false);
    expect(canWeigh(null, 'started')).toBe(false);
    expect(refereeScaleTile('referee', 'completed')).toBe(true);
    expect(refereeScaleTile('referee', 'notStarted')).toBe(false);
    expect(penaltiesTile(null, 'quantity', 'started')).toBe(true);
    expect(penaltiesTile('referee', 'quantityQuality', 'completed')).toBe(true);
    expect(penaltiesTile('author', 'quantity', 'started')).toBe(false);
    expect(penaltiesTile(null, 'quality', 'started')).toBe(false);
    expect(penaltiesTile(null, 'quantity', 'notStarted')).toBe(false);
  });

  it('c10 — the referee remover filters by name, any case', () => {
    const refs = [
      { documentId: 'a', username: 'Ion Pop' },
      { documentId: 'b', username: 'Maria' },
    ];
    expect(refereeOptions(refs, 'pop')).toEqual([{ id: 'a', label: 'Ion Pop' }]);
    expect(refereeOptions(refs, '')).toHaveLength(2);
    expect(refereeOptions([], 'x')).toEqual([]);
  });

  it('toasts', () => {
    expect(successToast('start')).toBe('Competiția a fost începută cu succes');
    expect(successToast('end')).toBe('Competiția a fost încheiată cu succes');
    expect(successToast('closeRound', 2)).toBe('Manșa 2 a fost închisă');
    expect(successToast('startNext', 3)).toBe('Manșa 3 a început');
  });
});

describe('confirmTone (fish Alert style destructive)', () => {
  it('start, end and closing a leg confirm with the danger button; starting the next leg does not', () => {
    expect(confirmTone('start')).toBe('danger');
    expect(confirmTone('end')).toBe('danger');
    expect(confirmTone('closeRound')).toBe('danger');
    expect(confirmTone('startNext')).toBe('primary');
  });
});
