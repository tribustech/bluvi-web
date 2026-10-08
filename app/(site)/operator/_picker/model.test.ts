import { describe, expect, it } from 'vitest';
import { formatLeiAmount, LAKE_COVER_FALLBACK, lakeCardStats, lakeCover, pickerView } from './model';
import { panelBack } from '../_shared/back';
import { isServerFailure } from '../_shared/route-error';

const lake = (id: string, extra: Record<string, unknown> = {}) => ({ documentId: id, name: `Lac ${id}`, ...extra });

describe('operator.alege-balta pickerView', () => {
  it('c2: loading while the first read is pending', () => {
    expect(pickerView({ data: undefined, isPending: true, error: null })).toEqual({ kind: 'loading' });
  });

  it('c3: error only when nothing is cached', () => {
    const error = new Error('x');
    expect(pickerView({ data: undefined, isPending: false, error })).toEqual({ kind: 'error', error });
    // A failed refetch keeps the data on screen.
    expect(pickerView({ data: [lake('a'), lake('b')], isPending: false, error }).kind).toBe('list');
  });

  it('c4: exactly one lake → redirect to it', () => {
    expect(pickerView({ data: [lake('a')], isPending: false, error: null })).toEqual({ kind: 'redirect', lakeId: 'a' });
  });

  it('c5: no lake → empty', () => {
    expect(pickerView({ data: [], isPending: false, error: null })).toEqual({ kind: 'empty' });
  });

  it('c6: several lakes → the list in server order', () => {
    const v = pickerView({ data: [lake('z'), lake('a'), lake('m')], isPending: false, error: null });
    expect(v.kind === 'list' && v.lakes.map((l) => l.documentId)).toEqual(['z', 'a', 'm']);
  });
});

describe('operator.alege-balta card', () => {
  it('c8: missing stats read 0, cash grouped ro-RO', () => {
    expect(lakeCardStats({})).toEqual({ pending: 0, active: 0, cash: '0' });
    expect(lakeCardStats({ pending: 3, active: 12, cashToCollect: 12500 })).toEqual({ pending: 3, active: 12, cash: '12.500' });
    expect(formatLeiAmount(1250.5)).toBe('1.250,5');
    expect(formatLeiAmount(Number.NaN)).toBe('0');
  });

  it('c7: the bundled lake photo when there is no cover', () => {
    expect(lakeCover({ coverImageUrl: null })).toBe(LAKE_COVER_FALLBACK);
    expect(lakeCover({})).toBe(LAKE_COVER_FALLBACK);
    expect(lakeCover({ coverImageUrl: '  ' })).toBe(LAKE_COVER_FALLBACK);
    expect(lakeCover({ coverImageUrl: 'https://x.test/a.jpg' })).toBe('https://x.test/a.jpg');
  });
});

describe('operator panel Back fallback (panelBack)', () => {
  it('a single-lake owner goes to Acasă: /operator would replace itself with the panel again', () => {
    expect(panelBack(1)).toEqual({ fallbackHref: '/' });
  });
  it('an unknown count (read out or failed) or none: Acasă', () => {
    expect(panelBack(undefined)).toEqual({ fallbackHref: '/' });
    expect(panelBack(0)).toEqual({ fallbackHref: '/' });
  });
  it('several lakes: the picker', () => {
    expect(panelBack(2)).toEqual({ fallbackHref: '/operator' });
  });
});

describe('operator route error copy (isServerFailure)', () => {
  it('a digest (server render) or SessionUnknownError is a server failure', () => {
    expect(isServerFailure(Object.assign(new Error('x'), { digest: '123' }))).toBe(true);
    const e = new Error('x');
    e.name = 'SessionUnknownError';
    expect(isServerFailure(e)).toBe(true);
  });
  it('a browser render crash (no digest) is not', () => {
    expect(isServerFailure(new TypeError('boom'))).toBe(false);
  });
});
