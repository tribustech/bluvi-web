'use client';

import Link from 'next/link';
import {
  agoRo,
  barFraction,
  fmtKg,
  fmtSpan,
  isDuelLeader,
  liveCardShape,
  membersLabel,
  standLabel,
  standSuffix,
  venueCountLabel,
  type CommunityActiveSessionDTO,
  type CommunityVenueDTO,
} from '@/core/partide';
import { cn } from '@/components/ui/cn';
import { partideHrefs } from '@/lib/partide-pages';
import { catchesNoun, venuePartidePage } from '@/lib/partide-community';
import { routes } from '@/lib/routes';
import { CardHeader, PartidaCardShell, PhotoStrip, StatStrip } from './card';
import { CardFooter, FOCUS, Kg, MemberFaces } from './parts';
import { useNowTick } from './useNowTick';

/*
 * fish features/partide/components/community/VenueGroup.tsx — one live venue → one card, its shape
 * decided ONLY by how many live partide share the venue (cardModel liveCardShape): 1 → solo, 2 →
 * duel, more → leaderboard (parity partide.comunitate.c13–c15). Every partidă link goes through
 * lib/partide-pages (the partidă page ships in M4): while it is off, a session is plain text and a
 * card whose only destination is a partidă is not a link. Relative times read the shared clock
 * (useNowTick, c22) and exist only in the browser.
 */

const photoTiles = (s: CommunityActiveSessionDTO) => s.photos ?? [];

/** «Ilfov · 2 standuri în duel» (fish venueMetaLine — never standLabel on a count phrase). */
function venueMetaLine(locality: string | null, countLabel: string): string {
  return [locality, countLabel].filter(Boolean).join(' · ');
}

/** Card C — exactly one live partidă: the angler is the title, the venue the meta line. */
function SoloCard({ venue, session }: { venue: CommunityVenueDTO; session: CommunityActiveSessionDTO }) {
  const now = useNowTick();
  const href = partideHrefs.partida(session.documentId);
  const count = session.catchCount ?? 0;
  const last = now != null ? agoRo(now, session.lastCatchAt) : null;
  const left = now == null ? null : last ? `Ultima captură ${last}` : `Începută ${agoRo(now, session.startedAt)}`;
  const photos = photoTiles(session);
  return (
    <PartidaCardShell ribbon={{ variant: 'live', label: 'Live' }} interactive={!!href} testId="venue-card-solo">
      <CardHeader
        thumb={{ kind: 'members', members: session.members }}
        title={membersLabel(session.members)}
        href={href}
        meta={{ strong: venue.name, text: standSuffix(session.standName ?? null).trimStart() || undefined }}
      />
      <StatStrip
        stats={[
          { value: String(count), label: catchesNoun(count) },
          { value: session.totalKg == null ? '—' : fmtKg(session.totalKg), label: 'kg total', accent: true },
          // «de pescuit» needs the clock: the dash until the browser has it.
          { value: now == null ? '—' : fmtSpan(now - new Date(session.startedAt).getTime()), label: 'de pescuit' },
        ]}
      />
      <PhotoStrip photos={photos} total={session.photoCount ?? photos.length} />
      <CardFooter left={<span data-visual-mask>{left}</span>} action={href ? 'Vezi partida' : null} />
    </PartidaCardShell>
  );
}

/** One side of a duel (fish Duel Side): faces, name(s), stand · catches, the kg (leader in the accent). */
function DuelSide({
  session,
  isLeader,
  showKg,
}: {
  session: CommunityActiveSessionDTO;
  isLeader: boolean;
  showKg: boolean;
}) {
  const href = partideHrefs.partida(session.documentId);
  const label = membersLabel(session.members);
  const meta = [standLabel(session.standName), session.catchCount == null ? null : `${session.catchCount} ${catchesNoun(session.catchCount)}`]
    .filter(Boolean)
    .join(' · ');
  const body = (
    <>
      <MemberFaces members={session.members} size={48} />
      <span className="max-w-full truncate t-body-strong text-ink">{label}</span>
      {meta ? <span className="max-w-full truncate t-caption text-muted">{meta}</span> : null}
      {showKg ? (
        <Kg
          value={session.totalKg == null ? '—' : fmtKg(session.totalKg)}
          className={cn('t-num-26', isLeader ? 'text-accent-ink' : 'text-ink')}
          unitClassName="text-muted"
        />
      ) : null}
      {isLeader ? <span className="sr-only">(conduce)</span> : null}
    </>
  );
  const cls = 'relative z-above flex min-w-0 flex-1 flex-col items-center gap-1.75 rounded-control px-1 py-1 text-center';
  return href ? (
    <Link href={href} className={cn(cls, FOCUS, 'transition-colors hover:bg-soft-fill')} data-testid="duel-side">
      {body}
    </Link>
  ) : (
    <div className={cls} data-testid="duel-side">
      {body}
    </div>
  );
}

