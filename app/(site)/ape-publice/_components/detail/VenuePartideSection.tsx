'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { Pill } from '@/components/cards/parts';
import { DetailSection } from '@/components/templates/T3';
import { FaceStack } from '@/components/ui/Avatar';
import { BentoTile } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import {
  barFraction,
  catchesLabel,
  communityVenueSectionQuery,
  elapsedRo,
  fmtKg,
  hasPartideActivity,
  isWeighed,
  liveHeadStats,
  liveRowLabel,
  rowMeta,
  type CommunityActiveSessionDTO,
  type CommunityLakeSectionDTO,
  type CommunityVenueRef,
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { useViewerState } from '../../../_shell/viewer-context';
import { userOf } from '../../../_shell/viewer-state';
import { ActivityChart } from '../venue/ActivityChart';

/*
 * «Partide pe această apă / la această baltă» — fish VenuePartideSection + LivePartideCard (parity
 * public-waters.detaliu.c18–c21, lakes.detail.c20–c22): ONE venue section for a lake
 * (`{kind:'lake', id}`) and a public water (`{kind:'water', code}`). It is the lake page's
 * PartideSection (app/(site)/balti/[id]/_components/PartideSection.tsx) lifted line for line and
 * parameterised by the venue, the title and the targets, so both pages draw the same section.
 * TODO(shared): the lake page still renders its own copy — swap it for this component (pass
 * `venue={{kind:'lake', id}}`, `title="Partide la această baltă"`, its lakeHref targets) and move
 * this file to components/ (the lakes unit owns balti/ and is editing it in parallel).
 *
 * Always mounted: the same query polls every 60s (core communityVenueSectionQuery: refetchInterval
 * 60s, staleTime 30s, c31) and, as TanStack does, keeps the last good data when a refresh fails
 * (c19) — the section never vanishes on a hiccup. Nothing renders while there is no data or the
 * data says the venue has no activity.
 *
 * Targets the web does not have yet are never dead links: without `partideHref` the header has no
 * action and «Vezi toate partidele» is not drawn; without `partidaHref` a live row is a plain row
 * (no «Vezi»).
 */

const BAR_TONES = ['bg-accent-ink', 'bg-accent', 'bg-indigo-4'];

/** A clock that only exists in the browser (null on the server and while hydrating), ticking every 30s. */
const TICK_MS = 30_000;
const subscribeTick = (cb: () => void) => {
  const id = window.setInterval(cb, TICK_MS);
  return () => window.clearInterval(id);
};
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribeTick,
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => null,
  );
}

export function VenuePartideSection({
  venue,
  title,
  partideHref,
  partidaHref,
}: {
  venue: CommunityVenueRef | null;
  title: string;
  /** The venue's partide page; undefined while the web has none. */
  partideHref: string | undefined;
  /** A live partidă's page; undefined while the web has none. */
  partidaHref?: (documentId: string) => string | undefined;
}) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data } = useQuery(communityVenueSectionQuery(t, venue));
  if (!data || !hasPartideActivity(data)) return null;
  return (
    // No partide page on the web yet: no header action at all (the quick actions' «În curând pe
    // web: Partide, …» already says it), never a link-looking «Vezi tot» that goes nowhere.
    <DetailSection id="partide" title={title} action={partideHref ? <SectionAction href={partideHref}>Vezi tot</SectionAction> : undefined}>
      <div className="flex flex-col gap-3.5">
        <Suspense fallback={<LiveCard data={data} viewerUid={null} partidaHref={partidaHref} />}>
          <LiveCardForViewer data={data} partidaHref={partidaHref} />
        </Suspense>
        {data.monthlyActivity.length > 0 ? (
          // fish ActivityLineChart — the one «Activitate» chart of the water's pages (Statistici's too).
          <ActivityChart
            heading="h3"
            points={data.monthlyActivity.map((m) => ({ label: m.month, count: m.count }))}
            noun={['partidă', 'partide']}
            caption="ultimele 7 luni"
            summary={`Activitate în ultimele 7 luni: ${data.monthlyActivity.reduce((a, m) => a + m.count, 0)} partide.`}
          />
        ) : null}
        {/* The header's «Vezi tot» is the one way to the partide page (owner: one entry point). */}
      </div>
    </DetailSection>
  );
}

/** The lake page's section-header action (balti SectionLink.tsx SectionAction). */
function SectionAction({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="-my-3 inline-flex min-h-11 items-center gap-0.5 rounded-badge px-1 t-button-compact text-accent-ink hover:underline">
      {children}
      <ChevronRightIcon aria-hidden className="size-4" />
    </Link>
  );
}

type RowTarget = ((documentId: string) => string | undefined) | undefined;

/** Your own row is marked (fish `isSelf`: an indigo name) once the session is known (c21). */
/** The live card with the viewer's own row marked (also the partide page's first block, c6). */
export function LiveCardForViewer({ data, partidaHref }: { data: CommunityLakeSectionDTO; partidaHref: RowTarget }) {
  const viewer = userOf(useViewerState());
  return <LiveCard data={data} viewerUid={viewer?.documentId ?? null} partidaHref={partidaHref} />;
}

