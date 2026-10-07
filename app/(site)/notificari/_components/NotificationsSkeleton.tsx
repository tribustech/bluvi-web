import type { ReactNode } from 'react';
import { AsideSkeleton, ListHeader, ListPage } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { ROW_CARD, ROWS } from './styles';

/**
 * The list column. Below 1280 one centred column up to 720 (a phone list; on a tablet the rows would
 * otherwise be 1000px lines of short text). From 1280 capped at 840 — the rows are short lines, never
 * 1300px ones on a 1920 screen.
 */
const COLUMN = 'mx-auto w-full max-w-180 xl:mx-0 xl:max-w-210';

/**
 * From 1280: the list (≤ 840) and the summary column right after it on the template's right track
 * (320 → 360 from 1440, 24 apart: ../tracks.ts). Fixed tracks, so the list never changes width or
 * moves when the summary lands, empties or the page errors.
 * 1280–1439 the pair (≤ 1184) nearly fills the shell column and starts at its left gutter. From 1440
 * the pair (1224) is one group centred in the shell column, the title above the list on the same
 * edge — a feed with its side column, as Facebook's: never a page glued to the left with a third of a
 * 1920 screen blank on the right.
 */
const GROUP = '2xl:mx-auto 2xl:w-full 2xl:max-w-306';
const BODY = cn(
  GROUP,
  'xl:grid xl:items-start xl:gap-6 xl:grid-cols-[minmax(0,--spacing(210))_--spacing(80)] 2xl:grid-cols-[minmax(0,--spacing(210))_--spacing(90)]',
);

/**
 * The page frame (account.notifications, T1 without filters): ListPage's shell (gutters, rhythm)
 * with the header and the rows in COLUMN. From 1280 the summary (`aside`: the unread count, «Citește
 * tot») is docked right of the list, sticky (owner rule 14: a wide screen gets its own layout);
 * below 1280 it is not shown (its count is the top bar's dot, «Citește tot» is in the header).
 * `aside` null (a failed first load) keeps its track empty — nothing moves.
 */
export function NotificationsFrame({ header, aside, children }: { header: ReactNode; aside?: ReactNode; children: ReactNode }) {
  return (
    <ListPage header={<div className={GROUP}><div className={COLUMN}>{header}</div></div>}>
      <div className={BODY}>
        <div className={cn(COLUMN, 'flex flex-col gap-4')}>{children}</div>
        {aside ? (
          <aside aria-label="Rezumat" aria-busy={aside === ASIDE_SKELETON || undefined} className="hidden xl:sticky xl:top-22 xl:flex xl:flex-col xl:gap-4">
            {aside}
          </aside>
        ) : null}
      </div>
    </ListPage>
  );
}

/** The summary column while the list loads: there from the first paint, nothing reflows when it lands. */
export const ASIDE_SKELETON = <AsideSkeleton rows={1} />;

/** First load (account.notifications.c1): the header and rows in the shape of the real ones. */
export function NotificationRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status">
      <span className="sr-only">Se încarcă notificările…</span>
      <ul aria-hidden className={ROWS}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className={ROW_CARD}>
            <span className="size-10 shrink-0 animate-shimmer rounded-full md:size-12" />
            <span className="flex flex-1 flex-col gap-2 py-0.5">
              <span className="h-3.5 w-[70%] rounded-full bg-soft-fill" />
              <span className="h-3 w-[90%] rounded-full bg-soft-fill" />
              <span className="h-2.5 w-28 rounded-full bg-soft-fill" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NotificationsSkeleton() {
  return (
    <NotificationsFrame header={<ListHeader title="Notificări" back={{ href: routes.home(), label: 'Înapoi' }} />} aside={ASIDE_SKELETON}>
      <NotificationRowsSkeleton />
    </NotificationsFrame>
  );
}
