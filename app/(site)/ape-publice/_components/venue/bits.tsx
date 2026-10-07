'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/20/solid';
import { ChoiceChips, FOCUS_RING, ListHeader, ListTabs, TabsSkeleton } from '@/components/templates/T1';
import { T2Spinner } from '@/components/templates/T2';
import { DashboardRefresh, type RefreshResult } from '@/components/templates/T5';
import { Avatar, toneForName } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { fmtKg, isWeighed, type StatsPeriod } from '@/core/partide';
import { ON_WEB, routes } from '@/lib/routes';
import { PERIOD_OPTIONS } from '@/lib/stats-period';
import { formatCount, pluralNoun } from '@/core/realtime/chat/format';
import { Button } from '@/components/ui/Button';

/*
 * Pieces the public water's community pages share (partide, statistici, clasament, capturi): the
 * header, the period chips, the in-card quiet line, the rows card and its skeleton, the medals,
 * the avatar / photo with a load fallback, the back control. The load error and the empty state
 * are the templates' (T1 ListError / ListEmpty) — never drawn here.
 * TODO(kit): the lake's subpages draw the same pieces (balti/[id]/_sub/stats.tsx) — one venue kit
 * in components/ once both units land (this unit may only touch app/(site)/ape-publice). The two
 * copies already differ (the lake dims text on a period switch, has no refresh, draws its totals as
 * 2×2 cells); this file is the decided treatment the lake should converge on.
 */

/**
 * The header of the four sibling pages (one treatment for the family, parity c2): the back square
 * at every width (fish BackButton — the T1 rule; T5's phone-only back would leave Statistici with
 * none from 768), the title, a caption naming the page when the title is the water's name, and
 * the refresh as the kit's icon control (a 48px square on a phone, so the title keeps the row; the
 * labelled ghost from 768). `onRefresh` omitted: the refresh re-renders the server page (a
 * fallback, before any data). `refresh={false}`: no refresh (Capturi, as fish). `end`: a trailing
 * control instead of the back square (Capturi's ✕).
 */
export function VenueHeader({
  title,
  description,
  backHref,
  onRefresh,
  refresh = true,
  end,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  backHref: string;
  onRefresh?: () => Promise<RefreshResult> | RefreshResult;
  refresh?: boolean;
  end?: ReactNode;
  /** On a T5 frame (DashboardPage has no top inset of its own): VENUE_HEADER_INSET. */
  className?: string;
}) {
  const back = useBack(backHref);
  return (
    <ListHeader
      className={className}
      title={title}
      description={description}
      back={end ? undefined : { label: 'Înapoi', onClick: back }}
      actions={
        refresh || end ? (
          <>
            {refresh ? (
              <span className={REFRESH_ON_PAGE}>
                <DashboardRefresh onRefresh={onRefresh} />
              </span>
            ) : null}
            {end}
          </>
        ) : undefined
      }
    />
  );
}

/**
 * The phone refresh square on the PAGE ground: T5 DashboardRefresh draws T3's soft-fill header chip
 * (made for a surface band), which vanishes on #f4f5fa beside the back square. Here it takes the back
 * square's look (surface + hairline shadow, the kit focus ring) — the same family as ListHeader's
 * back and ListHeaderToggle. `contents`: the refresh's own pieces stay flex items of the actions row.
 * TODO(kit): a `ground="page"` prop on DashboardRefresh (T3 headerChipClass already has the
 * ground) — out of this unit's scope.
 */
const REFRESH_ON_PAGE = cn(
  'contents',
  '[&>button:first-child]:bg-surface [&>button:first-child]:shadow-e0 [&>button:first-child]:hover:bg-soft-fill [&>button:first-child]:hover:brightness-100',
  '[&>button:first-child]:focus-visible:outline-2 [&>button:first-child]:focus-visible:outline-offset-2 [&>button:first-child]:focus-visible:outline-solid [&>button:first-child]:focus-visible:outline-accent',
);

/** ListPage's top inset, for the header on a T5 frame (Statistici). */
export const VENUE_HEADER_INSET = 'pt-4 md:pt-6 xl:pt-8';

/** The h1 while the water's name is read (a route fallback): a bone in the title's line box. */
export function TitleBone({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden className="inline-block h-5 w-48 animate-shimmer rounded-full align-middle md:w-64" />
      <span className="sr-only">{label}</span>
    </>
  );
}

