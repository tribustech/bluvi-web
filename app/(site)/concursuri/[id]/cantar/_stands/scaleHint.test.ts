import { describe, expect, it } from 'vitest';
import { canWeighCompetition } from '../../_organizer/access';
import { scaleHint } from './scaleHint';

type C = Parameters<typeof scaleHint>[0];
const individual: C = { competitionStatus: 'started', rankingType: 'quantity', currentRound: null, roundStatus: null };
const feeder = (roundStatus: 'running' | 'closed', currentRound = 1): C => ({
  competitionStatus: 'started',
  rankingType: 'feederRounds',
  currentRound,
  roundStatus,
});

describe('scaleHint', () => {
  it('promises weighing to the author / referee of a started competition only', () => {
    expect(scaleHint(individual, 'author')).toBe('Alege standul pe care îl cântărești.');
    expect(scaleHint(individual, 'referee')).toBe('Alege standul pe care îl cântărești.');
    expect(scaleHint(individual, 'participant')).toBe('Alege un stand ca să vezi cântăririle lui.');
    expect(scaleHint(individual, undefined)).toBeNull();
    expect(scaleHint({ ...individual, competitionStatus: 'notStarted' }, 'author')).toBe('Cântarul se deschide la startul concursului.');
    expect(scaleHint({ ...individual, competitionStatus: 'completed' }, 'author')).toBe('Concursul s-a încheiat: cântăririle se pot doar vedea.');
  });

  it('a running leg: the leg, then the weighing promise', () => {
    expect(scaleHint(feeder('running', 2), 'author')).toBe('Manșa 2 este în desfășurare · Alege standul pe care îl cântărești.');
  });

  it('a closed leg never promises weighing: the scale reopens with the next leg', () => {
    expect(scaleHint(feeder('closed', 1), 'author')).toBe('Manșa 1 este încheiată: cântarul se redeschide la pornirea manșei 2.');
    expect(scaleHint(feeder('closed', 3), 'referee')).toBe('Manșa 3 este încheiată: cântarul se redeschide la pornirea manșei 4.');
    expect(scaleHint(feeder('closed', 1), 'participant')).toBe('Manșa 1 este încheiată · Alege un stand ca să vezi cântăririle lui.');
  });

  it('canWeighCompetition: a closed leg is not weighable (neutral tone), a running one is', () => {
    expect(canWeighCompetition('author', feeder('closed'))).toBe(false);
    expect(canWeighCompetition('referee', feeder('closed'))).toBe(false);
    expect(canWeighCompetition('author', feeder('running'))).toBe(true);
    expect(canWeighCompetition('participant', feeder('running'))).toBe(false);
    expect(canWeighCompetition('author', individual)).toBe(true);
    // roundStatus only matters on a feeder competition.
    expect(canWeighCompetition('author', { ...individual, roundStatus: 'closed' })).toBe(true);
  });
});
