import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { bookingKeys, deleteBlockMutation, groupBlocks, lakeBlocksQuery, type AvailabilityBlockDTO } from '@/core/booking';
import { operatorStatsKeys } from '@/core/lakes';
import { createFakeTransport } from '@/tests/transport';
import { ApiError, GENERIC_ERROR_MESSAGE } from '@/core/transport';
import {
  BLOCK_TONE_CLASS,
  blockRowView,
  blocksList,
  blockTone,
  DELETE_FALLBACK,
  deleteConfirmCopy,
  deletedToast,
  deleteFailureMessage,
  deletePartialFailureMessage,
  PAST_TITLE,
} from './model';

const block = (over: Partial<AvailabilityBlockDTO> & { documentId: string }): AvailabilityBlockDTO => ({
  startDate: '2026-11-06T00:00:00+02:00',
  endDate: '2026-11-08T00:00:00+02:00',
  reason: 'closure',
  standKey: null,
  ...over,
});

const stand = (name: string) => ({ standKey: `s-${name}`, stand: { documentId: `s-${name}`, name } });

// Friday 9 Oct 2026, 14:00 Bucharest (vitest runs with TZ=Europe/Bucharest or the formatting is local either way).
const NOW = new Date('2026-10-09T14:00:00+03:00').getTime();

describe('blockRowView (c6–c8)', () => {
  it('whole lake, whole days: last included day, «Tot lacul», no extra line', () => {
    const [row] = groupBlocks([block({ documentId: 'a' })]);
    const v = blockRowView(row!);
    expect(v.meta).toBe('Închidere · Tot lacul');
    expect(v.extra).toBeNull();
    expect(v.tone).toBe('closure');
    expect(v.count).toBe(1);
    expect(v.period).toMatch(/^Vi 6 – Sâ 7 noi$/);
  });

  it('a multi-stand save is one row, stands natural-sorted', () => {
    const rows = groupBlocks([
      block({ documentId: 'a', reason: 'maintenance', ...stand('10') }),
      block({ documentId: 'b', reason: 'maintenance', ...stand('2') }),
      block({ documentId: 'c', reason: 'maintenance', ...stand('9') }),
    ]);
    expect(rows).toHaveLength(1);
    const v = blockRowView(rows[0]!);
    expect(v.meta).toBe('Întreținere · Standurile 2, 9, 10');
    expect(v.count).toBe(3);
  });

  it('single stand + the legacy phone booking: contact · phone — note', () => {
    const [row] = groupBlocks([
      block({ documentId: 'a', reason: 'offlineReservation', contactName: 'Ion Pop', contactPhone: '0722 000 111', note: 'Vine cu barca', ...stand('4') }),
    ]);
    const v = blockRowView(row!);
    expect(v.meta).toBe('Rezervare telefonică · Standul 4');
    expect(v.extra).toBe('Ion Pop · 0722 000 111 — Vine cu barca');
    expect(v.tone).toBe('offlineReservation');
  });

  it('note only; an unknown reason keeps its name and the grey tint', () => {
    const [row] = groupBlocks([block({ documentId: 'a', reason: 'flood', note: 'Apa mare' })]);
    const v = blockRowView(row!);
    expect(v.meta).toBe('flood · Tot lacul');
    expect(v.extra).toBe('Apa mare');
    expect(v.tone).toBe('other');
  });

  it('every reason has a token tint', () => {
    for (const r of ['competition', 'closure', 'maintenance', 'offlineReservation', 'other']) {
      expect(BLOCK_TONE_CLASS[blockTone(r)].dot).toMatch(/^bg-/);
    }
  });
});