/**
 * fish PeriodChips: three chips + a fixed spinner slot (a period switch in flight). The chips sit on
 * the PAGE ground, where T1 ChoiceChips' soft-fill rest (#f2f4f7 on #f4f5fa) leaves only the
 * selected chip visible as a control (WCAG 1.4.11): the unselected ones rest on surface + hairline
 * shadow here, the selected keeps the kit's accent tint.
 * TODO(kit): a `ground="page"` variant on T1 ChoiceChips (bg-surface + shadow-e0 at rest), as T5
 * DashboardToolbar asks — then drop PAGE_CHIPS.
 */
const PAGE_CHIPS = '[&_label:not(:has(:checked))]:bg-surface [&_label:not(:has(:checked))]:shadow-e0 [&_label:not(:has(:checked)):hover]:bg-soft-fill';

export function PeriodChips({ value, onChange, busy, name = 'perioada' }: { value: StatsPeriod; onChange: (p: StatsPeriod) => void; busy: boolean; name?: string }) {
  return (
    <div className={cn('flex items-center gap-2', PAGE_CHIPS)} data-testid="period-chips">
      <ChoiceChips name={name} label="Perioadă" options={PERIOD_OPTIONS} value={value} onChange={onChange} />
      {/* Fixed slot so the spinner appearing never nudges the chips sideways. */}
      <span className="flex size-6 shrink-0 items-center justify-center text-accent">{busy ? <T2Spinner className="size-5" /> : null}</span>
    </div>
  );
}

/**
 * The period the figures on screen belong to. While a switch loads, TanStack keeps the previous
 * period's data (keepPreviousData) but `period` is already the new one: every label naming the
 * period («Ești pe locul 3 din … luna asta», the aside's «Luna aceasta», the record's tag, the
 * chart's day labels) reads this instead, so it never names the new period over the old figures.
 * `settled`: the query holds the current period's own answer (data, not a placeholder).
 */
export function useShownPeriod(period: StatsPeriod, settled: boolean): StatsPeriod {
  const [shown, setShown] = useState(period);
  if (settled && shown !== period) setShown(period);
  return settled ? period : shown;
}

/** The next wider period, for an empty one (Săptămâna → Luna → Anul curent; the year has none). */
const WIDER: Partial<Record<StatsPeriod, { period: StatsPeriod; label: string }>> = {
  week: { period: 'month', label: 'Vezi luna' },
  month: { period: 'year', label: 'Vezi anul curent' },
};

/**
 * The empty period's way out (Statistici c6, Clasament c4): switch to the next wider period, so an
 * empty «Luna» on a water with partide this year is never a dead end. Nothing for the year.
 */
export function WiderPeriodAction({ period, onChange }: { period: StatsPeriod; onChange: (p: StatsPeriod) => void }) {
  const wider = WIDER[period];
  if (!wider) return null;
  return (
    <Button variant="secondary" onClick={() => onChange(wider.period)} data-testid="wider-period">
      {wider.label}
    </Button>
  );
}

/** A quiet centred line INSIDE a card (fish caption gray5): «Doar podiumul…», the species-empty line. */
export function QuietNote({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p className="px-6 py-4 text-center t-body text-muted" data-testid={testId}>
      {children}
    </p>
  );
}

/** The card ranked rows sit on (fish: white, radius 15, CARD_SHADOW, hairlines between). */
export const ROWS_CARD = 'overflow-hidden rounded-card bg-surface shadow-e0';

/** Rows of grey bones in the rows card (fish RankedRowsCardSkeleton). */
export function RowsSkeleton({ rows = 6, avatar = true }: { rows?: number; avatar?: boolean }) {
  return (
    <ul aria-hidden className={cn(ROWS_CARD, 'divide-y divide-hairline')}>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3">
          <span className="size-6 shrink-0 animate-shimmer rounded-control" />
          {avatar ? <span className="size-8 shrink-0 animate-shimmer rounded-full" /> : null}
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="h-3.5 w-[55%] animate-shimmer rounded-full" />
            <span className="h-3 w-[35%] animate-shimmer rounded-full" />
          </span>
          <span className="h-3.5 w-14 shrink-0 animate-shimmer rounded-full" />
        </li>
      ))}
    </ul>
  );
}

/** The chips row in grey (fish PeriodChipsSkeleton). */
export function ChipsSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex gap-2', className)}>
      {['w-24', 'w-16', 'w-28'].map((w) => (
        <span key={w} className={cn('h-9 animate-shimmer rounded-full', w)} />
      ))}
    </div>
  );
}

