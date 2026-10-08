'use client';

import Link from 'next/link';
import { ChevronRightIcon, MapPinIcon } from '@heroicons/react/20/solid';
import { useQuery } from '@tanstack/react-query';
import { LiveDot } from '@/components/templates/LiveDot';
import { Avatar } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { InlineNumber, SignatureNumber } from '@/components/ui/SignatureNumber';
import { entrantsCount, formatKg, formatTotalKg, rankingsQuery, type CompetitionCard, type RecentWeighing } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { routes } from '@/lib/routes';
import { photoRequestOf, posterOf, type PhotoRequest } from '../cards/parts';
import { LIVE_POLL_MS } from '../desktop/data';
import { gapOf, miniRanking, valueText, type MiniRanking } from '../desktop/model';
import { useNow } from '../desktop/motion';
import { PLACEHOLDER_RECENT_WEIGHINGS } from '../placeholders';
import { SignedOutGate } from '../SignedOutGate';
import { weigherName } from '../weighing/format';
import { avatarsOf, isFresh, shortAgo, unitWord } from './model';
import { LIVE_CARD, PosterThumb, SectionHead } from './parts';
import { PLACEHOLDER_BOARD } from './placeholders';
import { stripItemId } from './WeighingStrip';
import s from './live.module.css';

/*
 * One live competition (prototype app/dev/hub Live.tsx SingleLive): the grid collapses into one rich
 * view — the competition (poster → photo viewer, the name → its page), its leader in a signature
 * number with the chase line «Locul 2 X la Y», the ranking's top five, the card's figures and its
 * own «Cântăriri recente» (each opens the weighing's detail). The leaderboard and the weighings
 * are blurred over fake data for a signed-out visitor (../SignedOutGate); the figures are the card's
 * own (public). The ranking re-reads every 60s with the list, only while the page is visible.
 */

export type BoardRow = { key: string; position: number; name: string; avatar: string | null; sub: string | null; value: string; unit: string };
export type BoardModel = {
  leader: { name: string; avatar: string | null; value: string; unit: string } | null;
  second: { name: string; gap: string; unit: string } | null;
  rows: BoardRow[];
};

/** The ranking's top five (rows that weighed something), in the ranking's own unit. */
export function boardOf(r: MiniRanking): BoardModel {
  // kg read as the cards do (one decimal, formatTotalKg); points keep their halves.
  const fig = (v: number) => (r.unit === 'kg' ? formatTotalKg(v) : valueText(v, r.unit));
  const rows = r.rows.filter((x) => x.catches > 0 && x.value != null).slice(0, 5);
  const [a, b] = rows;
  const gap = a && b ? gapOf(r, a, b) : null;
  return {
    leader: a ? { name: a.name, avatar: a.avatar, value: fig(a.value!), unit: unitWord(r.unit, a.value!) } : null,
    second: b && gap != null ? { name: b.name, gap: r.unit === 'kg' ? formatKg(gap) : valueText(gap, r.unit), unit: unitWord(r.unit, gap) } : null,
    rows: rows.map((x) => ({
      key: x.key,
      position: x.position,
      name: x.name,
      avatar: x.avatar,
      // «A1» already names its sector: «Stand A1», not «Sector A · Stand A1».
      sub: x.stand ? `Stand ${x.stand}` : x.sector ? `Sector ${x.sector}` : null,
      value: fig(x.value!),
      unit: unitWord(r.unit, x.value!),
    })),
  };
}

