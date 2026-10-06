import { createElement, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pollKeys, type CompetitionCard, type LiveCompetition, type Poll } from '@/core/competitions';
import { deriveRaffleState } from '@/core/organizer';
import { chooseRail, CompetitionsView, railStatus } from './CompetitionsSection';
import { CompetitionRailCard } from './CompetitionRailCard';
import { MyLiveCompetition } from './MyLiveCompetition';
import { LateLiveCompetition, LateOrganizerBanner, LateOwnedLakesCard } from './LateBlocks';
import { PollCard } from './PollCard';
import { RaffleCard } from './RaffleCard';
import {
  MobileDockSlot,
  OperatorSlot,
  OrganizerBannerLoaded,
  OwnedLakesLoaded,
  PartidaCtaSlot,
  RightColumnLateLiveSlot,
  RightColumnLiveSlot,
} from './slots';
import { ToastProvider } from '../_shell/Toast';

// The server loaders (data.ts) read the CMS with the request's session: each test sets the answer
// a block gets, so the «failed» branches (owner rule 4) run without a CMS to break.
const data = vi.hoisted(() => ({
  getHomeSession: vi.fn(),
  getHomeViewer: vi.fn(),
  loadActivePartida: vi.fn(),
  loadActiveWeighing: vi.fn(async () => []),
  loadMyBookingsCount: vi.fn(),
  loadMyLiveCompetition: vi.fn(),
  loadOrganizerDashboard: vi.fn(),
  loadOwnedLakes: vi.fn(),
  loadRaffle: vi.fn(),
  prefetchTracked: vi.fn(),
}));
vi.mock('./data', () => data);

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

  it('a missing sector is left out, never «Sector -» (owner rule 4)', () => {
    const live = scale(null);
    (live['extra-scales'][0]!.stand as { sectors: unknown[] }).sectors = [];
    // No sector: no scale history to open — the row toasts instead (needs the shell's toast).
    const html = renderToString(createElement(ToastProvider, null, createElement(MyLiveCompetition, { live, weighings: [], layout: 'card' })));
    expect(html).toContain('Stand 12');
    expect(html).not.toContain('Sector -');
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

/* ---------- owner rule 4 (ROADMAP §4b): when we don't know, we don't show ---------- */

/** Copy that tells the viewer we do not know something (tests/e2e/acasa.spec.ts UNKNOWN_COPY). */
const UNKNOWN_COPY = /nu am putut|nu știm|indisponibil|nu sunt disponibile|reîncearcă/i;

const viewer = { documentId: 'u1', username: 'ion', isOrganizer: true, ownedLakes: [{ documentId: 'l1', name: 'Chita' }], ownedLakesFailed: false };

/** Renders what an async server component resolved to (null stays null). */
async function rsc(node: Promise<unknown>): Promise<string | null> {
  const el = await node;
  return el == null ? null : renderToString(createElement(ToastProvider, null, el as Parameters<typeof renderToString>[0]));
}

describe('Acasă owner rule 4 — failed reads hide the block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    data.getHomeSession.mockResolvedValue(viewer);
    data.getHomeViewer.mockResolvedValue(viewer);
  });

  const raffle = deriveRaffleState(
    {
      // No end date: no countdown (it needs the app router).
      session: { documentId: 'r1', endDate: null, types: [], prizes: [] },
      registrationsByType: { crap: 2 },
      isRegistrationOpen: true,
      isEnded: false,
      hasWinners: false,
      winnersByTypeKey: {},
    } as unknown as Parameters<typeof deriveRaffleState>[0],
    null,
    null
  );

  it('raffle, participation read failed: no status row, no CTA, no «Nu am putut»', () => {
    const html = renderToString(createElement(RaffleCard, { raffle, signedIn: true, participationFailed: true }));
    expect(html).toContain('Tragere la sorți');
    expect(html).not.toMatch(UNKNOWN_COPY);
    expect(html).not.toContain('Înscrie-te la tombolă');
    expect(html).not.toContain('Vezi șansele tale');
    expect(html).not.toContain('href="/tombola');
    // Control: the same card with the participation known does offer the CTA.
    expect(renderToString(createElement(RaffleCard, { raffle, signedIn: true }))).toContain('Înscrie-te la tombolă');
  });

  it('live rail card without results: the faces only, never «indisponibil»', () => {
    const card = {
      documentId: 'c1',
      name: 'Cupa',
      dateLabel: 'SÂM, 27 SEPT.',
      hoursLabel: null,
      status: 'started',
      format: { kind: 'individual', unit: 'pescari' },
      rankingType: 'classic',
      rankingLabel: 'Clasic',
      banner: null,
      lake: null,
      organizer: null,
      joinedCount: 3,
      pendingCount: 0,
      capacity: null,
      placesLeft: null,
      viewers: 4,
      participantFaces: [],
      results: null,
    } as unknown as CompetitionCard;
    const html = renderToString(createElement(CompetitionRailCard, { competition: card }));
    expect(html).toContain('Cupa');
    expect(html).not.toMatch(UNKNOWN_COPY);
    expect(html).not.toContain('Încă nu sunt capturi');
  });

  it('organiser banner: a 4xx hides it; no answer hands it to the browser (nothing until confirmed)', async () => {
    data.loadOrganizerDashboard.mockResolvedValue(null);
    expect(await rsc(OrganizerBannerLoaded({ layout: 'desktop' }))).toBeNull();
    data.loadOrganizerDashboard.mockResolvedValue('failed');
    expect(((await OrganizerBannerLoaded({ layout: 'desktop' })) as ReactElement).type).toBe(LateOrganizerBanner);
    // Control: with stats the banner renders (the mock reaches the loader).
    data.loadOrganizerDashboard.mockResolvedValue({ byStatus: { notStarted: 2 }, pendingRegistrations: 1, emptySpots: 5 });
    expect(await rsc(OrganizerBannerLoaded({ layout: 'desktop' }))).toContain('Panou organizator');
  });

  it('operator card: a 4xx hides it; no answer hands it to the browser', async () => {
    data.loadOwnedLakes.mockResolvedValue({ lakes: viewer.ownedLakes, stats: null });
    expect(await rsc(OwnedLakesLoaded({ layout: 'desktop' }))).toBeNull();
    data.loadOwnedLakes.mockResolvedValue({ lakes: viewer.ownedLakes, stats: 'failed' });
    expect(((await OwnedLakesLoaded({ layout: 'desktop' })) as ReactElement).type).toBe(LateOwnedLakesCard);
  });

  it('partidă hero: shown only on a confirmed «no live partidă», never when the probe failed', async () => {
    data.loadActivePartida.mockResolvedValue('failed');
    expect(await rsc(PartidaCtaSlot({ layout: 'mobile' }))).toBeNull();
    data.loadActivePartida.mockResolvedValue(null);
    expect(await rsc(PartidaCtaSlot({ layout: 'mobile' }))).toContain('Începe o partidă');
  });

  it('operator slot, owned-lakes read failed: nothing (not even the skeleton)', async () => {
    data.getHomeViewer.mockResolvedValue({ ...viewer, ownedLakes: [], ownedLakesFailed: true });
    expect(await rsc(OperatorSlot({ layout: 'desktop' }))).toBeNull();
  });

  for (const partida of [null, 'failed'] as const) {
    it(`live competition read failed (partidă ${partida ?? 'none'}): the browser reads it — dock and the column's last slot, never the top`, async () => {
      data.loadActivePartida.mockResolvedValue(partida);
      data.loadMyLiveCompetition.mockResolvedValue('failed');
      expect(await rsc(RightColumnLiveSlot())).toBeNull();
      const dock = (await MobileDockSlot()) as ReactElement<{ layout: string }>;
      expect(dock.type).toBe(LateLiveCompetition);
      expect(dock.props.layout).toBe('dock');
      const late = (await RightColumnLateLiveSlot()) as ReactElement<{ layout: string }>;
      expect(late.type).toBe(LateLiveCompetition);
      expect(late.props.layout).toBe('card');
    });
  }

  it('live competition confirmed: the right column top carries it, the late slot stays empty', async () => {
    data.loadActivePartida.mockResolvedValue(null);
    data.loadMyLiveCompetition.mockResolvedValue(null);
    expect(await rsc(RightColumnLateLiveSlot())).toBeNull();
    expect(await rsc(MobileDockSlot())).toBeNull();
  });
});