export function LiveCard({ data, viewerUid, partidaHref }: { data: CommunityLakeSectionDTO; viewerUid: string | null; partidaHref: RowTarget }) {
  const now = useNow();
  const { stats, activeSessions: sessions } = data;
  const isLive = stats.activeNow > 0;
  const head = liveHeadStats(sessions);
  // fish LivePartideCard (c20): live with weighed kg → «N kg» + «M capturi» and the biggest-fish
  // box; live and unweighed → the catch count alone; idle → the month's count with «luna aceasta ·
  // record istoric N kg» under it — also when the month has none and there is no record: «0 capturi /
  // luna aceasta», as fish draws it (LivePartideCard.tsx:264-321). Never «0 kg».
  const liveKg = isLive && isWeighed(head.totalKg) ? head.totalKg : null;
  const catches = isLive ? head.catches : stats.catchesThisMonth;
  const record = stats.recordKg != null ? `${fmtKg(stats.recordKg)} kg` : null;
  const leaderKg = sessions[0]?.totalKg ?? null;
  const [count, word] = splitCount(catchesLabel(catches) ?? '0 capturi');
  const meta = liveKg != null ? catchesLabel(head.catches) : isLive ? null : `luna aceasta${record ? ` · record istoric ${record}` : ''}`;

  return (
    <div className="flex flex-col gap-3" data-testid="live-partide-card">
      <BentoTile tone="navy" className="min-h-0">
        {isLive ? (
          <Pill tone="live" className="self-start">
            {stats.activeNow} ACTIVI ACUM
          </Pill>
        ) : null}
        <div className="flex items-end justify-between gap-3">
          {liveKg != null ? (
            <SignatureNumber size="stat" tone="lavender" unitTone="lavender" value={fmtKg(liveKg)} unit=" kg" />
          ) : (
            <SignatureNumber size="stat" tone="lavender" unitTone="lavender" value={count} unit={` ${word}`} />
          )}
          {liveKg != null && head.maxKg != null ? (
            <p className="flex shrink-0 flex-col items-center rounded-card bg-lavender px-3.5 py-2 text-navy">
              <span className="t-body-strong">{fmtKg(head.maxKg)} kg</span>
              <span className="t-micro">cea mai mare</span>
            </p>
          ) : null}
        </div>
        {meta ? <p className="t-caption text-lavender-3">{meta}</p> : null}
      </BentoTile>
      {sessions.length ? (
        <ol aria-label="Partide active acum" className="divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-e0">
          {sessions.map((s, i) => (
            <SessionRow
              key={s.documentId}
              session={s}
              rank={i}
              leaderKg={leaderKg}
              now={now}
              href={partidaHref?.(s.documentId)}
              isSelf={!!viewerUid && s.members.some(m => m.uid === viewerUid)}
            />
          ))}
        </ol>
      ) : null}
    </div>
  );
}

/** «3 capturi» → ['3', 'capturi'] (the number takes the signature size, the word the unit). */
function splitCount(label: string): [string, string] {
  const i = label.indexOf(' ');
  return i < 0 ? [label, ''] : [label.slice(0, i), label.slice(i + 1)];
}

/**
 * One live partidă (fish ActiveRow): rank, the roster's faces, name(s) and total, the rank bar
 * against the leader, «Stand 2 · 3 capturi · max 6,4 kg», «Vezi». The whole row opens the partidă
 * once the web has a partidă page (`href`); until then it is a plain row.
 * TODO(c21): fish useOpenPartida opens YOUR partidă as yours (/partide/{clientId}) and anyone
 * else's as the read-only spectator view — that resolution belongs to the partidă batch.
 */
function SessionRow({
  session,
  rank,
  leaderKg,
  now,
  href,
  isSelf,
}: {
  session: CommunityActiveSessionDTO;
  rank: number;
  leaderKg: number | null;
  now: number | null;
  href: string | undefined;
  isSelf: boolean;
}) {
  const total = session.totalKg ?? null;
  const zero = !isWeighed(total);
  const pct = zero ? 0 : Math.max(2, Math.round(barFraction(total, leaderKg) * 100));
  const meta = rowMeta({
    standName: session.standName,
    catchCount: session.catchCount,
    totalKg: total,
    maxKg: session.maxKg,
    elapsed: now != null ? elapsedRo(now, session.startedAt) : '',
  });
  const label = liveRowLabel(session.members);
  const inner = (
    <>
      <span className={cn('w-3.5 shrink-0 text-center t-label', zero ? 'text-muted' : 'text-accent-ink')}>{rank + 1}</span>
      <FaceStack people={session.members.slice(0, 3).map(m => ({ name: m.name || 'Pescar', src: m.avatarUrl }))} size={32} />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-center gap-3">
          <span className={cn('min-w-0 flex-1 truncate t-body-strong', isSelf ? 'text-accent-ink' : 'text-ink')}>
            {label}
            {isSelf ? <span className="sr-only"> (partida ta)</span> : null}
          </span>
          <span className={cn('shrink-0 t-body-strong tabular-nums', zero ? 'text-muted' : 'text-ink')}>{zero ? '— kg' : `${fmtKg(total)} kg`}</span>
        </span>
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-accent-tint">
          <span className={cn('block h-full rounded-full transition-[width] duration-(--duration-slow)', BAR_TONES[rank] ?? 'bg-indigo-4')} style={{ width: `${pct}%` }} />
        </span>
        <span className="flex items-center gap-2.5">
          <span className="min-w-0 flex-1 truncate t-micro text-muted">
            {meta.stand ? <span className="t-micro-strong text-ink">{meta.stand}</span> : null}
            {meta.stand ? ' · ' : null}
            {now == null && !session.catchCount ? 'la apă' : meta.rest}
          </span>
          {href ? <span className="shrink-0 rounded-full border border-accent px-3 py-0.5 t-micro-strong text-accent-ink">Vezi</span> : null}
        </span>
      </span>
    </>
  );
  const row = 'flex items-center gap-3 px-3.5 py-3';
  const testId = `live-row-${session.documentId}`;
  return (
    <li>
      {href ? (
        <Link href={href} className={cn(row, 'transition-colors hover:bg-soft-fill')} data-testid={testId}>
          {inner}
        </Link>
      ) : (
        <div className={row} data-testid={testId}>
          {inner}
        </div>
      )}
    </li>
  );
}
