import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { createFakeTransport } from '@/tests/transport';
import { allocateFeederRound, closeFeederRound, startNextFeederRound } from '../competitions/api';
import { formatStandLabel } from './domain/weighing';
import {
  allocateFeederRoundMutation,
  closeFeederRoundMutation,
  invalidateLegState,
  startNextFeederRoundMutation,
} from './mutations';

/*
 * Feeder legs («manșe»): fish services/api/competitions.ts:160-185 + mutations/useFeederRounds.ts,
 * and fish helpers/formatStandLabel.ts. Writes are only ever called against a fake transport.
 */

describe('feeder leg api', () => {
  it('closeFeederRound POSTs /feed/competitions/:id/rounds/close as the user', async () => {
    const { transport, calls } = createFakeTransport([{ data: { currentRound: 1, roundStatus: 'closed' } }]);
    await expect(closeFeederRound(transport, 'c 1')).resolves.toEqual({ data: { currentRound: 1, roundStatus: 'closed' } });
    expect(calls).toEqual([{ method: 'POST', path: '/feed/competitions/c%201/rounds/close', auth: 'required' }]);
  });

  it('allocateFeederRound PUTs the registration → stand map for the leg', async () => {
    const { transport, calls } = createFakeTransport([{ data: { round: 2, allocated: 2 } }]);
    const allocations = { r1: 's1', r2: 's2' };
    await expect(allocateFeederRound(transport, { competitionId: 'c1', round: 2, allocations })).resolves.toEqual({
      data: { round: 2, allocated: 2 },
    });
    expect(calls).toEqual([
      { method: 'PUT', path: '/feed/competitions/c1/rounds/2/allocation', body: { allocations }, auth: 'required' },
    ]);
  });

  it('startNextFeederRound POSTs /feed/competitions/:id/rounds/start as the user', async () => {
    const { transport, calls } = createFakeTransport([{ data: { currentRound: 2, roundStatus: 'running' } }]);
    await startNextFeederRound(transport, 'c1');
    expect(calls).toEqual([{ method: 'POST', path: '/feed/competitions/c1/rounds/start', auth: 'required' }]);
  });

  it('a body that breaks the contract is an error', async () => {
    const { transport } = createFakeTransport([{ data: { currentRound: 'x' } }]);
    await expect(closeFeederRound(transport, 'c1')).rejects.toThrow();
  });
});

describe('feeder leg mutations (fish invalidateLegState)', () => {
  const run = async (options: object, qc: QueryClient, v: unknown) =>
    qc.getMutationCache().build(qc, options as never).execute(v as never);

  /** What every leg action must refresh, plus two keys it must leave alone. */
  const seed = () => {
    const qc = new QueryClient();
    const touched = [
      ['competitions', 'c1'],
      ['competitions', 'c1', 'allocated-participants'],
      ['rankings', 'c1'],
      ['weighings', 'competition', 'c1'],
      ['weighings', 'competition', 'c1', 'stand', 's1'],
      ['weighings', 'competition', 'c1', 'summary'],
      ['competitions', 'c1', 'active-weighing'],
    ];
    const untouched = [['competitions', 'c2'], ['weighings', 'competition', 'c2']];
    [...touched, ...untouched].forEach(k => qc.setQueryData(k, 1));
    const state = () => ({
      touched: touched.map(k => qc.getQueryState(k)?.isInvalidated),
      untouched: untouched.map(k => qc.getQueryState(k)?.isInvalidated),
    });
    return { qc, state };
  };
  const expectLegState = (s: { touched: (boolean | undefined)[]; untouched: (boolean | undefined)[] }) => {
    expect(s.touched.every(Boolean)).toBe(true);
    expect(s.untouched.some(Boolean)).toBe(false);
  };

  it('invalidateLegState refreshes the competition, its seating, ranking, weighings and active weighing', () => {
    const { qc, state } = seed();
    invalidateLegState(qc, 'c1');
    expectLegState(state());
  });

  it('close refreshes the leg state on success', async () => {
    const { qc, state } = seed();
    const { transport } = createFakeTransport([{ data: { currentRound: 1, roundStatus: 'closed' } }]);
    await run(closeFeederRoundMutation(transport, qc), qc, 'c1');
    expectLegState(state());
  });

  it('allocate refreshes the leg state even when the server refuses (onSettled)', async () => {
    const { qc, state } = seed();
    const transport = {
      request: async () => {
        throw new Error('Manșa a fost deja actualizată între timp. Reîncarcă ecranul.');
      },
    };
    await expect(
      run(allocateFeederRoundMutation(transport, qc), qc, { competitionId: 'c1', round: 2, allocations: { r1: 's1' } })
    ).rejects.toThrow('Manșa a fost deja actualizată');
    expectLegState(state());
  });

  it('start next refreshes the leg state', async () => {
    const { qc, state } = seed();
    const { transport, calls } = createFakeTransport([{ data: { currentRound: 2, roundStatus: 'running' } }]);
    await run(startNextFeederRoundMutation(transport, qc), qc, 'c1');
    expect(calls[0].path).toBe('/feed/competitions/c1/rounds/start');
    expectLegState(state());
  });
});

describe('formatStandLabel (fish helpers/formatStandLabel.ts)', () => {
  it('NC: the national format with the draw position', () => {
    expect(formatStandLabel(true, 'A', 1, '10')).toBe('Stand A1(10)');
    expect(formatStandLabel(true, 'Sector B', null, 7)).toBe('Stand B7');
  });
  it('otherwise sector and stand', () => {
    expect(formatStandLabel(false, 'A', 1, '10')).toBe('Sector A, Stand 10');
    expect(formatStandLabel(false, 'C', null, null)).toBe('Sector C, Stand ');
  });
});
