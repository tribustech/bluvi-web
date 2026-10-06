'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Suspense, useMemo, useSyncExternalStore } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { Pill } from '@/components/cards/parts';
import { DetailSection } from '@/components/templates/T3';
import { FaceStack } from '@/components/ui/Avatar';
import { BentoTile, CountTile } from '@/components/ui/BentoTile';
import { buttonClass } from '@/components/ui/Button';
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
} from '@/core/partide';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useViewerState } from '../../../_shell/viewer-context';
import { userOf } from '../../../_shell/viewer-state';
import { lakeHref } from './availability';
import { SectionAction } from './SectionLink';

/*
 * «Partide la această baltă» — fish VenuePartideSection + LivePartideCard (parity lakes.detail.c20
 * – c22). Always mounted (as fish keeps its query live on every lake page): the server seeds the
 * query when its read succeeded (HydrateQueries), otherwise the browser reads it itself; either way
 * the same query polls every 60s (core communityVenueSectionQuery: refetchInterval 60s, staleTime
 * 30s) and, as TanStack does, keeps the last good data when a refresh fails (c21) — so the section
 * never vanishes on a hiccup, and appears while the page is open when a partidă starts. It renders
 * nothing while there is no data or the data says the venue has no activity.
 * TODO(kit): the «Partide» chip follows the server read only; DetailSectionsProvider needs a setter
 * (or `useRegisterSection(id, visible)`) so this query can add / drop it as the section appears /
 * goes. TODO(kit): this section is forked with ape-publice VenuePartideSection — one shared
 * DetailVenuePartide ({kind, id}, seeAllHref) belongs in the kit.
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

export function PartideSection({ lakeId }: { lakeId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const { data } = useQuery(communityVenueSectionQuery(t, { kind: 'lake', id: lakeId }));
  if (!data || !hasPartideActivity(data)) return null;
  const all = lakeHref('partide', routes.lakePartide(lakeId));
  // Until /partide and /statistici are on the web (fish reaches the rankings and the catches from
  // there), this section is their way in: «Clasament» in the header, «Vezi capturile» under the card.
  const ranking = all ? undefined : lakeHref('ranking', routes.lakeRanking(lakeId));
  const catchesHref = all ? undefined : lakeHref('catches', routes.lakeCatches(lakeId));
  return (
    <DetailSection
      id="partide"
      title="Partide la această baltă"
      action={all ? <SectionAction href={all}>Vezi tot</SectionAction> : <SectionAction href={ranking}>Clasament</SectionAction>}
    >
      <div className="flex flex-col gap-3.5">
        <Suspense fallback={<LiveCard data={data} viewerUid={null} />}>
          <LiveCardForViewer data={data} />
        </Suspense>
        {/* The header's «Vezi tot» is the one way to the Partide page (owner: one entry point per
            page — no outline button repeating it, no quick-action tile: QuickActions hides its
            Partide tile while this section is on the page). Until that page is on the web, the
            catches are reached from here. */}
        {!all && catchesHref ? (
          <Link href={catchesHref} className={buttonClass({ variant: 'outline', block: true, className: 'md:w-auto md:self-start' })}>
            Vezi capturile
            <ChevronRightIcon aria-hidden className="size-5" />
          </Link>
        ) : null}
      </div>
    </DetailSection>
  );
}

/** Your own row is marked (fish `isSelf`: an indigo name) once the session is known. */
export function LiveCardForViewer({ data }: { data: CommunityLakeSectionDTO }) {
  const viewer = userOf(useViewerState());
  return <LiveCard data={data} viewerUid={viewer?.documentId ?? null} />;
}

