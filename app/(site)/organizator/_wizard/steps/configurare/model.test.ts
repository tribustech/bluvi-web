import { describe, expect, it } from 'vitest';
import { createCompetitionSchema } from '@/core/organizer';
import { digitsOnly, sortCompetitionSpecies, toggleSpecies } from './model';

const sp = (Name: string, competitionPriority?: number | null) => ({ Name, competitionPriority });

describe('organizer.step-config model', () => {
  it('c5: priority first (ascending), then the rest; ties and the rest by Romanian name', () => {
    const out = sortCompetitionSpecies([sp('Știucă'), sp('Amur', 3), sp('Biban'), sp('Crap oglindă', 2), sp('Șalău'), sp('Crap', 1), sp('Somn', 2), sp('Țipar', null)]);
    expect(out.map(s => s.Name)).toEqual(['Crap', 'Crap oglindă', 'Somn', 'Amur', 'Biban', 'Șalău', 'Știucă', 'Țipar']);
  });

  it('c5: nothing to sort → empty (the section is hidden)', () => {
    expect(sortCompetitionSpecies(undefined)).toEqual([]);
    expect(sortCompetitionSpecies([])).toEqual([]);
  });

  it('c3/c4: digits only', () => {
    expect(digitsOnly('1a2 -3,5')).toBe('1235');
    expect(digitsOnly('ex')).toBe('');
  });

  it('c6: toggling adds at the end and removes', () => {
    expect(toggleSpecies(undefined, 'a')).toEqual(['a']);
    expect(toggleSpecies(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleSpecies(['a', 'b'], 'a')).toEqual(['b']);
  });

  it('c3/c4: the schema messages the step shows', () => {
    const base = { name: 'Cupa' };
    const msg = (v: Record<string, string>) => createCompetitionSchema.safeParse({ ...base, ...v }).error?.issues[0]?.message;
    expect(msg({ teamParticipants: '0' })).toBe('Participanți per echipă trebuie să fie între 1 și 10.');
    expect(msg({ teamParticipants: '11' })).toBe('Participanți per echipă trebuie să fie între 1 și 10.');
    expect(msg({ teamParticipants: '10' })).toBeUndefined();
    expect(msg({ participantsLimit: '0' })).toBe('Capacitatea trebuie să fie cel puțin 1.');
    expect(msg({ participantsLimit: '' })).toBeUndefined();
  });
});
