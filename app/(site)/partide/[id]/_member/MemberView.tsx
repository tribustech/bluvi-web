'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WifiIcon } from '@heroicons/react/24/outline';
import { OpenInApp } from '@/components/partide/OpenInApp';
import { DetailBand, DetailBody, DetailPage } from '@/components/templates/T3';
import { StatusPill } from '@/components/ui/StatusPill';
import { historyDetailView, partidaDetailQuery, partidaShareMessage, partideKeys, shareVisible, type SessionListItemDTO } from '@/core/partide';
import { isApiError } from '@/core/transport';
import { appLinks } from '@/lib/app-links';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { useSiteToast } from '../../../_shell/Toast';
import { useLivePartide, useLiveSession, useServerNow } from '../../_live';
import { buildSubtitle, isEndedSession, venueName } from './model';
import { PartidaHeader } from './PartidaHeader';
import { useMemberRecap } from './Recap';
import { DetailSkeletonState, DownloadFailed, MemberNotFound, PreparingState } from './states';
import { Summary } from './Summary';

/*
 * Partidă — the viewer's OWN partidă (parity partide.partida; fish app/(app)/partide/[id].tsx), on
 * the same URL as the spectator view: _switch/OwnOrSpectator renders it when the partidă is the
 * viewer's — the live pointer names this documentId, or it is in the viewer's own list. Client-only
 * (the static HTML is the public spectator page) and noindex.
 *
 * Read-only (owner 2026-10-08, ROADMAP §4b rule 21: running a partidă is app-only on web): the
 * spectator-style recap over the member's own data (./Recap — a private partidă shows too), the
 * summary (numbers, roster, join code), share, and the hand-over to the app («Deschide în aplicația
 * Bluvi» below 1280, the store links from 1280). No tabs, no capture, rods, finish, delete, leave,
 * kick, code rotation, anchor or feedback here — fish's member screen does those.
 *
 * Data (c23, fish usePartidaDetail): the LIVE partidă reads the realtime projection (../_live: the
 * pointer's session, also when a teammate just finished it); any other own partidă reads GET
 * /feed/sessions/:documentId (core partidaDetailQuery) with the list row as its summary meanwhile.
 *
 * States: preparing (pointer, no snapshot yet — c6), not found (c7: the detail answered the CMS's
 * PARTIDA:NOT_FOUND), the detail's skeleton (summary only) and «Nu am putut descărca partida» +
 * «Reîncearcă» (c8), then the page: the compact header (c1, c3), «Reconectare…» while a live
 * partidă is offline (c9), the app hand-over, the recap and, beside it from 1280, the sticky summary.
 */

export function MemberView({ documentId, listItem }: { documentId: string; listItem: SessionListItemDTO | null }) {
  const live = useLivePartide();
  const liveSession = useLiveSession(documentId);
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const isLiveRoute = !!liveSession.pointer;
  const detail = useQuery(partidaDetailQuery(t, documentId, { enabled: !isLiveRoute && !!listItem }));

  const history = useMemo(
    () => (isLiveRoute ? null : historyDetailView(listItem?.clientId ?? documentId, listItem, detail.data)),
    [isLiveRoute, listItem, documentId, detail.data],
  );
  const session = isLiveRoute ? liveSession.session : (history?.session ?? null);
  const events = isLiveRoute ? liveSession.events : (history?.events ?? []);

  let state: ReactNode = null;
  let loaded: LoadedProps | null = null;
  if (!session) state = isLiveRoute ? <PreparingState /> : <MemberNotFound />;
  else if (!isLiveRoute && isApiError(detail.error) && detail.error.bluCode === 'PARTIDA:NOT_FOUND') state = <MemberNotFound />;
  else if (!session.detailsHydrated) {
    state =
      detail.isError && !detail.isFetching ? (
        <DownloadFailed name={venueName(session)} retrying={detail.isFetching} onRetry={() => void qc.invalidateQueries({ queryKey: partideKeys.detail(documentId) })} />
      ) : (
        <DetailSkeletonState name={venueName(session)} />
      );
  } else {
    loaded = { documentId, session, events, isLive: isLiveRoute, membershipDocumentId: isLiveRoute ? liveSession.pointer!.documentId : documentId, viewerUid: live.uid ?? null };
  }
  return (
    <>
      <meta name="robots" content="noindex" />
      {loaded ? <Loaded {...loaded} /> : state}
    </>
  );
}

