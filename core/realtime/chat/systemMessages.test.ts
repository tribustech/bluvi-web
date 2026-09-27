import { describe, expect, it } from 'vitest';
import {
  systemIconFor,
  systemLinkLabel,
  isVisibleInRoom,
  podiumInfoOf,
  systemBodyFor,
  systemPartsFor,
} from './systemMessages';

describe('systemIconFor', () => {
  it('maps known events and falls back to info', () => {
    expect(systemIconFor('competition:start')).toBe('flag');
    expect(systemIconFor('competition:end')).toBe('flag');
    expect(systemIconFor('competition:participants-allocation')).toBe('pin');
    expect(systemIconFor('competition:weighing-end')).toBe('scale');
    expect(systemIconFor('competition:weighing-modified')).toBe('scale');
    expect(systemIconFor('competition:extra-request')).toBe('scale');
    expect(systemIconFor('competition:podium')).toBe('trophy');
    expect(systemIconFor('competition:penalty')).toBe('warning');
    expect(systemIconFor('registration:registered')).toBe('user');
    expect(systemIconFor('registration:cancelled')).toBe('user');
    expect(systemIconFor('chat:closing')).toBe('lock');
    expect(systemIconFor('chat:closed')).toBe('lock');
    expect(systemIconFor('something:new')).toBe('info');
    expect(systemIconFor(undefined)).toBe('info');
  });
});

describe('systemLinkLabel', () => {
  it('labels every tappable link kind and returns null for the rest', () => {
    expect(systemLinkLabel({ kind: 'ranking' })).toBe('Vezi clasamentul');
    expect(systemLinkLabel({ kind: 'allocation' })).toBe('Vezi alocarea');
    expect(systemLinkLabel({ kind: 'registrations' })).toBe('Vezi participanții');
    expect(systemLinkLabel({ kind: 'penalties' })).toBe('Vezi penalizările');
    expect(systemLinkLabel({ kind: 'weighing', id: 'w1', params: { standId: 's1', standName: 'A1' } })).toBe(
      'Vezi cântărirea'
    );
    expect(systemLinkLabel({ kind: 'weighing' })).toBeNull();
    expect(systemLinkLabel({ kind: 'nope' })).toBeNull();
    expect(systemLinkLabel(undefined)).toBeNull();
  });
});

describe('systemBodyFor', () => {
  it('drops the copy emoji the icon replaces', () => {
    expect(systemBodyFor('⚖️ A1 · Andrei: 2 pești, 12,450 kg.')).toBe('A1 · Andrei: 2 pești, 12,450 kg.');
    expect(systemBodyFor('🏁 Concursul a început.')).toBe('Concursul a început.');
    expect(systemBodyFor('Fără emoji.')).toBe('Fără emoji.');
    expect(systemBodyFor(undefined)).toBe('');
  });
});

describe('isVisibleInRoom', () => {
  it('General shows everything', () => {
    expect(isVisibleInRoom({ type: 'system', event: 'competition:podium' }, 'general')).toBe(true);
  });
  it('Participanți shows people and only the closing notices', () => {
    expect(isVisibleInRoom({ type: 'text' }, 'participants')).toBe(true);
    expect(isVisibleInRoom({ type: 'system', event: 'competition:weighing-end' }, 'participants')).toBe(false);
    expect(isVisibleInRoom({ type: 'system', event: 'registration:registered' }, 'participants')).toBe(false);
    expect(isVisibleInRoom({ type: 'system' }, 'participants')).toBe(false);
    expect(isVisibleInRoom({ type: 'system', event: 'chat:closing' }, 'participants')).toBe(true);
  });
});