/** Card B — exactly two live partide, head to head. */
function DuelCard({ venue }: { venue: CommunityVenueDTO }) {
  const now = useNowTick();
  const [a, b] = venue.sessions;
  const aKg = a.totalKg ?? null;
  const bKg = b.totalKg ?? null;
  // fish: the shell and «Vezi duelul» share one destination — the venue's partide page, else side A.
  const href = venuePartidePage(venue) ?? partideHrefs.partida(a.documentId);
  const last = [a.lastCatchAt, b.lastCatchAt].filter((x): x is string => !!x).sort().pop() ?? null;
  const startedLast = [a.startedAt, b.startedAt].sort().pop() as string;
  const left = now == null ? null : last ? `Ultima captură ${agoRo(now, last)}` : `Începută ${agoRo(now, startedLast)}`;
  // fish Duel: the split bar and the delta only when BOTH sides have a measured total; the kg row
  // and the bar only once either side has one.
  const both = aKg != null && bKg != null;
  const any = aKg != null || bKg != null;
  const sum = (aKg ?? 0) + (bKg ?? 0);
  const leftPct = both && sum > 0 ? Math.round(((aKg as number) / sum) * 100) : 50;
  const delta = both ? Math.abs((aKg as number) - (bKg as number)) : 0;
  return (
    <PartidaCardShell ribbon={{ variant: 'duel', label: 'Duel live' }} interactive={!!href} testId="venue-card-duel">
      <CardHeader
        thumb={{ kind: 'image', url: venue.imageUrl }}
        title={venue.name}
        href={href}
        meta={{ text: venueMetaLine(venue.locality, venueCountLabel(venue.sessions.map(s => ({ standName: s.standName ?? null })), true)) }}
      />
      <div className="flex flex-col gap-4 border-t border-hairline pt-4">
        <div className="flex items-start gap-3">
          <DuelSide session={a} isLeader={isDuelLeader(aKg, bKg)} showKg={any} />
          <div className="flex shrink-0 flex-col items-center gap-1.5 pt-3.5">
            <span className="t-label tracking-[0.9px] text-muted">VS</span>
            {delta > 0 ? (
              <Kg value={`+${fmtKg(delta)}`} className="rounded-badge bg-accent-tint px-2 py-1 t-label text-accent-ink" data-testid="duel-delta" />
            ) : null}
          </div>
          <DuelSide session={b} isLeader={isDuelLeader(bKg, aKg)} showKg={any} />
        </div>
        {any ? (
          <span aria-hidden className="flex h-2 overflow-hidden rounded-full bg-soft-fill">
            <span className={cn('h-full', both ? 'bg-accent' : 'bg-soft-fill')} style={{ width: `${leftPct}%` }} />
            <span className={cn('h-full', both ? 'bg-bento-sky' : 'bg-soft-fill')} style={{ width: `${100 - leftPct}%` }} />
          </span>
        ) : null}
      </div>
      <CardFooter left={<span data-visual-mask>{left}</span>} action={href ? 'Vezi duelul' : null} />
    </PartidaCardShell>
  );
}

const RANK_DISC = ['bg-medal-gold text-on-medal', 'bg-medal-silver text-on-medal', 'bg-medal-bronze text-on-medal'];
const BAR_TONES = ['bg-accent-ink', 'bg-accent', 'bg-indigo-4'];

