import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { UseQueryResult } from '@tanstack/react-query';
import type { RankingResponse } from '@/core/competitions';
import { RankingView } from './RankingView';

/*
 * RankingView's states that the e2e cannot reach on a real page: the competition page's server
 * hydrates the ranking (CompetitionRoute HydrateQueries), so the browser never starts without it —
 * no first-load skeleton, no first-load error. Parity competition-page.clasament c1, c25, c26.
 */

type Query = UseQueryResult<RankingResponse>;
const query = (q: Partial<Query>): Query => ({ isPending: false, isError: false, isFetching: false, fetchStatus: 'idle', data: undefined, refetch: vi.fn(), ...q }) as unknown as Query;

const render = (q: Query, rankingType: string | null = 'quantity') =>
  renderToStaticMarkup(
    createElement(RankingView, { query: q, rankingType, table: null, placeTable: null, currentUserStandId: null, custom: null, onFullView: () => {} }),
  );

describe('RankingView states', () => {
  it('c1 — while the ranking loads: the ranking skeleton (a status «Se încarcă clasamentul»), no table', () => {
    const html = render(query({ isPending: true, fetchStatus: 'fetching' }));
    expect(html).toContain('role="status"');
    expect(html).toContain('Se încarcă clasamentul');
    expect(html).not.toContain('<table');
  });

  it('c26 — a failed ranking read with nothing to show: the error screen, its retry, no back button', () => {
    const html = render(query({ isError: true, fetchStatus: 'idle' }));
    expect(html).toContain('Clasamentul nu a putut fi încărcat.');
    expect(html).toContain('Încearcă din nou');
    expect(html).not.toMatch(/Înapoi|href=/);
  });

  it('c25 — a ranking with no rows: «Nu există date de afișat»', () => {
    const data = { metadata: { rankingType: 'quantity' }, rankings: [] } as unknown as RankingResponse;
    const html = render(query({ data, isSuccess: true } as Partial<Query>));
    expect(html).toContain('Nu există date de afișat');
  });
});