describe('blocksList (c3–c5, c11)', () => {
  const blocks = [
    block({ documentId: 'dec', startDate: '2026-12-01T06:00:00+02:00', endDate: '2026-12-01T18:00:00+02:00' }),
    block({ documentId: 'nov', startDate: '2026-11-03T06:00:00+02:00', endDate: '2026-11-03T18:00:00+02:00' }),
    // ongoing: started in September, not ended — under its START month.
    block({ documentId: 'ongoing', startDate: '2026-09-30T00:00:00+03:00', endDate: '2026-10-20T00:00:00+03:00' }),
    block({ documentId: 'past-old', startDate: '2026-08-01T06:00:00+03:00', endDate: '2026-08-01T18:00:00+03:00' }),
    block({ documentId: 'past-new', startDate: '2026-10-01T06:00:00+03:00', endDate: '2026-10-01T18:00:00+03:00' }),
  ];

  it('month sections by start, ordered by start; past hidden but counted', () => {
    const l = blocksList(blocks, NOW, false);
    expect(l.sections.map((s) => s.title)).toEqual(['Septembrie 2026', 'Noiembrie 2026', 'Decembrie 2026']);
    expect(l.sections.every((s) => !s.past)).toBe(true);
    expect(l.pastCount).toBe(2);
    expect(l.empty).toBe(false);
  });

  it('revealed: «Trecut» last, newest first', () => {
    const l = blocksList(blocks, NOW, true);
    const last = l.sections.at(-1)!;
    expect(last.title).toBe(PAST_TITLE);
    expect(last.past).toBe(true);
    expect(last.data.map((r) => r.documentIds[0])).toEqual(['past-new', 'past-old']);
  });

  it('only past blocks: empty (with the past count) until revealed', () => {
    const l = blocksList([blocks[3]!], NOW, false);
    expect(l.sections).toEqual([]);
    expect(l.pastCount).toBe(1);
    expect(l.empty).toBe(true);
    expect(blocksList([blocks[3]!], NOW, true).empty).toBe(false);
  });

  it('nothing at all is the empty state', () => {
    expect(blocksList([], NOW, true)).toEqual({ sections: [], pastCount: 0, empty: true });
  });
});

describe('delete copy (c9, c10)', () => {
  it('single vs group confirm', () => {
    expect(deleteConfirmCopy({ documentIds: ['a'], standNames: ['3'] })).toEqual({
      title: 'Șterge blocajul?',
      description: 'Această acțiune nu poate fi anulată.',
    });
    expect(deleteConfirmCopy({ documentIds: ['a', 'b'], standNames: ['3', '4'] })).toEqual({
      title: 'Șterge 2 blocaje?',
      description: 'Standurile 3, 4 — se deblochează toate.',
    });
    expect(deleteConfirmCopy({ documentIds: Array.from({ length: 21 }, (_, i) => `${i}`), standNames: [] }).title).toBe('Șterge 21 de blocaje?');
  });

  it('toasts with Romanian plurals', () => {
    expect(deletedToast(1)).toBe('Blocaj șters');
    expect(deletedToast(2)).toBe('2 blocaje șterse');
    expect(deletedToast(20)).toBe('20 de blocaje șterse');
  });

  it('failure: the server message only when it is a handled one', () => {
    expect(deleteFailureMessage(new ApiError({ message: 'Blocajul nu există.', status: 404, code: 'HTTP', bluCode: 'NOT_FOUND' }))).toBe('Blocajul nu există.');
    expect(deleteFailureMessage(new ApiError({ message: GENERIC_ERROR_MESSAGE, status: 500, code: 'HTTP' }))).toBe(DELETE_FALLBACK);
    expect(deleteFailureMessage(new Error('boom'))).toBe(DELETE_FALLBACK);
  });

  it('a group that fails part-way says how many were deleted (fish create path, blocks.tsx:83)', () => {
    const err = new ApiError({ message: GENERIC_ERROR_MESSAGE, status: 500, code: 'HTTP' });
    expect(deletePartialFailureMessage(0, 3, err)).toBe(DELETE_FALLBACK);
    expect(deletePartialFailureMessage(1, 3, err)).toBe('1 din 3 blocaje șterse. Nu am putut șterge blocajul.');
    expect(deletePartialFailureMessage(2, 2, err)).toBe('2 din 2 blocaje șterse. Nu am putut șterge blocajul.');
    expect(deletePartialFailureMessage(5, 20, new ApiError({ message: 'Blocajul nu există.', status: 404, code: 'HTTP', bluCode: 'NOT_FOUND' }))).toBe(
      '5 din 20 de blocaje șterse. Blocajul nu există.',
    );
  });
});

describe('c12 — a delete refreshes the operator surfaces', () => {
  it('invalidates bookings (blocks + availability under it) and operator stats', async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    const { transport, calls } = createFakeTransport([{ data: { documentId: 'b1' } }]);
    const m = deleteBlockMutation(transport, qc);
    await m.mutationFn!('b1', undefined as never);
    await (m.onSuccess as (...a: unknown[]) => unknown)({ documentId: 'b1' }, 'b1', undefined, undefined);
    expect(calls.map((c) => [c.method, c.path])).toEqual([['DELETE', '/feed/availability-blocks/b1']]);
    const keys = spy.mock.calls.map((c) => (c[0] as { queryKey: unknown }).queryKey);
    expect(keys).toEqual(expect.arrayContaining([bookingKeys.all, operatorStatsKeys.all]));
    // The blocks list sits under ['bookings'].
    expect(lakeBlocksQuery(transport, 'x').queryKey.slice(0, 1)).toEqual([...bookingKeys.all]);
  });
});