/** Card A — more than two live partide: the venue's live standings by total kg. */
function LeaderboardCard({ venue, viewerUid }: { venue: CommunityVenueDTO; viewerUid: string | null }) {
  const leaderKg = venue.sessions[0]?.totalKg ?? null;
  // fish: shell + «Vezi partidele ›» → the venue's partide page, else the lake page, else the leader.
  const href =
    venuePartidePage(venue) ?? (venue.lakeId ? routes.lake(venue.lakeId) : null) ?? partideHrefs.partida(venue.sessions[0].documentId);
  return (
    <PartidaCardShell ribbon={{ variant: 'live', label: 'Live' }} interactive={!!href} testId="venue-card-leaderboard">
      <CardHeader
        thumb={{ kind: 'image', url: venue.imageUrl }}
        title={venue.name}
        href={href}
        meta={{ text: venueMetaLine(venue.locality, venueCountLabel(venue.sessions.map(s => ({ standName: s.standName ?? null })), false)) }}
      />
      <ol aria-label="Clasament live" className="flex flex-col gap-1 border-t border-hairline pt-3">
        {venue.sessions.map((s, i) => (
          <LeaderboardRow key={s.documentId} session={s} rank={i} leaderKg={leaderKg} isSelf={!!viewerUid && s.members.some(m => m.uid === viewerUid)} />
        ))}
      </ol>
      <CardFooter action={href ? 'Vezi partidele' : null} />
    </PartidaCardShell>
  );
}

function LeaderboardRow({
  session,
  rank,
  leaderKg,
  isSelf,
}: {
  session: CommunityActiveSessionDTO;
  rank: number;
  leaderKg: number | null;
  isSelf: boolean;
}) {
  const total = session.totalKg ?? null;
  const zero = total == null || total === 0;
  const pct = Math.max(2, Math.round(barFraction(total, leaderKg) * 100));
  const stand = standLabel(session.standName);
  const who = membersLabel(session.members);
  const href = partideHrefs.partida(session.documentId);
  const body = (
    <>
      <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-full t-micro-strong', RANK_DISC[rank] ?? 'bg-soft-fill text-ink-2')}>
        {rank + 1}
      </span>
      <span className="sr-only">Locul {rank + 1}: </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex min-w-0 items-baseline gap-1.75">
          {stand ? <span className="shrink truncate t-label text-ink">{stand}</span> : null}
          <span className={cn('min-w-0 truncate', stand ? 't-caption text-muted' : 't-label text-ink')}>{who}</span>
          {isSelf ? <span className="sr-only"> (partida ta)</span> : null}
        </span>
        <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-soft-fill">
          <span className={cn('block h-full rounded-full', zero ? 'bg-hairline' : (BAR_TONES[rank] ?? 'bg-indigo-4'))} style={{ width: `${pct}%` }} />
        </span>
      </span>
      <Kg value={total == null ? '—' : fmtKg(total)} className={cn('shrink-0 t-body-strong tabular-nums', zero ? 'text-muted' : 'text-ink')} unitClassName="text-muted" />
    </>
  );
  const cls = cn('relative z-above flex items-center gap-2.5 rounded-control px-2 py-1.5', isSelf && 'bg-accent-tint');
  return (
    <li data-testid="leaderboard-row" data-self={isSelf || undefined}>
      {href ? (
        <Link href={href} className={cn(cls, FOCUS, 'transition-colors hover:bg-soft-fill')}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}

/**
 * One live venue → one card. `viewerUid` marks the viewer's own leaderboard row («self», fish
 * isSelf) — null while the session is unknown or signed out (rule 4: nothing marked until known).
 */
export function VenueGroup({ venue, viewerUid = null }: { venue: CommunityVenueDTO; viewerUid?: string | null }) {
  if (venue.sessions.length === 0) return null;
  const shape = liveCardShape(venue.sessions.length);
  if (shape === 'solo') return <SoloCard venue={venue} session={venue.sessions[0]} />;
  if (shape === 'duel') return <DuelCard venue={venue} />;
  return <LeaderboardCard venue={venue} viewerUid={viewerUid} />;
}
