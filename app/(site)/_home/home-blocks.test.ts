import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { pollKeys, type LiveCompetition, type Poll } from '@/core/competitions';
import { chooseRail, CompetitionsView, railStatus } from './CompetitionsSection';
import { MyLiveCompetition } from './MyLiveCompetition';
import { PollCard } from './PollCard';
import { ToastProvider } from '../_shell/Toast';

const poll: Poll = {
  id: 2,
  documentId: 'km2o87m85ipqz31oxvt30cdc',
  title: 'Care este principalul motiv pentru care folosești Bluvi?',
  description: null,
  closesAt: '2099-06-02T21:00:00.000Z',
  votingClosed: false,
  totalVotes: 3,
  myVoteOptionId: null,
  options: [
    { id: 1, title: 'Concursuri', description: null, votesCount: 2, suggestedBy: null },
    { id: 2, title: 'Bălți', description: null, votesCount: 1, suggestedBy: null },
  ],
} as unknown as Poll;

function renderPoll(signedIn: boolean) {
  const qc = new QueryClient();
  qc.setQueryData(pollKeys.current, poll);
  // PollCard reports a failed vote through the shell's toast.
  return renderToString(
    createElement(QueryClientProvider, { client: qc }, createElement(ToastProvider, null, createElement(PollCard, { layout: 'mobile', signedIn })))
  );
}

describe('Acasă PollCard', () => {
  it('guest: options and suggest field link to sign-in, back to the poll', () => {
    const html = renderPoll(false);
    const href = '/intra?next=%2Fsondaje';
    expect(html.split(`href="${href}"`).length - 1).toBe(3); // 2 options + suggest
    expect(html).not.toContain('<textarea');
  });

  it('signed in: options are vote toggles and the suggest field is a real field', () => {
    const html = renderPoll(true);
    expect(html).not.toContain('/intra?next=');
    expect(html).toContain('aria-pressed');
    expect(html).toContain('<textarea');
  });
});

describe('Acasă MyLiveCompetition extra-scale rows (fish ScaleItem)', () => {
  const scale = (rankingType: string | null): LiveCompetition => ({
    competition: { documentId: 'cmp1', name: 'Cupa', rankingType },
    'extra-scales': [
      {
        id: 1,
        documentId: 'xs1',
        createdAt: '2026-10-03T10:00:00.000Z',
        author: { id: 9, documentId: 'u9', username: 'ion' },
        extraStatus: 'new',
        stand: { id: 3, documentId: 'st3', name: '12', sectors: [{ id: 1, documentId: 'sA', name: 'A' }], sectorDrawPosition: 4 },
      },
    ],
  }) as unknown as LiveCompetition;

  it('labels «Sector X Stand Y» and links to the stand scale history', () => {
    const html = renderToString(createElement(MyLiveCompetition, { live: scale(null), weighings: [], layout: 'card' }));
    expect(html).toContain('Sector A Stand 12');
    expect(html).toContain('href="/concursuri/cmp1/cantar?sector=A&amp;stand=12&amp;standId=st3"');
    expect(html).toContain('dateTime="2026-10-03T10:00:00.000Z"');
  });

  it('national championship: draw position label', () => {
    const html = renderToString(createElement(MyLiveCompetition, { live: scale('nationalChampionship'), weighings: [], layout: 'card' }));
    expect(html).toContain('A4(12)');
  });
});

describe('Acasă competitions rail', () => {
  const ok = (count: number) => ({ isLoading: false, isError: false, count });
  const failed = { isLoading: false, isError: true, count: 0 };

  it('a failed live read (503) keeps the live rail, in its error state', () => {
    expect(chooseRail(failed, ok(4))).toBe('live');
    expect(railStatus(failed, 0)).toBe('error');
    const html = renderToString(createElement(CompetitionsView, { isLive: true, competitions: [], total: 0, status: 'error', onRetry: () => {} }));
    expect(html).toContain('Concursuri live');
    expect(html).toContain('role="alert"');
    expect(html).toContain('Încearcă din nou');
  });

  it('both reads failed: the live rail with its retry, not nothing', () => {
    expect(chooseRail(failed, failed)).toBe('live');
  });

  it('nothing live: upcoming; upcoming failed: its error', () => {
    expect(chooseRail(ok(0), ok(3))).toBe('upcoming');
    expect(chooseRail(ok(0), failed)).toBe('upcoming');
    expect(chooseRail(ok(0), ok(0))).toBeNull();
  });

  it('a failed refetch with cards keeps the cards', () => {
    expect(railStatus(failed, 5)).toBe('ready');
  });
});
