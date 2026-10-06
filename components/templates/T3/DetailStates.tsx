import type { CSSProperties, ReactNode } from 'react';
import { ExclamationCircleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { SadSearchIcon } from '@/components/icons/brand';
import { BreadcrumbBand, type Crumb } from '@/components/nav/Breadcrumbs';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { DetailActionBar } from './DetailActionBar';
import { DetailHeader, headerChipClass } from './DetailHeader';
import { DetailBand, DetailPage } from './DetailPage';
import { photoHeroHeight } from './DetailPhotoHero';
import { FULL_BLEED_HAIRLINE, FULL_BLEED_SURFACE } from './metrics';
import { STATE_CARD_FRAME } from '../stateCard';
import { TRACK_GAP, TRACKS } from '../tracks';
import { RING_DANGER } from '../rings';

/*
 * T3 states. Empty sections use the kit EmptyState inside their <DetailSection>; these cover the
 * whole page (loading, error, not found) and the signed-out gate of one section.
 *
 * Every whole-page state keeps the way out: the breadcrumb band from 768 (`trail`: while loading
 * its current crumb is a placeholder; in the settled error / not-found states a real one) and, on the phone, the header's back chip (`back`, a <DetailBackButton>)
 * where the loaded page has it — parity lakes.detail.c1 / c2 («skeleton + back», «error + retry»).
 * And every one has an <h1>, so heading navigation still lands somewhere.
 */

const SHIMMER = 'rounded-full animate-shimmer';
const BLOCK = 'animate-shimmer';

/**
 * A text bone: a grey bar inside a line of the given type step (`className` carries the step and
 * the line's width), so the line is exactly as tall as the loaded text at every width — the type
 * steps change at 1280 and the bone follows them for free.
 */
function Line({ className, style }: { className: string; style?: CSSProperties }) {
  return (
    <span aria-hidden className={cn('relative block max-w-full', className)} style={style}>
      &nbsp;
      <span className={cn('absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2', SHIMMER)} />
    </span>
  );
}

/** An inline text bone, for slots that sit in a row (the rating beside the title, a meta item). */
function Word({ className }: { className: string }) {
  return (
    <span aria-hidden className={cn('relative inline-block align-top', className)}>
      &nbsp;
      <span className={cn('absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2', SHIMMER)} />
    </span>
  );
}

/** A chip-sized bone (the phone header's back / share chips, a button). */
function Chip({ className }: { className: string }) {
  return <span aria-hidden className={cn('block shrink-0 rounded-control', BLOCK, className)} />;
}

export type DetailSkeletonProps = {
  /** The lake / public-water photo hero (phone: first, 300px; from 768 the mosaic under the title). */
  photo?: boolean;
  /**
   * How many photos the loaded hero is likely to have (default 1, the common case — a single
   * strip): the bone takes DetailPhotoHero's own height for it (photoHeroHeight), so the body does
   * not jump when the photos land.
   */
  photoCount?: number;
  /** Route tabs under the header (competition) instead of the sticky section chips. */
  tabs?: boolean;
  /**
   * Which side columns the loaded page has from 1280. `left: 'toc'` is the section index of a
   * single-scroll page (an eyebrow and plain rows, no card); `left: true` holds `leftCards` cards
   * (the first a stat card — number, meter, caption — the others lists). `asideCards`: how many
   * cards the right column stacks (the first an action card, the others lists). `centre`: three
   * text cards (default) or one table card (a header row + 8 participant rows).
   */
  columns?: { left?: boolean | 'toc'; aside?: boolean; leftCards?: number; asideCards?: number; centre?: 'text' | 'table' };
  /** The loaded header's optional rows, so the skeleton header is as tall as the real one. */
  header?: {
    /** Caps line over the title (from 768). */
    eyebrow?: boolean;
    /** The rating beside the title. */
    titleAside?: boolean;
    /** Meta lines: one dotted line from 768; on the centred phone header, one line each. */
    meta?: number;
    /** The badge / pill row; `pill` = 26px status pills, `badge` = 20px attribute badges. */
    badges?: 'pill' | 'badge';
    /**
     * From 768: the action cluster. `true` = one button; `2` = a primary + the share button (the
     * share is icon-only below 1280, labelled from 1280 — DetailShareButton `button`).
     */
    actions?: boolean | 2;
    /** Phone, centred header: the share chip at the right. */
    phoneEnd?: boolean;
  };
  /** Phone: the back chip (a <DetailBackButton>), over the photo bone or at the header's left. */
  back?: ReactNode;
  /** From 768: the breadcrumb band, its current crumb a placeholder (BreadcrumbBand pendingCurrent). */
  trail?: Crumb[];
  /** The phone ground of the loaded page (DetailPage `phoneGround`): `surface` = all white, as loaded. */
  phoneGround?: 'page' | 'surface';
  /** Phone: the loaded page's fixed bottom bar (and its spacer). */
  actionBar?: boolean;
  /** Announced once while loading. */
  label?: string;
  /** The page's <h1> while loading (visually hidden): the kind of page, «Baltă». */
  heading?: string;
};

/**
 * Loading — the page's own shape in grey (fish LakeDetailsSkeleton), built from the same parts as
 * the loaded page (DetailHeader, the band, the body grid, the action bar) with bones sized by the
 * same type steps, so nothing moves when the data lands (ROADMAP §5: CLS < 0.05).
 */
export function DetailSkeleton({
  photo = false,
  photoCount = 1,
  tabs = false,
  columns = { left: true, aside: true },
  header = {},
  back,
  trail,
  phoneGround = 'page',
  actionBar = false,
  label = 'Se încarcă pagina',
  heading = 'Se încarcă pagina',
}: DetailSkeletonProps) {
  const { eyebrow = false, titleAside = false, meta = 1, badges, actions = false, phoneEnd = false } = header;
  const centred = tabs;
  const leftCards = columns.leftCards ?? 1;
  const asideCards = columns.asideCards ?? 1;
  // The centred phone header (competition) keeps its meta bones short enough to stay on one dotted
  // line from 768, as the loaded «Organizat de… · Chita Lake · 6 octombrie 2026» does.
  const metaWidths = centred ? ['w-40 md:w-32', 'w-28 md:w-20', 'w-24'] : ['w-40', 'w-28', 'w-28'];
  const photoBone = photo ? (
    // First in the DOM, as the loaded page (the hero leads on the phone); from 768 `md:order-1` puts it under the title.
    <div data-t3="photo" className={cn('relative md:order-1 md:mx-6 md:mb-6 xl:mx-8', photoCount <= 0 && 'md:hidden')}>
      <span aria-hidden className={cn('block md:rounded-bento', photoHeroHeight(photoCount), BLOCK)} />
      {back ? <div className="absolute top-4 left-4 md:hidden">{back}</div> : null}
      <div aria-hidden className="absolute top-4 right-4 md:hidden">
        <span className={headerChipClass({ onPhoto: true })} />
      </div>
    </div>
  ) : null;
  return (
    <div aria-busy="true">
      <p role="status" className="sr-only">
        {label}…
      </p>
      {trail ? <BreadcrumbBand trail={trail} pendingCurrent /> : null}
      <DetailPage phoneGround={phoneGround}>
        <DetailBand hairline={tabs}>
          {photoBone}
          <DetailHeader
            phoneAlign={centred ? 'center' : 'start'}
            className={photo ? 'md:pt-5' : undefined}
            title={
              <>
                <span className="sr-only">{heading}</span>
                <Word className="w-48 md:w-80" />
              </>
            }
            eyebrow={eyebrow ? <Word className="w-24" /> : undefined}
            titleAside={
              titleAside ? (
                // The rating link's own box (p-1, -m-1), so the line is as tall as the loaded one.
                <span className="-m-1 inline-flex p-1">
                  <Word className="w-24 t-body-strong" />
                </span>
              ) : undefined
            }
            meta={Array.from({ length: meta }, (_, i) => (
              // The centred phone header shows two meta lines (organiser, lake); the dates join from 768.
              <Word key={i} className={cn(metaWidths[Math.min(i, 2)], i >= 2 && centred && 'max-md:hidden')} />
            ))}
            badges={
              badges ? (
                <span aria-hidden className={cn('block rounded-full', BLOCK, badges === 'pill' ? 'h-6.5 w-36' : 'h-5 w-28')} />
              ) : undefined
            }
            media={!photo ? <span aria-hidden className={cn('block size-24 rounded-card', BLOCK)} /> : undefined}
            actions={
              actions === 2 ? (
                <>
                  <Chip className="h-12 w-32 xl:h-10 xl:w-44" />
                  <Chip className="h-12 w-12 xl:h-10 xl:w-32" />
                </>
              ) : actions ? (
                <Chip className="h-12 w-32 xl:h-10 xl:w-36" />
              ) : undefined
            }
            phoneStart={centred ? (back ?? <Chip className="size-12" />) : undefined}
            phoneEnd={centred && phoneEnd ? <Chip className="size-12" /> : undefined}
          />
          {tabs ? (
            <span aria-hidden data-t3="tabs" className="flex gap-6 overflow-hidden px-4 md:gap-7 md:px-6 xl:px-8">
              {['w-20', 'w-22', 'w-28', 'w-24', 'w-24'].map((w, i) => (
                <span key={i} className="flex min-h-11 shrink-0 items-center pb-2.5">
                  <Word className={cn('t-body-strong', w)} />
                </span>
              ))}
            </span>
          ) : null}
        </DetailBand>
        {!tabs ? (
          <div aria-hidden data-t3="chips" className={cn('flex h-14.5 items-center gap-2 px-4 md:px-6 xl:hidden', FULL_BLEED_SURFACE, FULL_BLEED_HAIRLINE)}>
            {['w-24', 'w-20', 'w-16', 'w-22'].map(w => (
              <span key={w} className={cn('h-9 shrink-0 rounded-full', BLOCK, w)} />
            ))}
          </div>
        ) : null}
        <div
          aria-hidden
          data-t3="body"
          className={cn(
            'flex flex-1 flex-col gap-2 pt-2 pb-8 md:gap-4 md:px-6 md:pt-6 md:pb-12 xl:grid xl:items-start xl:px-8 xl:pt-8',
            TRACK_GAP,
            // DetailBody's tracks (../tracks.ts), so the skeleton has the page's geometry.
            columns.left && columns.aside ? TRACKS.three : columns.aside ? TRACKS.mainRight : columns.left ? TRACKS.leftMain : '',
          )}
        >
          {columns.left === 'toc' ? (
            // The section index (DetailSectionToc): an eyebrow and 40px rows, no surface.
            <span className="-mx-3 flex flex-col gap-2 max-xl:hidden">
              <span className="px-3">
                <Line className="w-32 t-eyebrow" />
              </span>
              <span className="flex flex-col gap-0.5">
                {['w-[55%]', 'w-[40%]', 'w-[35%]', 'w-[45%]', 'w-[50%]', 'w-[60%]'].map((w, i) => (
                  <span key={i} className="flex h-10 items-center px-3">
                    <Line className={cn('t-body', w)} />
                  </span>
                ))}
              </span>
            </span>
          ) : columns.left ? (
            <span className="flex flex-col gap-4 max-xl:hidden">
              {Array.from({ length: leftCards }, (_, i) =>
                // One card when the left column is a single block; with more, the first is the stat card.
                leftCards === 1 ? (
                  <span key={i} className="flex flex-col gap-3 bg-surface p-6 md:rounded-card md:shadow-e0">
                    <Line className="w-28 t-title2" />
                    <Line className="w-[70%] t-body" />
                    <Line className="w-[52%] t-caption" />
                  </span>
                ) : i === 0 ? (
                  <span key={i} className="flex flex-col gap-2 bg-surface p-6 md:rounded-card md:shadow-e0">
                    <Line className="mb-1 w-28 t-title2" />
                    <Line className="w-32 t-stat" />
                    <span className={cn('h-1.5 rounded-full', BLOCK)} />
                    <Line className="w-[60%] t-caption" />
                  </span>
                ) : (
                  <span key={i} className="flex flex-col bg-surface p-6 md:rounded-card md:shadow-e0">
                    <Line className="mb-3 w-28 t-title2 xl:mb-4" />
                    {[0, 1, 2, 3].map(r => (
                      <span key={r} className="flex items-center gap-3 border-b border-hairline py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                        <Chip className="size-8" />
                        <Line className="w-[40%] t-body" />
                      </span>
                    ))}
                  </span>
                ),
              )}
            </span>
          ) : null}
          <span className="flex flex-col gap-2 md:gap-4 xl:gap-5">
            {columns.centre === 'table' ? (
              <span className="flex flex-col bg-surface px-4 py-5 md:rounded-card md:p-5 md:shadow-e0 xl:p-6">
                <span className="mb-3 flex items-start gap-3 xl:mb-4">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <Line className="w-32 t-title2" />
                    <Line className="w-40 t-caption" />
                  </span>
                  {/* Below 1280 the heading carries the fill («20 / 20 locuri», t-stat). */}
                  <Line className="w-24 shrink-0 t-stat xl:hidden" />
                </span>
                {/* The table's header row (from 768), then 8 rows of the participant row's height. */}
                <span className="flex border-b border-hairline py-2.5 max-md:hidden">
                  <Line className="w-48 t-label" />
                </span>
                <span className="flex flex-col max-md:-mx-4">
                  {Array.from({ length: 8 }, (_, r) => (
                    <span key={r} className="flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0 md:px-0 md:py-2.5">
                      <Chip className="h-8 w-11" />
                      <Line className="w-[45%] t-body-strong" />
                    </span>
                  ))}
                </span>
              </span>
            ) : (
              [0, 1, 2].map(i => (
                <span key={i} className="flex flex-col gap-3 bg-surface px-4 py-5 md:rounded-card md:p-5 md:shadow-e0 xl:p-6">
                  <Line className="w-32 t-title2" />
                  <Line className="w-full t-body" />
                  <Line className="w-[86%] t-body" />
                  <Line className="w-[64%] t-body" />
                </span>
              ))
            )}
          </span>
          {columns.aside ? (
            <span className="flex flex-col gap-5 max-xl:hidden">
              {Array.from({ length: asideCards }, (_, i) =>
                i === 0 ? (
                  // The action card: title, a state pill, a line of text, the button, its hint.
                  <span key={i} className="flex flex-col gap-3 bg-surface p-6 md:rounded-card md:shadow-e0">
                    <Line className="w-28 t-title2" />
                    <span className={cn('h-6.5 w-32 rounded-full', BLOCK)} />
                    <Line className="w-[90%] t-body" />
                    <span className={cn('h-10 rounded-control', BLOCK)} />
                    <Line className="w-[70%] t-caption" />
                  </span>
                ) : (
                  // A list card (DetailFacts `list`): 24px icon + label, value at the right.
                  <span key={i} className="flex flex-col bg-surface p-6 md:rounded-card md:shadow-e0">
                    <Line className="mb-4 w-36 t-title2" />
                    {[0, 1, 2, 3].map(r => (
                      <span key={r} className="flex items-center gap-3 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0">
                        <Chip className="size-6" />
                        <Line className="w-[35%] t-body" />
                        <Line className="ml-auto w-[25%] t-body-strong" />
                      </span>
                    ))}
                  </span>
                ),
              )}
            </span>
          ) : null}
        </div>
        {actionBar ? (
          <DetailActionBar
            label="Acțiuni (se încarcă)"
            summary={
              <span aria-hidden className="flex flex-col">
                <Line className="w-20 t-body-strong" />
                <Line className="w-32 t-caption" />
              </span>
            }
          >
            <Chip className="h-12 w-36" />
          </DetailActionBar>
        ) : null}
      </DetailPage>
    </div>
  );
}

/**
 * The settled whole-page state (error, not found): one surface card, centred in the free height from
 * 768 (on the phone it follows the back chip), stacked — the icon, the title (the page's <h1>, on
 * the section-title step), what happened, then the action inside the card (a 48 / 40 default-size
 * button: on this page it is THE call to action, not an inline row action).
 * The breadcrumb band (from 768) shows the parents and a real current crumb (`current`) — never
 * the loading placeholder: nothing here is still loading.
 */
function PageState({
  icon,
  heading,
  description,
  action,
  tone,
  back,
  trail,
  current,
}: {
  icon: ReactNode;
  heading: string;
  description?: ReactNode;
  action?: ReactNode;
  tone: 'error' | 'empty';
  back?: ReactNode;
  trail?: Crumb[];
  current: string;
}) {
  return (
    <>
      {trail ? <BreadcrumbBand trail={[...trail, { label: current }]} /> : null}
      <div className="flex flex-col px-4 pt-2 pb-6 md:min-h-[60dvh] md:items-center md:justify-center md:px-6 md:py-10 xl:px-8">
        {back ? <div className="mb-2 md:hidden">{back}</div> : null}
        <div
          role={tone === 'error' ? 'alert' : undefined}
          className={cn(
            'flex w-full flex-col items-center gap-3 rounded-card bg-surface px-5 py-8 text-center md:max-w-120 md:px-8 md:py-10',
            tone === 'error' ? RING_DANGER : 'shadow-e0',
          )}
        >
          {icon}
          <div className="flex flex-col gap-1.5">
            <h1 className="t-title2 text-balance">{heading}</h1>
            {description ? <p className="t-body text-pretty text-muted">{description}</p> : null}
          </div>
          {action ? <div className="mt-2 flex flex-col items-center gap-2">{action}</div> : null}
        </div>
      </div>
    </>
  );
}

/**
 * The page could not be read at all. A centred error card with the way forward (`action`: the
 * retry, <DetailRetry size="default">, or for a dead session the way back in). `heading` is the
 * page's visible <h1>: short and specific («Concursul nu a putut fi încărcat»); the description
 * says what to do, without guessing the cause.
 */
export function DetailError({
  heading = 'Pagina nu a putut fi încărcată',
  description = 'Nu am putut încărca pagina. Încearcă din nou în câteva momente.',
  action,
  back,
  trail,
  current = 'Eroare',
}: {
  heading?: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Phone: the back chip (<DetailBackButton>), the way out where there is no breadcrumb band. */
  back?: ReactNode;
  /** From 768: the parent crumbs; `current` closes the trail. */
  trail?: Crumb[];
  /** The breadcrumb's current crumb (plain text, never a placeholder). */
  current?: string;
}) {
  return (
    <PageState
      tone="error"
      icon={
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg [&>svg]:size-6">
          <ExclamationCircleIcon aria-hidden />
        </span>
      }
      heading={heading}
      description={description}
      action={action}
      back={back}
      trail={trail}
      current={current}
    />
  );
}

/**
 * The id does not exist (fish: an unknown lake / competition). The same frame as <DetailError>:
 * the Bluvi SadSearch icon, what is missing, and where to look instead (`href` + `cta`, the list)
 * inside the card. `title` is the page's <h1>.
 * A real route calls `notFound()` BEFORE any Suspense boundary (so the answer is a real 404) and
 * renders this from its not-found file.
 */
export function DetailNotFound({
  title,
  description,
  href,
  cta,
  back,
  trail,
  current = 'Pagină inexistentă',
}: {
  title: string;
  description?: ReactNode;
  href: string;
  cta: string;
  back?: ReactNode;
  trail?: Crumb[];
  current?: string;
}) {
  return (
    <PageState
      tone="empty"
      icon={
        <span className="flex size-12 shrink-0 items-center justify-center text-ink">
          <SadSearchIcon size={48} />
        </span>
      }
      heading={title}
      description={description}
      action={
        <ButtonLink href={href} variant="secondary">
          {cta}
        </ButtonLink>
      }
      back={back}
      trail={trail}
      current={current}
    />
  );
}

/**
 * A section the signed-out visitor cannot see (fish: «Trebuie să fii autentificat pentru a vedea
 * statisticile.» + «Intră în cont»). `href` is the sign-in link that returns here.
 */
export function DetailSignInPrompt({ message, href, cta = 'Intră în cont', className }: { message: string; href: string; cta?: string; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-card bg-page px-4 py-6 text-center', className)}>
      <span className="flex size-10 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">
        <LockClosedIcon aria-hidden />
      </span>
      <p className="max-w-80 t-body text-ink-2">{message}</p>
      <ButtonLink href={href} variant="secondary">
        {cta}
      </ButtonLink>
    </div>
  );
}

/**
 * A state INSIDE the body (the page around it stands): something the web cannot show here yet, or
 * an empty view — what is missing and the way on (`action`: «Deschide în aplicație», a list). The
 * page-level frame (STATE_CARD_FRAME: the 720 reading measure, centred in the column) and the
 * PageState card's look, with an h2 under the page's h1. On the phone the card is the white block
 * of the screen (no hairline), from 768 a card.
 */
export function DetailSectionState({
  heading,
  description,
  action,
  icon,
  className,
}: {
  heading: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(STATE_CARD_FRAME, className)}>
      <div className="flex w-full flex-col items-center gap-3 bg-surface px-5 py-8 text-center md:rounded-card md:px-8 md:py-10 md:shadow-e0">
        {icon}
        <div className="flex flex-col gap-1.5">
          <h2 className="t-title2 text-balance text-ink">{heading}</h2>
          {description ? <p className="t-body text-pretty text-muted">{description}</p> : null}
        </div>
        {action ? <div className="mt-2 flex flex-col items-center gap-2">{action}</div> : null}
      </div>
    </div>
  );
}