export function LiveCard({ data, viewerUid }: { data: CommunityLakeSectionDTO; viewerUid: string | null }) {
  const now = useNow();
  const { stats, activeSessions: sessions, monthlyActivity } = data;
  const isLive = stats.activeNow > 0;
  const head = liveHeadStats(sessions);
  // fish: live with weighed kg → «N kg» + «M capturi» and the biggest-fish box; otherwise the
  // catch count leads (never «0 kg»). Idle with no catch this month the web leads with the record
  // instead (fish shows «0 capturi» in its biggest type — the loudest line on the page saying zero).
  const liveKg = isLive && isWeighed(head.totalKg) ? head.totalKg : null;
  const catches = isLive ? head.catches : stats.catchesThisMonth;
  const record = stats.recordKg != null ? fmtKg(stats.recordKg) : null;
  const quietMonth = !isLive && catches === 0;
  const leaderKg = sessions[0]?.totalKg ?? null;
  const [count, word] = splitCount(catchesLabel(catches) ?? '0 capturi');

  // Idle: the kit CountTile. A quiet month (nothing caught) is the compact tile — the record as the
  // signature number, «0 capturi luna aceasta» as its caption — never a tall navy block saying zero.
  const tile = isLive ? (
    // TODO(kit): CountTile has no badge slot (the live Pill) nor a right slot («cea mai mare»).
    <BentoTile tone="navy" className="min-h-0">
      <Pill tone="live" className="self-start">
        {stats.activeNow} ACTIVI ACUM
      </Pill>
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
      <p className="t-caption text-lavender-3">{liveKg != null ? catchesLabel(head.catches) : 'la apă acum'}</p>
    </BentoTile>
  ) : quietMonth && record ? (
    // A quiet month: one compact navy row — the record as the signature number, the empty month as
    // its caption — not a tall tile around one data point.
    // From 768 it stands beside the chart (as tall as it): the number on top, the caption at the foot.
    <BentoTile tone="navy" className="min-h-0 flex-row items-center gap-4 py-3.5 md:flex-col md:items-start md:py-4.5">
      <SignatureNumber size="stat" tone="lavender" unitTone="lavender" value={record} unit=" kg" />
      <p className="min-w-0 flex-1 text-right t-caption text-lavender-3 md:flex-none md:text-left">record · 0 capturi luna aceasta</p>
    </BentoTile>
  ) : (
    <CountTile
      label="Luna aceasta"
      value={count}
      unit={` ${word}`}
      caption={record ? `record istoric ${record} kg` : undefined}
      className={quietMonth ? 'min-h-0' : undefined}
    />
  );

  return (
    <div className="flex flex-col gap-3" data-testid="live-partide-card">
      {/* From 768 the tile and the activity chart share a row instead of stacking. */}
      <div className={cn('grid gap-3', monthlyActivity.length > 0 && 'md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]')}>
        {tile}
        {monthlyActivity.length > 0 ? <ActivityChart months={monthlyActivity} /> : null}
      </div>
      {sessions.length ? (
        <ol aria-label="Partide active acum" className="divide-y divide-hairline overflow-hidden rounded-card bg-surface shadow-e0">
          {sessions.map((s, i) => (
            <SessionRow key={s.documentId} session={s} rank={i} leaderKg={leaderKg} now={now} isSelf={!!viewerUid && s.members.some(m => m.uid === viewerUid)} />
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
 * once the web has a partidă page (availability.ts `partida`); until then it is a plain row.
 * TODO(c22): fish useOpenPartida opens YOUR partidă as yours (/partide/{clientId}) and anyone
 * else's as the read-only spectator view — that resolution belongs to the partidă batch.
 */
function SessionRow({
  session,
  rank,
  leaderKg,
  now,
  isSelf,
}: {
  session: CommunityActiveSessionDTO;
  rank: number;
  leaderKg: number | null;
  now: number | null;
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
  const href = lakeHref('partida', routes.partida(session.documentId));
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

/** fish «Activitate · ultimele 7 luni» (ActivityLineChart): one bar per month, the count over it. */
function ActivityChart({ months }: { months: CommunityLakeSectionDTO['monthlyActivity'] }) {
  const max = Math.max(1, ...months.map(m => m.count));
  return (
    <figure className="flex flex-col gap-2.5 rounded-card bg-surface p-3 shadow-e0 md:p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="t-body-strong">Activitate</span>
        <span className="t-micro text-muted">ultimele {months.length} luni</span>
      </figcaption>
      <ul className="flex h-24 items-end gap-2">
        {months.map(m => (
          <li key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span aria-hidden className="t-micro-strong text-ink-2 tabular-nums">
              {m.count || ''}
            </span>
            <span aria-hidden className={cn('w-full max-w-8 rounded-t-badge', m.count ? 'bg-accent' : 'bg-accent-tint-2')} style={{ height: `${Math.max(6, (m.count / max) * 100)}%` }} />
            <span className="t-micro text-muted">
              <span className="sr-only">{`${m.month}: ${m.count} ${m.count === 1 ? 'partidă' : 'partide'}`}</span>
              <span aria-hidden>{m.month}</span>
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
