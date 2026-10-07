'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CaptureSpamGuard, clearCaptureConfirmed, isCaptureConfirmed, spamSecondsAgo } from '@/components/partide/capture';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { partideHrefs } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../../_shell/SiteHeader';
import type { LocalEvent } from '@/core/partide';
import { useLivePartide, useLiveSession, useOnline } from '../../../_live';
import { venueName } from '../../_member/model';
import { CaptureForm } from './CaptureForm';
import { CaptureDownloadFailed, CaptureNotFound, CaptureSkeleton } from './states';

/** How long the skeleton waits for the first live snapshot before saying it could not download. */
const SNAPSHOT_WAIT_MS = 8_000;

/*
 * The capture page's client half (parity partide.captura c1; fish captura.tsx usePartidaDetail):
 * the form needs the viewer's LIVE partidă with this documentId — the live layer's pointer
 * (GET /feed/sessions/active) and its realtime projection. While the pointer resolves or the first
 * snapshot is in flight: the skeleton. No pointer for this id (not a member, ended, unknown) or a
 * finished partidă: «Partida nu a fost găsită.» + «Înapoi». A pointer whose snapshot never comes:
 * «Nu am putut descărca partida» + «Reîncearcă» / «Înapoi».
 *
 * The spam soft-confirm for a link entry point (the dock, a deep link; partide.partida-lansete.c8):
 * a NEW capture in a rod bucket (or the free bucket) that logged a capture < 30 s ago asks first,
 * unless the screen that opened the flow already asked (useCaptureFlow's token). «Anulează» goes
 * back.
 */
export function CaptureScreen({ documentId, rodParam, editParam }: { documentId: string; rodParam: number | null; editParam: string | null }) {
  const live = useLivePartide();
  const online = useOnline();
  const { pointer, session, events } = useLiveSession(documentId);
  const router = useRouter();

  const ready = live.ready && live.uid != null;
  const notFound = ready && (!pointer || (session != null && session.endedAt != null));
  const loaded = ready && !!session && session.endedAt == null;

  // The pointer names this partidă but no snapshot came (an ad-blocker on Firestore, the projection
  // being rebuilt, offline with nothing cached, the listener recovering): after a bounded wait — at
  // once when offline or recovering — «Nu am putut descărca partida» with «Reîncearcă» / «Înapoi»
  // instead of an endless skeleton (the member page's PreparingState / DownloadFailed).
  const waiting = ready && !!pointer && !session;
  const [waitExpired, setWaitExpired] = useState(false);
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setTimeout(() => setWaitExpired(true), SNAPSHOT_WAIT_MS);
    return () => clearTimeout(t);
  }, [waiting]);
  const downloadFailed = waiting && (waitExpired || !online || live.state.reconnecting);

  // The gate — and the edit target — are decided once, when the session first shows (derived during
  // render; the token the opening screen left is cleared afterwards). An `editare` id that matches no
  // capture (deleted by a teammate, not a capture, a stale link) is a NEW capture everywhere: the
  // title, the breadcrumb and the spam gate (fish captura.tsx: a missing id → a new capture).
  // «Now» is the page's arrival (a render must stay pure); the session loads within a moment of it.
  const [arrivedAt] = useState(() => Date.now());
  const [gate, setGate] = useState<{ secondsAgo: number | null; editEvent: LocalEvent | null } | null>(null);
  if (loaded && session && gate === null) {
    const editEvent = editParam ? (events.find(e => e.clientId === editParam && e.outcome === 'capture') ?? null) : null;
    const bucket = rodParam != null && session.rods.some(r => r.index === rodParam) ? rodParam : 'free';
    const asked = editEvent != null || isCaptureConfirmed(documentId, bucket, arrivedAt);
    setGate({ secondsAgo: asked ? null : spamSecondsAgo(events, session.clientId, bucket, arrivedAt), editEvent });
  }
  useEffect(() => {
    if (gate) clearCaptureConfirmed();
  }, [gate]);

  const title = gate?.editEvent ? 'Editează captura' : 'Captură nouă';
  const crumbs = [
    { label: 'Partide', href: routes.partide() },
    ...(session ? [{ label: venueName(session), href: partideHrefs.partida(documentId) ?? undefined }] : []),
    { label: title },
  ];

  if (notFound) {
    return (
      <>
        <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: title }]} />
        <CaptureNotFound documentId={documentId} />
      </>
    );
  }
  if (downloadFailed) {
    return (
      <>
        <SetBreadcrumb trail={crumbs} />
        <CaptureDownloadFailed documentId={documentId} />
      </>
    );
  }
  if (!loaded || !session || !gate) {
    return <CaptureSkeleton />;
  }
  return (
    <>
      <SetBreadcrumb trail={crumbs} />
      <CaptureForm documentId={documentId} session={session} rodParam={rodParam} editEvent={gate.editEvent} />
      <CaptureSpamGuard
        secondsAgo={gate.secondsAgo}
        onConfirm={() => setGate({ ...gate, secondsAgo: null })}
        onCancel={() => {
          setGate({ ...gate, secondsAgo: null });
          if (canGoBackInApp()) router.back();
          else router.replace(partideHrefs.partida(documentId) ?? routes.partide());
        }}
      />
    </>
  );
}
