'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WifiIcon } from '@heroicons/react/24/outline';
import { AutoCloseWarnDialog } from '@/components/partide/dialogs/AutoCloseWarnDialog';
import { DeletePartidaDialog } from '@/components/partide/dialogs/DeletePartidaDialog';
import { FinishPartidaDialog } from '@/components/partide/dialogs/FinishPartidaDialog';
import { KickDialog } from '@/components/partide/dialogs/KickDialog';
import { LeaveDialog } from '@/components/partide/dialogs/LeaveDialog';
import { PartidaFeedbackDialog } from '@/components/partide/dialogs/PartidaFeedbackDialog';
import { RotateJoinCodeDialog } from '@/components/partide/dialogs/RotateJoinCodeDialog';
import { ANCHOR_ZOOM, COUNTRY_ZOOM, MapPointPicker, ROMANIA_CENTER } from '@/components/partide/map/MapPointPicker';
import { useBack } from '@/components/nav/useBack';
import { DetailBand, DetailBody, DetailPage } from '@/components/templates/T3';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  COMMUNITY_PURGE_GRACE_MS,
  communityKeys,
  deletePartidaMutation,
  extendSession,
  finishSession,
  historyDetailView,
  initialTab,
  kickPartidaMemberMutation,
  leavePartidaMutation,
  partidaDetailQuery,
  partidaShareMessage,
  partideKeys,
  rotatePartidaJoinCodeMutation,
  shareVisible,
  tabAfterEndedChange,
  visibleTabs,
  type PartidaTabKey,
  type SessionListItemDTO,
  type SessionMember,
} from '@/core/partide';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { useSiteToast } from '../../../_shell/Toast';
import { fakeLive, useLivePartide, useLiveSession, useServerNow } from '../../_live';
import { rememberSessionDocumentId } from '../../_live/partideCore';
import { FeedbackBar, useFeedbackNudge } from './FeedbackBar';
import { buildSubtitle, isEndedSession, venueName } from './model';
import { PartidaHeader } from './PartidaHeader';
import { useMemberRecap } from './Recap';
import { DetailSkeletonState, DownloadFailed, MemberNotFound, PreparingState } from './states';
import { Summary } from './Summary';
import { panelId, tabId, TabStrip } from './TabStrip';
import { MEMBER_TABS, tabKeyOfSlug, tabShipped } from './tabs/registry';
import type { MemberTabProps } from './tabs/types';

/*
 * Partidă — the member view (parity partide.partida; fish app/(app)/partide/[id].tsx), on the same
 * URL as the spectator view: _switch/OwnOrSpectator renders it when the partidă is the viewer's —
 * the live pointer names this documentId, or it is in the viewer's own list. Client-only (the
 * static HTML is the public spectator page) and noindex.
 *
 * Data (c23, fish usePartidaDetail): the LIVE partidă reads the realtime projection (../_live: the
 * pointer's session, also when a teammate just finished it); any other own partidă reads GET
 * /feed/sessions/:documentId (core partidaDetailQuery) with the list row as its summary meanwhile.
 *
 * States: preparing (pointer, no snapshot yet — c6), not found (c7: the detail answered the CMS's
 * PARTIDA:NOT_FOUND), the detail's skeleton (summary only) and «Nu am putut descărca partida» +
 * «Reîncearcă» (c8), then the page: the compact header (c1–c3), «Reconectare…» while a live
 * partidă is offline (c9), the tabs (c4/c5: live 5, ended 4, `?tab=` slugs, Jurnal's count) — only
 * those whose batch shipped (registry) —, the feedback nudge (c21), the tab and, beside it from
 * 1280, the sticky summary (stats, roster, code, actions).
 *
 * While no tab has shipped (production today) the main column carries the recap (./Recap: the
 * spectator page's photos, total, evolution, biggest catch and catches over the member's data).
 *
 * Leaving the page (delete, leave): the core mutation refetches the own list / drops the pointer
 * BEFORE the page navigates; the loaded view is frozen meanwhile (`onDepart`), so neither «not
 * found» nor the spectator page of the partidă just deleted shows under the closing dialog (fish
 * stays on its screen until router.replace; OwnOrSpectator latches the member branch likewise).
 *
 * Writes (all CMS, through /api/cms; nothing to Firestore): finish (c10–c12), auto-close extend
 * (c13), delete (c14), leave (c15), kick (c16), rotate (c17), anchor (c19), feedback (c22). Each
 * membership / delete / rotate confirm is single-flight (c18): a ref guard plus the surface's own
 * pending lock.
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
  const clientId = liveSession.pointer?.sessionId ?? listItem?.clientId ?? null;
  // Hand the pair to the write layer (fish usePartidaDetail → rememberSessionDocumentId): a device
  // that did not create / join this partidă can still address it.
  useEffect(() => {
    if (clientId) rememberSessionDocumentId(clientId, documentId);
  }, [clientId, documentId]);

  const session = isLiveRoute ? liveSession.session : (history?.session ?? null);
  const events = isLiveRoute ? liveSession.events : (history?.events ?? []);

  let state: ReactNode = null;
  let loaded: Omit<LoadedProps, 'onDepart'> | null = null;
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
  // The view as it was when a delete / leave started, kept until the page has navigated away.
  const [frozen, setFrozen] = useState<Omit<LoadedProps, 'onDepart'> | null>(null);
  const shown = frozen ?? loaded;
  const onDepart = (departing: boolean) => setFrozen(departing ? loaded : null);

  return (
    <>
      <meta name="robots" content="noindex" />
      {shown ? <Loaded {...shown} onDepart={onDepart} /> : state}
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
  /** true: freeze this view (a delete / leave is about to drop it from the caches); false: thaw. */
  onDepart: (departing: boolean) => void;
};