/* ------------------------------------------------------------------------------------------------ */

type LoadedProps = {
  documentId: string;
  session: NonNullable<ReturnType<typeof useLiveSession>['session']>;
  events: ReturnType<typeof useLiveSession>['events'];
  isLive: boolean;
  membershipDocumentId: string;
  viewerUid: string | null;
};

function Loaded({ documentId, session, events, isLive, membershipDocumentId, viewerUid }: LoadedProps) {
  const live = useLivePartide();
  const toast = useSiteToast();
  const now = useServerNow();

  const isEnded = isEndedSession(session);
  const shareDocumentId = shareVisible(session) ? membershipDocumentId : null;
  const name = venueName(session);
  const recap = useMemberRecap(documentId, session, events, true);

  /* ── share (c3) ────────────────────────────────────────────────────── */
  const onShare = useCallback(async () => {
    if (!shareDocumentId) return;
    const message = partidaShareMessage(shareDocumentId);
    try {
      if (navigator.share) {
        await navigator.share({ text: message });
        return;
      }
      await navigator.clipboard.writeText(message);
      toast('Linkul partidei a fost copiat.', 'success');
    } catch {
      // Dismissed share sheet: nothing to say.
    }
  }, [shareDocumentId, toast]);

  const status = isEnded ? <StatusPill tone="neutral">ÎNCHEIATĂ</StatusPill> : <StatusPill tone="live">ÎN DESFĂȘURARE</StatusPill>;

  return (
    <div data-testid="partida-member-view" data-live={isLive || undefined} data-ended={isEnded || undefined} className="contents">
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: name }]} />
      <DetailPage phoneGround="page">
        <DetailBand hairline>
          <PartidaHeader name={name} subtitle={buildSubtitle(session, session.rods.length)} status={status} onShare={shareDocumentId ? () => void onShare() : undefined} />
          {recap.hero}
        </DetailBand>
        {isLive && !isEnded && !live.online ? (
          <p role="status" data-testid="partida-reconnecting" className="flex items-center justify-center gap-1.5 bg-status-warning-bg px-3 py-1.5 t-label text-status-warning-fg">
            <WifiIcon aria-hidden className="size-3.5" />
            Reconectare…
          </p>
        ) : null}
        <DetailBody
          aside={<Summary session={session} events={events} viewerUid={viewerUid} isEnded={isEnded} now={now} onShare={shareDocumentId ? () => void onShare() : undefined} />}
          asideLabel="Pe scurt"
          asideBelowXl="end"
          asideSticky
          className="md:pt-4 xl:pt-4"
        >
          <div className="flex flex-col gap-2 md:gap-4">
            <AppHandoff documentId={membershipDocumentId} isEnded={isEnded} />
            {recap.body}
          </div>
        </DetailBody>
      </DetailPage>
      {recap.lightbox}
    </div>
  );
}

/**
 * The hand-over to the app (owner 2026-10-08): a live partidă is run there (captures, rods, timers,
 * the finish); an ended one is edited or deleted there. The universal link opens the app on this
 * partidă (fish partide/comunitate/[id] sends its own member on to the member screen).
 */
function AppHandoff({ documentId, isEnded }: { documentId: string; isEnded: boolean }): ReactNode {
  return (
    <section aria-labelledby="partida-app" data-testid="partida-app-cta" className="mx-4 flex flex-col gap-3 rounded-card bg-accent-tint px-4 py-4 md:mx-0 md:px-5 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 id="partida-app" className="t-body-strong text-accent-ink">
          {isEnded ? 'Partida se editează în aplicația Bluvi' : 'Partida ta e live — o ții din aplicația Bluvi'}
        </h2>
        <p className="t-caption text-ink-2">
          {isEnded ? 'Capturile, detaliile și ștergerea partidei se fac din aplicație.' : 'Capturile, lansetele, cronometrele și încheierea partidei se fac din aplicație.'}
        </p>
      </div>
      <OpenInApp href={appLinks.partida(documentId)} size="compact" className="shrink-0" testId="partida-open-in-app" />
    </section>
  );
}