describe('podiumInfoOf', () => {
  it('prefers the structured data', () => {
    expect(podiumInfoOf({ event: 'competition:podium', text: 'x', data: { place: 1, team: 'F6 · Ana Dinu' } })).toEqual(
      { place: 1, stand: 'F6', name: 'Ana Dinu' }
    );
  });
  it('reads older copy, with or without the weight', () => {
    expect(
      podiumInfoOf({ event: 'competition:podium', text: '🥇 F6 · Ana Dinu urcă pe locul 1 cu 18,300 kg.' })
    ).toEqual({
      place: 1,
      stand: 'F6',
      name: 'Ana Dinu',
    });
    expect(podiumInfoOf({ event: 'competition:podium', text: 'F1 · Florin trece pe locul 2 cu 36,628 kg.' })).toEqual({
      place: 2,
      stand: 'F1',
      name: 'Florin',
    });
    expect(podiumInfoOf({ event: 'competition:podium', text: '🥉 Echipa Nord urcă pe locul 3.' })).toEqual({
      place: 3,
      stand: null,
      name: 'Echipa Nord',
    });
  });
  it('null for other events or copy without a place', () => {
    expect(podiumInfoOf({ event: 'competition:weighing-end', text: 'urcă pe locul 1' })).toBeNull();
    expect(podiumInfoOf({ event: 'competition:podium', text: 'ceva' })).toBeNull();
  });
});

describe('systemPartsFor', () => {
  const parts = (event: string, text: string, data?: Record<string, string | number>) =>
    systemPartsFor({ event, text, data });
  it('weighing: stand, name and the catch', () => {
    expect(parts('competition:weighing-end', '⚖️ A1 · Andrei Popescu: 2 pești, 12,450 kg.')).toEqual({
      stand: 'A1',
      name: 'Andrei Popescu',
      detail: 'Cântar · 2 pești, 12,450 kg',
    });
  });
  it('structured data wins over the copy', () => {
    expect(
      parts('competition:weighing-end', '⚖️ S3/12 · Nord: 1 pește, 2,000 kg.', { stand: 'S3/12', name: 'Echipa Nord' })
    ).toEqual({ stand: 'S3/12', name: 'Echipa Nord', detail: 'Cântar · 1 pește, 2,000 kg' });
  });
  it('penalties, all three actions', () => {
    expect(parts('competition:penalty', '⚠️ D4 · Dan: penalizare 1 kg, nadă.')).toEqual({
      stand: 'D4',
      name: 'Dan',
      detail: 'Penalizare 1 kg, nadă',
    });
    expect(parts('competition:penalty', '⚠️ Avertisment pentru B3 · Ion: gălăgie.')).toEqual({
      stand: 'B3',
      name: 'Ion',
      detail: 'Avertisment · gălăgie',
    });
    expect(parts('competition:penalty', '⛔ Eliminare B3: fraudă.')).toEqual({
      name: 'B3',
      detail: 'Eliminare · fraudă',
    });
  });
  it('podium, sign-ups and stand-only events', () => {
    expect(parts('competition:podium', '🥈 F6 · Ana urcă pe locul 2.')).toEqual({
      stand: 'F6',
      name: 'Ana',
      detail: 'Urcă pe locul 2',
    });
    expect(parts('registration:registered', '👤 Mihai Ionescu s-a înscris.')).toEqual({
      name: 'Mihai Ionescu',
      detail: 'S-a înscris',
    });
    expect(parts('registration:cancelled', '👤 Ion a renunțat.')).toEqual({ name: 'Ion', detail: 'A renunțat' });
    expect(parts('competition:weighing-modified', '⚖️ Cântarul de la E5 a fost modificat.')).toEqual({
      stand: 'E5',
      detail: 'Cântar modificat',
    });
    expect(parts('competition:extra-request', '⚖️ E5 a cerut cântar extra.')).toEqual({
      stand: 'E5',
      detail: 'A cerut cântar extra',
    });
  });
  it('anything else is shown whole', () => {
    expect(parts('competition:start', '🏁 Concursul a început. Succes tuturor!')).toEqual({
      name: 'Concursul a început. Succes tuturor!',
    });
    expect(parts('competition:weighing-end', 'format necunoscut')).toEqual({ name: 'format necunoscut' });
  });
});