export function SingleLive({
  c,
  t,
  signedIn,
  mine,
  priority = false,
  weighings,
  onOpenWeighing,
  onOpenPhoto,
}: {
  c: CompetitionCard;
  t: Transport;
  signedIn: boolean;
  mine: boolean;
  /** The poster is the view's first image above the fold (LCP): load it eagerly. */
  priority?: boolean;
  /** This competition's recent weighings (null: unknown — the block hides). */
  weighings: RecentWeighing[] | null;
  onOpenWeighing: (w: RecentWeighing, el: HTMLElement) => void;
  onOpenPhoto: (p: PhotoRequest) => void;
}) {
  const ranking = useQuery({ ...rankingsQuery(t, c.documentId, 'started'), enabled: signedIn, refetchInterval: LIVE_POLL_MS });
  const photo = photoRequestOf(c);
  const start = c.hoursLabel?.split(/[–-]/)[0]?.trim();
  const r = c.results;
  return (
    <section aria-labelledby="live-unic" className={cn(LIVE_CARD, s.rise, 'overflow-hidden')}>
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex min-w-0 flex-col gap-6 p-5 xl:p-8">
          <div className="flex items-start gap-4">
            {photo ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenPhoto(photo);
                }}
                aria-label={`Mărește afișul: ${c.name}`}
                className="shrink-0 cursor-zoom-in rounded-card"
              >
                <PosterThumb src={posterOf(c).thumb} priority={priority} />
              </button>
            ) : (
              <PosterThumb src={null} />
            )}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 t-eyebrow text-live uppercase">
                <LiveDot /> Live{start ? ` · start ${start}` : ''}
                {c.joinedCount ? ` · ${entrantsCount(c.joinedCount, c.format.unit)}` : ''}
                {mine ? <span className="text-accent-ink">· Concursul tău</span> : null}
              </span>
              <h2 id="live-unic" className="t-title1 text-ink">
                <Link href={routes.competition(c.documentId)} className="rounded-control hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {c.name}
                </Link>
              </h2>
              {c.lake ? (
                <span className="flex min-w-0 items-center gap-1 t-label text-accent-ink">
                  <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
                  <span className="truncate">{[c.lake.name, c.lake.county?.name].filter(Boolean).join(' · ')}</span>
                </span>
              ) : null}
            </div>
            {signedIn && weighings?.[0] ? <Freshness iso={weighings[0].endAt} /> : null}
          </div>

          {signedIn ? (
            ranking.data ? (
              <Board m={boardOf(miniRanking(ranking.data, avatarsOf(c)))} />
            ) : ranking.isError ? null : (
              <BoardBones />
            )
          ) : (
            <SignedOutGate cta="Intră în cont ca să vezi clasamentul live">
              <Board m={PLACEHOLDER_BOARD} />
            </SignedOutGate>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href={routes.competitionRanking(c.documentId)} className={buttonClass({ variant: 'primary', size: 'compact' })}>
              Vezi clasamentul
            </Link>
            <Link href={routes.competitionWeighings(c.documentId)} className={buttonClass({ variant: 'secondary', size: 'compact' })}>
              Toate cântarele
            </Link>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-page p-5 xl:p-6">
          {r?.hasCatches ? (
            <div className="grid grid-cols-2 gap-3">
              <Fact label="Capturi" value={String(r.catchCount)} />
              {r.totalKg != null ? <Fact label="Total cântărit" value={formatTotalKg(r.totalKg)} unit="kg" /> : null}
              {r.biggestFishKg != null ? <Fact label="Cea mai mare captură" value={formatKg(r.biggestFishKg)} unit="kg" wide /> : null}
            </div>
          ) : r ? (
            <p className="rounded-card bg-surface p-4 t-body text-muted">Încă nu sunt capturi înregistrate.</p>
          ) : null}
          {signedIn ? (
            weighings && weighings.length ? (
              <Ticker items={weighings} onOpen={onOpenWeighing} />
            ) : null
          ) : (
            <SignedOutGate>
              <Ticker items={PLACEHOLDER_RECENT_WEIGHINGS} />
            </SignedOutGate>
          )}
        </div>
      </div>
    </section>
  );
}

/** How long since the competition's latest weighing (red while fresh). */
function Freshness({ iso }: { iso: string }) {
  const now = useNow(30_000);
  if (now == null) return null;
  const fresh = isFresh(iso, now);
  return (
    <span className={cn('flex shrink-0 items-center gap-1.5 t-label whitespace-nowrap', fresh ? 'text-live' : 'text-muted')}>
      {fresh ? <span aria-hidden className={cn('size-1.5 rounded-full bg-live text-live', s.ping)} /> : null}
      <time dateTime={iso}>{shortAgo(iso, now)}</time>
    </span>
  );
}

const PLACE_DISC = ['bg-medal-gold text-on-medal', 'bg-medal-silver text-on-medal', 'bg-medal-bronze text-on-medal'] as const;

