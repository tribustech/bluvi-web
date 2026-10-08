import { describe, expect, it } from 'vitest';
import {
  filterOptions,
  optionHelperLines,
  orderOptions,
  pagerCanObserve,
  pagerIdle,
  pagerOnEnd,
  pagerOnProgress,
  pagerRetry,
  type PagerState,
  type SearchSelectOption,
} from '@/components/forms/searchSelect';

const o = (id: string, label: string, extra: Partial<SearchSelectOption> = {}): SearchSelectOption => ({ id, label, ...extra });

describe('SearchSelectDialog (pure half)', () => {
  it('lists disabled options last, keeping each group’s order', () => {
    const list = [o('a', 'Ana', { disabled: true }), o('b', 'Bogdan'), o('c', 'Cip', { disabled: true, selected: true }), o('d', 'Dan')];
    expect(orderOptions(list).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('filters locally on the label and the helper lines, diacritics-insensitive', () => {
    const list = [o('1', 'Ștefan Pop', { helper: '#stefan1' }), o('2', 'Balta Chita', { helper: ['Ilfov', '24 de standuri'] }), o('3', 'Ion')];
    expect(filterOptions(list, 'stefan').map((x) => x.id)).toEqual(['1']);
    expect(filterOptions(list, 'ILFOV').map((x) => x.id)).toEqual(['2']);
    expect(filterOptions(list, '   ')).toHaveLength(3);
    expect(filterOptions(list, 'zzz')).toEqual([]);
  });

  it('normalises the helper to lines', () => {
    expect(optionHelperLines(undefined)).toEqual([]);
    expect(optionHelperLines('x')).toEqual(['x']);
    expect(optionHelperLines(['x', 'y'])).toEqual(['x', 'y']);
  });
});

describe('SearchSelectDialog pager (infinite loading)', () => {
  const base = { hasMore: true, hasHandler: true, loading: false, error: false, rowCount: 20 };

  it('observes the end only once the first page is on screen', () => {
    expect(pagerCanObserve(pagerIdle, base)).toBe(true);
    expect(pagerCanObserve(pagerIdle, { ...base, loading: true })).toBe(false);
    expect(pagerCanObserve(pagerIdle, { ...base, error: true })).toBe(false);
    expect(pagerCanObserve(pagerIdle, { ...base, rowCount: 0 })).toBe(false);
    expect(pagerCanObserve(pagerIdle, { ...base, hasMore: false })).toBe(false);
    expect(pagerCanObserve(pagerIdle, { ...base, hasHandler: false })).toBe(false);
  });

  /** Drives the pager the way the component does: every time the sentinel reports in view, ask. */
  function simulate(pages: ('ok' | 'fail')[], endSightings: number) {
    let s: PagerState = pagerIdle;
    let rows = 20;
    let calls = 0;
    const settle = (outcome: 'ok' | 'fail') => {
      s = pagerOnProgress(s, { loadingMore: true, rowCount: rows, loadMoreError: false });
      if (outcome === 'ok') rows += 20;
      s = pagerOnProgress(s, { loadingMore: false, rowCount: rows, loadMoreError: false });
    };
    for (let i = 0; i < endSightings; i++) {
      // A fresh IntersectionObserver reports the in-view sentinel at once — only while observable.
      if (!pagerCanObserve(s, { ...base, rowCount: rows })) continue;
      const r = pagerOnEnd(s, { loadingMore: false, rowCount: rows });
      s = r.state;
      if (r.call) {
        calls++;
        settle(pages[calls - 1] ?? 'ok');
      }
    }
    return { s, calls, rows };
  }

  it('does not call onLoadMore again after a failed page (no request loop)', () => {
    const { s, calls } = simulate(['fail'], 50);
    expect(calls).toBe(1);
    expect(s.failed).toBe(true);
    expect(pagerCanObserve(s, base)).toBe(false);
  });

  it('keeps loading pages that succeed, one at a time', () => {
    const { calls, rows } = simulate(['ok', 'ok', 'ok'], 3);
    expect(calls).toBe(3);
    expect(rows).toBe(80);
  });

  it('never asks twice while a page is in flight', () => {
    const first = pagerOnEnd(pagerIdle, { loadingMore: false, rowCount: 20 });
    expect(first.call).toBe(true);
    expect(pagerOnEnd(first.state, { loadingMore: false, rowCount: 20 }).call).toBe(false);
    expect(pagerOnEnd(pagerIdle, { loadingMore: true, rowCount: 20 }).call).toBe(false);
  });

  it('a caller-reported page error fails at once; the explicit retry asks exactly once more', () => {
    const asked = pagerOnEnd(pagerIdle, { loadingMore: false, rowCount: 20 }).state;
    const failed = pagerOnProgress(asked, { loadingMore: false, rowCount: 20, loadMoreError: true });
    expect(failed.failed).toBe(true);
    expect(pagerOnEnd(failed, { loadingMore: false, rowCount: 20 }).call).toBe(false);
    const retried = pagerRetry({ rowCount: 20 });
    expect(retried.failed).toBe(false);
    expect(pagerOnProgress(retried, { loadingMore: false, rowCount: 40, loadMoreError: false })).toEqual(pagerIdle);
  });

  it('returns the same state when nothing changed (safe render-time update)', () => {
    expect(pagerOnProgress(pagerIdle, { loadingMore: false, rowCount: 20, loadMoreError: false })).toBe(pagerIdle);
    const asked = pagerOnEnd(pagerIdle, { loadingMore: false, rowCount: 20 }).state;
    const loading = pagerOnProgress(asked, { loadingMore: true, rowCount: 20, loadMoreError: false });
    expect(pagerOnProgress(loading, { loadingMore: true, rowCount: 20, loadMoreError: false })).toBe(loading);
  });
});
