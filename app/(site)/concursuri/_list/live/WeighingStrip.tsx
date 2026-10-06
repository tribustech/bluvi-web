'use client';

import { LiveDot } from '@/components/templates/LiveDot';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { RecentWeighing } from '@/core/competitions';
import { useNow } from '../desktop/motion';
import { clock } from '../desktop/model';
import { weigherName, weighingSummary } from '../weighing/format';
import { isFresh, shortAgo } from './model';
import { LIVE_CARD, SectionHead } from './parts';
import s from './live.module.css';

/*
 * «Cântăriri recente» (prototype app/dev/hub Live.tsx WeighingStrip): one horizontal strip on top of
 * the Live tab, newest left, across every live competition (GET /feed/recent-weighings, 30s). Each
 * item: the angler's photo (a team: its photo), else the competition's poster — never a blank;
 * «N pești · X kg»; competition · stand · how long ago (red while fresh). Each item opens the
 * weighing's detail (../weighing/WeighingDetail), anchored to it.
 */

export const stripItemId = (w: RecentWeighing) => `cantar-${w.weighingDocumentId}`;

export function WeighingStrip({
  items,
  fresh,
  onOpen,
  headingId = 'cantariri-recente',
}: {
  items: RecentWeighing[];
  /** Items that arrived with the latest poll (they slide in). */
  fresh?: ReadonlySet<string>;
  onOpen?: (w: RecentWeighing, el: HTMLElement) => void;
  headingId?: string;
}) {
  const now = useNow(30_000);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <SectionHead id={headingId} title="Cântăriri recente">
        <span className="flex items-center gap-1.5 t-caption text-muted">
          <LiveDot /> în direct · apasă pentru detalii
        </span>
      </SectionHead>
      <ol className={cn('-mx-4 flex scroll-px-4 gap-2.5 overflow-x-auto px-4 pt-1 pb-2 md:-mx-6 md:scroll-px-6 md:px-6 xl:-mx-8 xl:scroll-px-8 xl:px-8', s.rail)}>
        {items.map((w) => {
          const hot = now != null && isFresh(w.endAt, now);
          return (
            <li key={w.weighingDocumentId} className={cn('shrink-0', fresh?.has(w.weighingDocumentId) && s.slideIn)}>
              <button
                type="button"
                id={stripItemId(w)}
                aria-haspopup="dialog"
                onClick={onOpen ? (e) => onOpen(w, e.currentTarget) : undefined}
                className={cn(
                  LIVE_CARD,
                  'flex w-64 cursor-pointer items-center gap-3 px-3 py-2.5 text-start transition-shadow duration-(--duration-fast) hover:shadow-[var(--shadow-e2),var(--shadow-e0)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                )}
              >
                <StripThumb w={w} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate t-label text-ink">{weigherName(w)}</span>
                  <span className="t-label text-ink-2">{weighingSummary(w)}</span>
                  <span className="flex min-w-0 items-center gap-1 t-micro text-muted">
                    {hot ? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full bg-live text-live', s.ping)} /> : null}
                    <span className="truncate">
                      {w.competition.name} · {w.standLabel}
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={w.endAt} className={cn('shrink-0', hot && 'text-live')} suppressHydrationWarning>
                      {now == null ? clock(w.endAt) : shortAgo(w.endAt, now)}
                    </time>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** The angler's photo (round; a team's square), else the competition's poster, else initials. */
function StripThumb({ w }: { w: RecentWeighing }) {
  if (w.angler?.avatarUrl) return <Avatar name={weigherName(w)} src={w.angler.avatarUrl} size={48} shape={w.angler.isTeam ? 'square' : 'round'} />;
  if (w.competition.posterUrl) return <Avatar name={w.competition.name} src={w.competition.posterUrl} size={48} shape="square" />;
  return <Avatar name={weigherName(w)} size={48} />;
}

/** The strip's bones while the first read answers (signed in only). */
export function WeighingStripSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-3">
      <span className="sr-only">Se încarcă cântăririle recente…</span>
      <span aria-hidden className="h-6 w-48 rounded-full bg-soft-fill" />
      <span aria-hidden className="flex gap-2.5 overflow-hidden pb-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={cn(LIVE_CARD, 'flex w-64 shrink-0 items-center gap-3 px-3 py-2.5')}>
            <span className="size-12 shrink-0 animate-shimmer rounded-full" />
            <span className="flex flex-1 flex-col gap-2">
              <span className="h-3 w-3/4 rounded-full bg-soft-fill" />
              <span className="h-3 w-1/2 rounded-full bg-soft-fill" />
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}