function Board({ m }: { m: BoardModel }) {
  if (!m.leader) return <p className="t-body text-muted">Încă nu sunt capturi cântărite.</p>;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 md:grid-cols-[auto_minmax(0,1fr)] md:items-end md:gap-10">
        <div className="flex flex-col gap-2">
          <span className="flex items-center gap-2 t-eyebrow text-muted uppercase">
            <Avatar name={m.leader.name} src={m.leader.avatar} size={24} /> Lider · {m.leader.name}
          </span>
          <SignatureNumber value={m.leader.value} unit={m.leader.unit} size="count" />
        </div>
        {m.second ? (
          <span className="flex min-w-0 items-baseline gap-1 t-caption text-muted">
            <span className="shrink-0">Locul 2</span>
            <span className="truncate t-label text-ink-2">{m.second.name}</span>
            <span className="shrink-0">la</span>
            <InlineNumber value={m.second.gap} unit={m.second.unit} valueClassName="t-label text-ink-2" className="shrink-0" />
          </span>
        ) : null}
      </div>
      <ol aria-label="Clasament acum" className="flex flex-col">
        {m.rows.map((r, i) => (
          <li key={r.key} className="flex items-center gap-3 border-b border-hairline py-2.5 last:border-b-0">
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-full t-num-16', PLACE_DISC[i] ?? 'bg-soft-fill text-ink-2')}>{r.position}</span>
            <Avatar name={r.name} src={r.avatar} size={32} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate t-body-strong text-ink">{r.name}</span>
              {r.sub ? <span className="truncate t-caption text-muted">{r.sub}</span> : null}
            </span>
            <InlineNumber value={r.value} unit={r.unit} valueClassName="t-body-strong text-ink" className="shrink-0" />
          </li>
        ))}
      </ol>
    </div>
  );
}

function BoardBones() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-4">
      <span className="sr-only">Se încarcă clasamentul…</span>
      <span aria-hidden className="h-12 w-48 animate-shimmer rounded-control" />
      {[0, 1, 2].map((i) => (
        <span key={i} aria-hidden className="h-10 animate-shimmer rounded-control" />
      ))}
    </div>
  );
}

function Fact({ label, value, unit, wide }: { label: string; value: string; unit?: string; wide?: boolean }) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-card bg-surface p-4', wide && 'col-span-2')}>
      <span className="t-label text-muted">{label}</span>
      <SignatureNumber value={value} unit={unit} size="fact" />
    </div>
  );
}

/** This competition's recent weighings, a vertical list; each line opens the weighing's detail. */
function Ticker({ items, onOpen }: { items: RecentWeighing[]; onOpen?: (w: RecentWeighing, el: HTMLElement) => void }) {
  const now = useNow(30_000);
  return (
    <section aria-labelledby="live-unic-cantariri" className="flex flex-col gap-2 rounded-card bg-surface p-4">
      <SectionHead id="live-unic-cantariri" title="Cântăriri recente">
        <span className="flex items-center gap-1.5 t-caption text-muted">
          <LiveDot /> în direct
        </span>
      </SectionHead>
      <ol className="-mx-2 flex flex-col max-md:[&>li:nth-child(n+7)]:hidden">
        {items.slice(0, 10).map((w) => (
          <li key={w.weighingDocumentId} className="border-b border-hairline last:border-b-0">
            <button
              type="button"
              id={stripItemId(w)}
              aria-haspopup="dialog"
              onClick={onOpen ? (e) => onOpen(w, e.currentTarget) : undefined}
              className="flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2.5 text-start transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
            >
              <Avatar name={weigherName(w)} src={w.angler?.avatarUrl} size={32} shape={w.angler?.isTeam ? 'square' : 'round'} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate t-body-strong text-ink">{weigherName(w)}</span>
                <span className="truncate t-caption text-muted">
                  {w.standLabel} ·{' '}
                  <time dateTime={w.endAt} suppressHydrationWarning>
                    {now == null ? '' : shortAgo(w.endAt, now)}
                  </time>
                </span>
              </span>
              <InlineNumber value={formatKg(w.totalKg)} unit="kg" valueClassName="t-body-strong text-ink" className="shrink-0" />
              <ChevronRightIcon className="size-4 shrink-0 text-faint" aria-hidden />
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