/**
 * A period switch over the previous period's figures — the one treatment of both siblings
 * (Statistici c7, Clasament c10; fish dims everything to 40%): a 2px accent bar pulsing over the
 * content (absolute: it takes no room), the chips' spinner, the photos at 50% — the kit never dims
 * text (dimmed text fails AA) — and the content inert meanwhile. The content wrapper is `relative`
 * and carries SWITCHING_DIM while `on`.
 */
export function SwitchingBar({ on }: { on: boolean }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-x-0 -top-2 h-0.5 overflow-hidden rounded-full', on ? 'bg-accent-tint' : 'bg-transparent')}
      data-testid={on ? 'switching-bar' : undefined}
    >
      {on ? <span className="block h-full w-1/3 animate-pulse rounded-full bg-accent motion-reduce:animate-none" /> : null}
    </div>
  );
}

export const SWITCHING_DIM = '[&_img]:opacity-50';

/** One angler as a link to /pescari/<uid> once the web has that page (fish openAngler), else a block. */
export function AnglerLink({ uid, label, className, children }: { uid: string; label?: string; className?: string; children: ReactNode }) {
  if (!ON_WEB.angler) return <div className={className}>{children}</div>;
  return (
    <Link
      href={routes.angler(uid)}
      aria-label={label}
      className={cn('transition-colors hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent', className)}
    >
      {children}
    </Link>
  );
}

/**
 * Whether a photo failed to load. `onError` alone misses a photo that failed before hydration (the
 * server HTML's <img> errors before React listens), so the ref also reads a finished, empty image.
 */
export function usePhotoFailed(src: string | null | undefined) {
  const [failed, setFailed] = useState<string | null>(null);
  const check = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && src && img.complete && img.naturalWidth === 0) setFailed(src);
    },
    [src],
  );
  return [!!src && failed === src, check, () => setFailed(src ?? null)] as const;
}

const AVATAR_PX = { 24: 'size-6', 32: 'size-8', 44: 'size-11', 48: 'size-12', 64: 'size-16' } as const;

/**
 * fish avatarColorFor(uid) + its photo: the initials disc on the angler's tone is always drawn and
 * the photo lies over it — a slow photo shows the initials meanwhile, and a photo the CMS no longer
 * serves (deleted, expired) leaves the initials, never the browser's broken-image glyph.
 * TODO(kit): the same fallback in components/ui/Avatar (and FaceStack) — out of this unit's scope.
 */
export function AnglerAvatar({ uid, name, src, size, ring, className }: { uid: string; name: string; src: string | null; size: keyof typeof AVATAR_PX; ring?: boolean; className?: string }) {
  const [failed, check, onError] = usePhotoFailed(src);
  return (
    <span className={cn('relative inline-flex shrink-0 rounded-full', AVATAR_PX[size], className)} data-testid="angler-avatar">
      <Avatar name={name} src={null} size={size} tone={toneForName(uid)} ring={ring} />
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote CMS photo at avatar size.
        <img
          ref={check}
          src={src}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={onError}
          className={cn('absolute rounded-full object-cover', ring ? 'inset-0.5 size-[calc(100%-(--spacing(1)))]' : 'inset-0 size-full')}
        />
      ) : null}
    </span>
  );
}

/** A row of overlapping faces (the kit FaceStack's look, on AnglerAvatar's fallback). */
export function FaceRow({ people }: { people: { uid: string; name: string; src: string | null }[] }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center *:not-first:-ml-2">
      {people.map((p) => (
        <AnglerAvatar key={p.uid} uid={p.uid} name={p.name} src={p.src} size={32} ring />
      ))}
    </span>
  );
}

/**
 * A CMS photo that disappears when it fails to load, leaving its box's ground (soft-fill, navy) —
 * never the broken-image glyph. For the rail tiles, the history cards' strip, the record hero.
 */
export function SafePhoto({ src, className, loading = 'lazy' }: { src: string; className?: string; loading?: 'lazy' | 'eager' }) {
  const [failed, check, onError] = usePhotoFailed(src);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element -- CMS rendition, already sized.
  return <img ref={check} src={src} alt="" loading={loading} onError={onError} className={className} />;
}

/**
 * The document's entry path (the page the browser loaded, not a client navigation): the
 * navigation entry's URL — fixed for the document's life, unlike `document.referrer`, which never
 * changes during client navigations.
 */