function Loaded({ documentId, session, events, isLive, membershipDocumentId, viewerUid, onDepart }: LoadedProps) {
  const live = useLivePartide();
  const t = live.transport;
  const qc = useQueryClient();
  const router = useRouter();
  const toast = useSiteToast();
  const back = useBack(routes.partide());
  const now = useServerNow();
  const params = useSearchParams();
  const allTabs = !!fakeLive()?.allTabs;

  const rodCount = session.rods.length;
  const isEnded = isEndedSession(session);
  const isOwner = Boolean(viewerUid && session.hostUid === viewerUid);
  const canMutateMembership = Boolean(session.status === 'active' && session.hostUid && membershipDocumentId && viewerUid);
  const canDelete = Boolean(isOwner && membershipDocumentId);
  const shareDocumentId = shareVisible(session) ? membershipDocumentId : null;
  const name = venueName(session);
  const captures = events.filter(e => e.outcome === 'capture').length;
  const elapsedMs = (session.endedAt ?? now ?? session.startedAt) - session.startedAt;

  /* ── tabs (c4, c5) ─────────────────────────────────────────────────── */
  const tabKeys = useMemo(() => visibleTabs(isEnded).filter(k => tabShipped(k, allTabs)), [isEnded, allTabs]);
  const fromUrl = tabKeyOfSlug(params.get('tab'));
  const [selected, setSelected] = useState<PartidaTabKey>(() => (fromUrl && visibleTabs(isEnded).includes(fromUrl) ? fromUrl : initialTab(isEnded, rodCount)));
  // Live → ended under the viewer (a teammate finished): keep the tab when it still exists.
  const prevEnded = useRef(isEnded);
  useEffect(() => {
    if (prevEnded.current === isEnded) return;
    prevEnded.current = isEnded;
    setSelected(s => tabAfterEndedChange(s, isEnded, rodCount));
  }, [isEnded, rodCount]);
  const current = tabKeys.includes(selected) ? selected : (tabKeys[0] ?? null);
  // No tab shipped yet: the recap fills the main column (the spectator page's content, ./Recap).
  const recap = useMemberRecap(documentId, session, events, tabKeys.length === 0);
  const selectTab = useCallback(
    (key: PartidaTabKey) => {
      setSelected(key);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', MEMBER_TABS[key].slug);
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    },
    [],
  );

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

  /* ── finish (c10–c12) ──────────────────────────────────────────────── */
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishPending, setFinishPending] = useState(false);
  const finishingRef = useRef(false);
  const handleFinish = useCallback(async () => {
    if (!canMutateMembership || !isOwner || finishingRef.current) return;
    if (isLive) {
      // Single-flight (c18): a double click while the sheet animates out, Enter auto-repeat or the
      // auto-close «Nu, închid partida» racing «Termină» must not POST twice nor go back twice.
      // Reset only on failure (on success the page has gone back).
      finishingRef.current = true;
      // fish useEndPartida: rods force-stop locally (the web schedules no alarm, nothing to cancel),
      // the archive is posted, the pointer drops only once the server confirmed it; the page goes
      // back at once and a failure says so wherever the viewer is.
      setFinishOpen(false);
      back();
      void (async () => {
        try {
          await finishSession(t, membershipDocumentId);
          await live.clearLive();
          void qc.invalidateQueries({ queryKey: partideKeys.mine });
          setTimeout(() => void qc.invalidateQueries({ queryKey: communityKeys.all }), COMMUNITY_PURGE_GRACE_MS);
        } catch {
          finishingRef.current = false;
          toast('Nu am putut încheia partida. Mai încearcă o dată.', 'danger');
        }
      })();
      return;
    }
    // Still open but not followed live here (left open on another device): archive server-side.
    if (!membershipDocumentId) {
      toast('Partida nu s-a sincronizat încă.', 'danger');
      return;
    }
    finishingRef.current = true;
    setFinishPending(true);
    try {
      await finishSession(t, membershipDocumentId);
      await Promise.all([
        qc.invalidateQueries({ queryKey: partideKeys.mine }),
        qc.invalidateQueries({ queryKey: partideKeys.detail(membershipDocumentId) }),
      ]);
      // ÎN DIRECT is left after the CMS's edge purge (b.community-purge-grace).
      setTimeout(() => void qc.invalidateQueries({ queryKey: communityKeys.all }), COMMUNITY_PURGE_GRACE_MS);
      setFinishOpen(false);
      back();
    } catch {
      toast('Ceva n-a mers. Încearcă din nou.', 'danger');
    } finally {
      finishingRef.current = false;
      setFinishPending(false);
    }
  }, [back, canMutateMembership, isLive, isOwner, live, membershipDocumentId, qc, t, toast]);
  const openFinish = useCallback(() => {
    if (canMutateMembership && isOwner) setFinishOpen(true);
  }, [canMutateMembership, isOwner]);

  /* ── auto-close warning (c13) ──────────────────────────────────────── */
  const warned = isLive && isOwner && session.warnedAt != null && session.endedAt == null;
  const [warnAnsweredAt, setWarnAnsweredAt] = useState<number | null>(null);
  const warnOpen = warned && warnAnsweredAt !== session.warnedAt && !finishOpen;
  const [extending, setExtending] = useState(false);
  const onStillFishing = async () => {
    if (extending) return;
    setExtending(true);
    try {
      // Success: the CMS clears warnedAt, the snapshot follows and the dialog closes by itself.
      await extendSession(t, membershipDocumentId);
    } catch {
      toast('Nu am putut prelungi partida. Încearcă din nou.', 'danger');
    } finally {
      setExtending(false);
    }
  };
  const onFinishFromWarn = () => {
    setWarnAnsweredAt(session.warnedAt);
    void handleFinish();
  };

  /* ── delete (c14) ──────────────────────────────────────────────────── */
  const del = useMutation(deletePartidaMutation(t, qc));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deletingRef = useRef(false);
  const onDeleteConfirm = async () => {
    if (!canDelete || deletingRef.current) return;
    deletingRef.current = true;
    setDeleteError(null);
    onDepart(true);
    try {
      await del.mutateAsync({ documentId: membershipDocumentId, currentUserDocumentId: viewerUid, wasActive: isLive });
      if (isLive) await live.clearLive();
      setDeleteOpen(false);
      toast('Partida a fost ștearsă.', 'success');
      router.replace(routes.partide());
    } catch {
      onDepart(false);
      setDeleteError('Nu am putut șterge partida. Încearcă din nou.');
    } finally {
      deletingRef.current = false;
    }
  };

  /* ── leave / kick (c15, c16) ───────────────────────────────────────── */
  const leave = useMutation(leavePartidaMutation(t, qc));
  const kick = useMutation(kickPartidaMemberMutation(t, qc));
  const [membership, setMembership] = useState<{ mode: 'leave' } | { mode: 'kick'; member: SessionMember } | null>(null);
  const [membershipError, setMembershipError] = useState<string | null>(null);
  const membershipRef = useRef(false);
  const membershipPending = leave.isPending || kick.isPending;
  const onMembershipConfirm = async () => {
    if (!membership || !canMutateMembership || membershipRef.current) return;
    if (membership.mode === 'leave' && isOwner) return;
    if (membership.mode === 'kick' && !isOwner) return;
    membershipRef.current = true;
    setMembershipError(null);
    try {
      if (membership.mode === 'leave') {
        onDepart(true);
        await leave.mutateAsync({ documentId: membershipDocumentId, currentUserDocumentId: viewerUid });
        // fish cleanupSessionAccess: the caches are done (core); the device half — pointer, live
        // state, the way to the Partide hub.
        if (isLive) await live.clearLive();
        setMembership(null);
        toast('Ai părăsit partida.', 'success');
        router.replace(routes.partide());
      } else {
        await kick.mutateAsync({ documentId: membershipDocumentId, currentUserDocumentId: viewerUid, targetDocumentId: membership.member.uid });
        setMembership(null);
        toast('Participant eliminat. Codul a fost schimbat.', 'success');
      }
    } catch {
      if (membership.mode === 'leave') onDepart(false);
      setMembershipError(membership.mode === 'leave' ? 'Nu am putut părăsi partida. Încearcă din nou.' : 'Nu am putut elimina participantul. Încearcă din nou.');
    } finally {
      membershipRef.current = false;
    }
  };

  /* ── rotate (c17) ──────────────────────────────────────────────────── */
  const rotate = useMutation(rotatePartidaJoinCodeMutation(t, qc));
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const rotatingRef = useRef(false);
  const onRotateConfirm = async () => {
    if (!canMutateMembership || !isOwner || rotatingRef.current) return;
    rotatingRef.current = true;
    setRotateError(null);
    try {
      await rotate.mutateAsync({ documentId: membershipDocumentId, currentUserDocumentId: viewerUid });
      setRotateOpen(false);
      toast('Codul de acces a fost schimbat.', 'success');
    } catch {
      setRotateError('Codul nu a putut fi schimbat. Încearcă din nou.');
    } finally {
      rotatingRef.current = false;
    }
  };

  /* ── anchor (c19) ──────────────────────────────────────────────────── */
  // The map's opening view is taken once, when it opens: a projection landing while it is open
  // (the stand PATCH that opened it, a teammate's move) must not re-centre it under the user's drag.
  // `center` — a point the caller already knows (the stand just chosen), ahead of the projection.
  const [adjust, setAdjust] = useState<{ center: { lat: number; lng: number }; anchored: boolean } | null>(null);
  const openAdjust = (center?: { lat: number; lng: number }) => {
    const hasAnchor = session.anchorLat !== 0 || session.anchorLng !== 0;
    setAdjust(
      center
        ? { center, anchored: true }
        : hasAnchor
          ? { center: { lat: session.anchorLat, lng: session.anchorLng }, anchored: true }
          : { center: ROMANIA_CENTER, anchored: false },
    );
  };
  const onAnchor = (coord: { lat: number; lng: number }) => {
    setAdjust(null);
    // fish useSetSessionAnchor: fire and report — the projection brings the new anchor back.
    void live
      .repo()
      .then(repo => repo.updateMeta(session.clientId, { anchorLat: coord.lat, anchorLng: coord.lng }))
      .catch(err => console.error('[partida anchor]', err));
  };

  /* ── feedback (c21, c22) ───────────────────────────────────────────── */
  const nudge = useFeedbackNudge({ sessionClientId: session.clientId, captures, elapsedMs, enabled: !isEnded && now != null });
  const [feedback, setFeedback] = useState<'info' | 'nudge' | null>(null);

  const tabProps: MemberTabProps = {
    documentId,
    session,
    events,
    isEnded,
    isOwner,
    isLive,
    canMutateMembership,
    canDelete,
    onFinish: openFinish,
    onLeaveSession: () => {
      if (!canMutateMembership || isOwner) return;
      setMembershipError(null);
      setMembership({ mode: 'leave' });
    },
    onKickMember: member => {
      if (!canMutateMembership || !isOwner || member.uid === session.hostUid) return;
      setMembershipError(null);
      setMembership({ mode: 'kick', member });
    },
    onRotateJoinCode: () => {
      if (!canMutateMembership || !isOwner) return;
      setRotateError(null);
      setRotateOpen(true);
    },
    onAdjustPosition: openAdjust,
    onDeleteSession: () => {
      if (!canDelete) return;
      setDeleteError(null);
      setDeleteOpen(true);
    },
    onReportProblem: () => setFeedback('info'),
  };
  const finishAction = !isEnded && canMutateMembership && isOwner ? openFinish : undefined;
  const Body = current ? MEMBER_TABS[current].Body : null;
  const status = isEnded ? <StatusPill tone="neutral">ÎNCHEIATĂ</StatusPill> : <StatusPill tone="live">ÎN DESFĂȘURARE</StatusPill>;

  const summary = (
    <Summary
      session={session}
      events={events}
      viewerUid={viewerUid}
      isEnded={isEnded}
      isOwner={isOwner}
      isLive={isLive}
      canMutateMembership={canMutateMembership}
      canDelete={canDelete}
      now={now}
      onFinish={finishAction}
      onShare={shareDocumentId ? () => void onShare() : undefined}
      onLeave={tabProps.onLeaveSession}
      onKick={tabProps.onKickMember}
      onRotate={tabProps.onRotateJoinCode}
      onAdjust={() => openAdjust()}
      onReport={tabProps.onReportProblem}
      onDelete={tabProps.onDeleteSession}
      statsOnly={current === 'info'}
    />
  );

  return (
    <div data-testid="partida-member-view" data-live={isLive || undefined} data-ended={isEnded || undefined} className="contents">
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: name }]} />
      <DetailPage phoneGround="page">
        <DetailBand hairline={!tabKeys.length}>
          <PartidaHeader
            name={name}
            subtitle={buildSubtitle(session, rodCount)}
            status={status}
            onShare={shareDocumentId ? () => void onShare() : undefined}
            onFinish={finishAction}
          />
          {recap.hero}
        </DetailBand>
        {isLive && !isEnded && !live.online ? (
          <p role="status" data-testid="partida-reconnecting" className="flex items-center justify-center gap-1.5 bg-status-warning-bg px-3 py-1.5 t-label text-status-warning-fg">
            <WifiIcon aria-hidden className="size-3.5" />
            Reconectare…
          </p>
        ) : null}
        {tabKeys.length ? (
          <DetailBand sticky>
            <TabStrip
              tabs={tabKeys.map(k => ({ key: k, title: MEMBER_TABS[k].title, count: k === 'jurnal' ? events.length : undefined }))}
              selected={current!}
              onSelect={selectTab}
            />
          </DetailBand>
        ) : null}
        <div className="md:px-6 md:pt-4 xl:px-8">
          <FeedbackBar visible={nudge.visible} onOpen={() => setFeedback('nudge')} onDismiss={nudge.answer} />
        </div>
        {/* Setări below the two-column width: no «Pe scurt» under it — «Șterge partida» stays the last thing (fish InfoScene). */}
        <DetailBody aside={summary} asideLabel="Pe scurt" asideBelowXl={current === 'info' ? 'hidden' : 'end'} asideSticky={tabKeys.length ? 'below-tabs' : true} className="md:pt-4 xl:pt-4">
          {Body && current ? (
            <div role="tabpanel" id={panelId(current)} aria-labelledby={tabId(current)} tabIndex={0} data-testid={`partida-panel-${current}`} className="flex flex-col gap-2 outline-none md:gap-4">
              <Body {...tabProps} />
            </div>
          ) : (
            recap.body
          )}
        </DetailBody>
      </DetailPage>

      <FinishPartidaDialog open={finishOpen} session={session} events={events} now={now ?? session.startedAt} pending={finishPending} onConfirm={() => void handleFinish()} onClose={() => setFinishOpen(false)} />
      <AutoCloseWarnDialog open={warnOpen} autoCloseAt={session.autoCloseAt} now={now ?? session.startedAt} extending={extending} onConfirmStillFishing={() => void onStillFishing()} onFinishPartida={onFinishFromWarn} />
      <DeletePartidaDialog
        open={deleteOpen}
        venueName={name}
        captureCount={captures}
        photoCount={events.filter(e => !!e.photoUrl || !!e.photoLocalUri).length}
        teammateCount={Math.max((session.members?.length ?? 1) - 1, 0)}
        pending={del.isPending}
        error={deleteError}
        onConfirm={() => void onDeleteConfirm()}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteError(null);
        }}
      />
      <LeaveDialog open={membership?.mode === 'leave'} pending={membershipPending} error={membershipError} onConfirm={() => void onMembershipConfirm()} onClose={() => setMembership(null)} />
      <KickDialog
        open={membership?.mode === 'kick'}
        memberName={membership?.mode === 'kick' ? (membership.member.name ?? 'Participantul') : 'Participantul'}
        pending={membershipPending}
        error={membershipError}
        onConfirm={() => void onMembershipConfirm()}
        onClose={() => setMembership(null)}
      />
      <RotateJoinCodeDialog open={rotateOpen} pending={rotate.isPending} error={rotateError} onConfirm={() => void onRotateConfirm()} onClose={() => setRotateOpen(false)} />
      <MapPointPicker
        open={adjust != null}
        title="Ajustează poziția"
        center={adjust?.center ?? ROMANIA_CENTER}
        initialZoom={adjust?.anchored ? ANCHOR_ZOOM : COUNTRY_ZOOM}
        initialMapType={adjust?.anchored ? 'satellite' : 'standard'}
        onCancel={() => setAdjust(null)}
        onConfirm={onAnchor}
      />
      {recap.lightbox}
      <PartidaFeedbackDialog
        open={feedback != null}
        context={{ entryPoint: feedback ?? 'info', sessionClientId: session.clientId, sessionDocumentId: membershipDocumentId, captures, elapsedMs }}
        onSent={feedback === 'nudge' || nudge.visible ? nudge.answer : undefined}
        onClose={() => setFeedback(null)}
      />
    </div>
  );
}
