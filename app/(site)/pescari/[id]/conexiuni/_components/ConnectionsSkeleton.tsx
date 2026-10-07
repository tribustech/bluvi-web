import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { ListPage, TabsSkeleton } from '@/components/templates/T1';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import { ICON_BUTTON_SIZE } from '@/components/nav/IconButton';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/**
 * The connections grid: one column of row-cards on a phone (fish's list), an auto-fill grid of
 * row-cards from 768 (ROADMAP §4: more columns as the screen grows, never stretched rows).
 * 768–1023: 352px cards, two columns of ~354px at 768 (the compact 124px button leaves ~170px for
 * the name). From 1024 the button is 144px, so 400px cards: two columns at 1280, a long name keeps
 * ~230px. Shared by the list and its skeleton so nothing moves when the rows land.
 */
export const CONNECTIONS_GRID =
  'grid grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(88),1fr))] md:gap-3 lg:grid-cols-[repeat(auto-fill,minmax(--spacing(100),1fr))]';

/**
 * The owner line's box under the h1 (ListHeader's description wrapper + the identity line): one
 * 24px row whatever it holds — the placeholder, the name, or nothing when the profile failed — so
 * the tabs and the rows never move when the angler's profile lands.
 */
export const OWNER_LINE = 'mt-1 flex min-h-6 min-w-0 items-center gap-2';

/** The owner line while the angler's profile loads: the 24px avatar's disc and a ~120px name bar. */
export function OwnerPlaceholder() {
  return (
    <span aria-hidden className={OWNER_LINE} data-testid="connections-owner-pending">
      <span className="size-6 shrink-0 animate-shimmer rounded-full" />
      <span className="h-3.5 w-30 animate-shimmer rounded-full" />
    </span>
  );
}

/**
 * The ≥768 band before the angler's name is known (and when it cannot be): «Acasă / Conexiuni»,
 * the same root as the named trail «Acasă / {nume} / Conexiuni» — never the URL-derived «Pescari»,
 * which is no page of its own here and would read as the current one.
 */
export const UNNAMED_TRAIL: Crumb[] = [{ label: 'Acasă', href: routes.home() }, { label: 'Conexiuni' }];

/**
 * Seven skeleton rows (fish AnglerListSkeleton rows={7} subline={false}, c7): the avatar, the name
 * and the follow button's place — the row's own shape.
 */
export function RowsSkeleton({ count = 7 }: { count?: number }) {
  const widths = ['w-2/5', 'w-1/2', 'w-1/3', 'w-3/5', 'w-2/5', 'w-1/2', 'w-1/3'];
  return (
    <div role="status" data-testid="connections-skeleton">
      <span className="sr-only">Se încarcă…</span>
      <ul aria-hidden className={CONNECTIONS_GRID}>
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="flex min-h-15 items-center gap-3 rounded-card bg-surface p-2.5 shadow-e0">
            <span className="size-10 shrink-0 animate-shimmer rounded-full" />
            <span className={cn('h-3.5 animate-shimmer rounded-full', widths[i % widths.length])} />
            <span className="ml-auto h-10 w-31 shrink-0 animate-shimmer rounded-control lg:w-36" />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The whole page while the gate reads the session (loading.tsx and the page's Suspense fallback):
 * the real title, the owner line's placeholder, the back control's place, the tab row's shape and
 * the rows' skeleton; the band already says «Acasă / Conexiuni». The header
 * mirrors ListHeader's box by hand (its back control needs a client handler).
 */
export function ConnectionsSkeleton() {
  return (
    <>
      <SetBreadcrumb trail={UNNAMED_TRAIL} />
      <ListPage
        header={
          <div className="flex flex-col">
            <div className="flex min-h-12 items-center gap-3 xl:min-h-10">
              <span aria-hidden className={cn(ICON_BUTTON_SIZE, 'shrink-0 rounded-control bg-surface shadow-e0')} />
              <div className="min-w-0 flex-1">
                <h1 className="t-title1 text-ink">Conexiuni</h1>
                <div className="t-caption mt-0.5 text-muted">
                  <OwnerPlaceholder />
                </div>
              </div>
            </div>
            <div className="mt-3 xl:mt-4">
              <TabsSkeleton count={2} />
            </div>
          </div>
        }
      >
        <RowsSkeleton />
      </ListPage>
    </>
  );
}