let entryPath: string | null = null;
function documentEntryPath(): string {
  if (entryPath === null) {
    try {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      entryPath = nav ? new URL(nav.name).pathname : window.location.pathname;
    } catch {
      entryPath = window.location.pathname;
    }
  }
  return entryPath;
}

/**
 * fish BackButton (router.back()): back in history when this page was reached by a navigation
 * inside the site (the current path is not the one the document was loaded on), otherwise (a
 * shared link, a new tab, a search result) the water's page — never out of the site.
 */
export function useBack(fallbackHref: string) {
  const router = useRouter();
  return () => {
    if (window.location.pathname !== documentEntryPath()) router.back();
    else router.push(fallbackHref);
  };
}

/**
 * Pescari / Specii (forms SegmentedControl) on the PAGE ground: its soft-fill tray vanishes there
 * (the «Specii» half reads as bare text), so the tray rests on surface + hairline shadow and the
 * chosen segment takes the chips' accent tint (one «selected» look for the page's two choices).
 * TODO(kit): a `ground="page"` variant on SegmentedControl — out of this unit's scope.
 */
export const SEGMENT_ON_PAGE =
  '[&>div]:bg-surface [&>div]:shadow-e0 [&_label:has(:checked)]:bg-accent-tint [&_label:has(:checked)]:text-accent-ink [&_label:has(:checked)]:shadow-none';

/** The four sibling pages of a water. */
export type WaterPage = 'partide' | 'statistici' | 'clasament' | 'capturi';

/**
 * «Pe această apă» — the water's four community pages, the same list in the left column of every
 * sibling from 1280 (the current one marked, aria-current="page"), so moving between them works
 * the same way on each. Statistici and Clasament carry the period in view.
 */
function waterPages(waterKey: string, period?: StatsPeriod): { key: WaterPage; label: string; href: string }[] {
  return [
    { key: 'partide', label: 'Partide', href: routes.publicWaterPartide(waterKey) },
    { key: 'statistici', label: 'Statistici', href: routes.publicWaterStats(waterKey, period) },
    { key: 'clasament', label: 'Clasament', href: routes.publicWaterRanking(waterKey, period) },
    { key: 'capturi', label: 'Capturi', href: routes.publicWaterCatches(waterKey) },
  ];
}

export function WaterPages({
  waterKey,
  current,
  period,
  eyebrow = true,
}: {
  waterKey: string;
  current: WaterPage;
  period?: StatsPeriod;
  /** false when the column holding the list is itself titled «Pe această apă» (Partide). */
  eyebrow?: boolean;
}) {
  const pages = waterPages(waterKey, period);
  return (
    <nav aria-label="Pe această apă" className="flex min-w-0 flex-col" data-testid="water-pages">
      {/* FilterSection's legend look (a nav, not a fieldset: these are links, not a choice). */}
      {eyebrow ? (
        <p aria-hidden className="mb-2.5 t-eyebrow text-muted uppercase">
          Pe această apă
        </p>
      ) : null}
      <ul className="-mx-2 flex flex-col gap-0.5">
        {pages.map((p) => {
          const on = p.key === current;
          return (
            <li key={p.key}>
              <Link
                href={p.href}
                aria-current={on ? 'page' : undefined}
                className={cn(
                  'flex min-h-10 items-center justify-between gap-2 rounded-control px-2 py-2 t-body transition-colors duration-(--duration-fast)',
                  on ? 'bg-accent-tint text-accent-ink' : 'text-ink-2 hover:bg-soft-fill hover:text-ink',
                  FOCUS_RING,
                )}
              >
                {p.label}
                {on ? null : <ChevronRightIcon aria-hidden className="size-5 text-muted" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * «Pe această apă» below 1280 (phone, tablet): the same four pages as the left column, as the kit's
 * underline tab row (link mode, aria-current on the current one) under the header — the sibling
 * pages are places, so they look like tabs (owner rules 2, «tabs that look like tabs»). From 1280
 * the left column's list takes over and this row is gone.
 */
export function WaterTabs({ waterKey, current, period, className }: { waterKey: string; current: WaterPage; period?: StatsPeriod; className?: string }) {
  return (
    <div className={cn('mt-3 md:mt-4 xl:hidden', className)} data-testid="water-tabs">
      <ListTabs label="Pe această apă" tabs={waterPages(waterKey, period)} active={current} />
    </div>
  );
}

/** WaterTabs' place while the page's data loads (same height: nothing moves when it lands). */
export function WaterTabsSkeleton() {
  return (
    <div className="mt-3 md:mt-4 xl:hidden">
      <TabsSkeleton count={4} />
    </div>
  );
}

/**
 * «The period in numbers» — fish StatStrip: ONE compact white card, three columns split by
 * hairlines, the value (title2) over its lowercase label. The one look of both siblings (Statistici
 * under the header, Clasament's right column): no bento tiles with an empty lower half. D1: no kg.
 */
export function PeriodNumbers({ totals, label = 'Perioada, pe scurt', className }: { totals: { partide: number; anglers: number; catches: number }; label?: string; className?: string }) {
  const cells = [
    { key: 'partide', value: totals.partide, label: pluralNoun(totals.partide, 'partidă', 'partide') },
    { key: 'anglers', value: totals.anglers, label: pluralNoun(totals.anglers, 'pescar', 'pescari') },
    { key: 'catches', value: totals.catches, label: pluralNoun(totals.catches, 'captură', 'capturi') },
  ];
  return (
    <dl aria-label={label} className={cn(ROWS_CARD, 'grid grid-cols-3 divide-x divide-hairline py-3', className)} data-testid="stat-strip">
      {cells.map((c) => (
        <div key={c.key} className="flex min-w-0 flex-col-reverse items-center gap-0.5 px-2">
          <dt className="t-micro text-muted">{c.label}</dt>
          <dd className="t-title2 text-ink tabular-nums">{c.value.toLocaleString('ro-RO')}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * The 48 slot of a T1 / T5 empty card: a 24 outline glyph on the accent-tint disc — what has not
 * happened on the water yet, never ListEmpty's default «your search found nothing» glyph.
 */
export function EmptyIcon({ children }: { children: ReactNode }) {
  return <span className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">{children}</span>;
}

/** A weight that means «nothing weighed» (0 / missing, core isWeighed) reads «—», never as a figure to highlight. */
export const kgText = (kg: number | null | undefined) => (isWeighed(kg) ? `${fmtKg(kg)} kg` : '— kg');


/**
 * An angler's figure in a ranking: the weight when something was weighed, otherwise the catches —
 * what the ranking then ordered by (catches, then partide), so an unweighed podium still says why
 * 1st is 1st instead of three «— kg». Callers mute it when !isWeighed.
 */
export const scoreText = (a: { totalKg: number | null | undefined; catches: number }) =>
  isWeighed(a.totalKg) ? kgText(a.totalKg) : formatCount(a.catches, 'captură', 'capturi');

/**
 * The podium's figure: scoreText, except that an unweighed place with no catch shows what put it
 * there — its partide (rankAnglers' last key) — never a medal over «0 capturi» (rule 4).
 */
export const podiumScoreText = (a: { totalKg: number | null | undefined; catches: number; partide: number }) =>
  !isWeighed(a.totalKg) && a.catches === 0 ? formatCount(a.partide, 'partidă', 'partide') : scoreText(a);

/**
 * An angler row's subtitle: «N partide · N capturi» beside a weight; nothing weighed, the figure on
 * the right is already the catches (scoreText), so the subtitle is the partide alone.
 */
export const anglerSubtitle = (a: { totalKg: number | null | undefined; catches: number; partide: number }) =>
  isWeighed(a.totalKg)
    ? `${formatCount(a.partide, 'partidă', 'partide')} · ${formatCount(a.catches, 'captură', 'capturi')}`
    : formatCount(a.partide, 'partidă', 'partide');

/**
 * The CMS ranks a period's anglers by kg, ties by uid (stats-aggregates rankAnglers): when nothing
 * was weighed — the common case on a public water — the order is the uids', meaningless. Within a
 * group tied on kg the web orders by catches, then partide (the uid order kept after that), so
 * the figure shown beside each place (scoreText) explains it. A weighed ranking is unchanged.
 * Proposed server-side in docs/private/cms-patches/M1-community-ranking-ties.md (then fish agrees).
 */
export function rankAnglers<T extends { totalKg: number; catches: number; partide: number }>(anglers: T[]): T[] {
  return anglers
    .map((a, i) => ({ a, i }))
    .sort((x, y) => y.a.totalKg - x.a.totalKg || y.a.catches - x.a.catches || y.a.partide - x.a.partide || x.i - y.i)
    .map((x) => x.a);
}
