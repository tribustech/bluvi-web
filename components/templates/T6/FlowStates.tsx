import { FlowHeader } from './FlowLayout';
import { cn } from '@/components/ui/cn';

/*
 * The flow's loading state. Notices are T4Notice; every «can't run» state — signed out, nothing to
 * pick (empty), a stand that cannot be opened, a load error (tone="danger") — is a T4Gate in a
 * `bare`, `narrow` FlowLayout, so sibling flows speak one visual language. These skeletons copy
 * the loaded step's boxes and type steps (a grey bar inside a line of the same t-* class), so
 * nothing moves when the data lands. Each loading screen is announced once, by a real status
 * line (`FlowLoadingStatus`), and FlowLayout's `busy` marks the task region.
 */

/**
 * A grey text bar: soft-fill with the kit's one shimmer (Fundații §07 LoadingRow, 1.4s), like
 * T4's skeleton bars — every grey bar of a loading screen moves the same way.
 */
const BAR = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';
/** The same bar on the dashed accent subject card: a static tint step (the grey sweep would read as a hole). */
const ACCENT_BAR = 'inline-block max-w-full rounded-full bg-accent-tint-2 align-middle';

/**
 * The header while loading: when the title is known before the data it is a real h1; when it is
 * not (a step-neutral fallback, or a step titled by data the load decides) the h1 line holds a
 * grey bar and there is no heading yet, rather than a title that would swap. The eyebrow, the meta
 * line and the status pill are grey bars in the same lines; the back button is the same soft-fill
 * square.
 */
export function FlowHeaderSkeleton({
  title,
  id,
  meta = true,
  trailing = true,
}: {
  title?: string;
  id?: string;
  meta?: boolean;
  trailing?: boolean;
}) {
  return (
    <FlowHeader
      title={title}
      titleBar={<span aria-hidden className={cn(BAR, 'h-5 w-56 md:h-6 md:w-72')} />}
      id={id}
      backPlaceholder={<span aria-hidden className="size-12 shrink-0 rounded-control bg-soft-fill xl:size-10" />}
      eyebrow={<span aria-hidden className={cn(BAR, 'h-3 w-40')} />}
      meta={meta ? <span aria-hidden className={cn(BAR, 'h-3 w-32')} /> : undefined}
      trailing={trailing ? <span aria-hidden className="h-6.5 w-16 rounded-full bg-soft-fill animate-shimmer" /> : undefined}
    />
  );
}

/** One line of the parent's type step (its line-height) holding a grey bar. */
function Line({ bar, className }: { bar: string; className?: string }) {
  return (
    <span className={cn('block', className)}>
      <span className={cn(BAR, bar)} />
    </span>
  );
}

/**
 * A T4Notice-shaped placeholder: T4Notice's own card, padding (16 / 20 / 24), 40px disc and
 * `pt-0.5` text column, a t-body-strong title line over a t-caption body line. `lines` sets how
 * many lines title and body wrap to below 768 and at 768–1279 (from 1280 both fit on one line).
 */
export function FlowNoticeSkeleton({
  phone = { title: 2, body: 2 },
  tablet = { title: 1, body: 1 },
}: {
  phone?: { title: 1 | 2; body: 1 | 2 };
  tablet?: { title: 1 | 2; body: 1 | 2 };
}) {
  // A second line exists below 768 when the phone wraps, and up to 1279 when the tablet wraps too.
  const second = (p: 1 | 2, t: 1 | 2) => (p === 1 && t === 1 ? 'hidden' : p === 2 && t === 1 ? 'md:hidden' : p === 1 ? 'hidden md:block xl:hidden' : 'xl:hidden');
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0 md:flex-row md:items-center md:gap-4 md:p-5 xl:p-6">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="size-10 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="t-body-strong">
            <Line bar="h-3.5 w-64" />
            <Line bar="h-3.5 w-24" className={second(phone.title, tablet.title)} />
          </p>
          <p className="t-caption">
            <Line bar="h-2.5 w-80" />
            <Line bar="h-2.5 w-28" className={second(phone.body, tablet.body)} />
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The loading announcement: a real status line with its text (a live region announces its text
 * content, not an aria-label; and a `display: contents` role can drop out of WebKit's tree).
 * Visually hidden; it sits next to the aria-hidden skeleton.
 */
export function FlowLoadingStatus({ label = 'Se încarcă…' }: { label?: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  );
}

/**
 * Loading: the search field (`toolbar`), section titles and the tile grid in grey, announced once.
 * Tiles have the loaded tile's lines (title + one caption), so the grid keeps its height.
 */
export function FlowSkeleton({
  sections = 2,
  tiles = 4,
  toolbar = false,
  label = 'Se încarcă…',
}: {
  sections?: number;
  tiles?: number;
  /** A FlowSearch-shaped bar before the sections. */
  toolbar?: boolean;
  label?: string;
}) {
  return (
    <>
      <FlowLoadingStatus label={label} />
      {toolbar ? (
        <div aria-hidden className="flex flex-col gap-2 md:flex-row md:items-start">
          {/* FlowSearch in the task card: the kit control shell at rest (soft-fill, radius 10). */}
          <span className="block h-12 w-full min-w-0 rounded-control bg-soft-fill animate-shimmer md:max-w-120 md:flex-1 xl:h-10" />
        </div>
      ) : null}
      {Array.from({ length: sections }, (_, s) => (
        <div key={s} aria-hidden className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
            <p className="t-title2">
              <span className={cn(BAR, 'h-4 w-24')} />
            </p>
            <p className="t-caption ml-auto">
              <span className={cn(BAR, 'h-2.5 w-20')} />
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(70),1fr))] md:gap-3">
            {Array.from({ length: tiles }, (_, i) => (
              // A plain shimmering tile of the loaded tile's height (T4's grid skeleton): no bars
              // inside — a sweep over a sweep would hide them.
              <span key={i} className="block min-h-16 rounded-card bg-soft-fill animate-shimmer" />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/**
 * Aside placeholder: a FlowAsideCard with the title line, the stat-size number and its caption,
 * and the 2 × 2 grid of small stats under a hairline (the Cântar summary's shape).
 */
export function FlowAsideSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
      <p className="t-heading">
        <span className={cn(BAR, 'h-3.5 w-20')} />
      </p>
      <div className="flex flex-col">
        <span className="t-num-40">
          <span className="inline-block h-9 w-40 max-w-full rounded-control bg-soft-fill align-middle animate-shimmer" />
        </span>
        <span className="t-caption">
          <span className={cn(BAR, 'h-2.5 w-24')} />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <span className="t-caption">
              <span className={cn(BAR, 'h-2.5 w-24')} />
            </span>
            <span className="t-stat">
              <span className={cn(BAR, 'h-4 w-10')} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A FlowSubjectCard-shaped placeholder (dashed accent card): the title2 line, a heading line and
 * `people` bullet lines.
 */
export function FlowSubjectSkeleton({ people = 1, subtitle = true }: { people?: number; subtitle?: boolean }) {
  return (
    <div aria-hidden className="flex flex-col gap-1 rounded-card border border-dashed border-accent bg-accent-tint px-4 py-3 md:px-5 md:py-4">
      <p className="t-title2">
        <span className={cn(ACCENT_BAR, 'h-4 w-40')} />
      </p>
      {subtitle ? (
        <p className="t-heading">
          <span className={cn(ACCENT_BAR, 'h-3.5 w-32')} />
        </p>
      ) : null}
      {people > 0 ? (
        <span className="mt-1 flex flex-col gap-0.5">
          {Array.from({ length: people }, (_, i) => (
            <span key={i} className="t-body block">
              <span className={cn(ACCENT_BAR, 'h-3 w-36')} />
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

/** A field placeholder (kit <Field>): the label line, a control shell of the given height class, an optional helper line. */
export function FlowFieldSkeleton({ height, label = 'w-16', helper = false }: { height: string; label?: string; helper?: boolean }) {
  return (
    <div aria-hidden className="flex min-w-0 flex-col gap-1.5">
      <span className="t-label block">
        <span className={cn(BAR, 'h-3', label)} />
      </span>
      <span className={cn('block rounded-control bg-soft-fill animate-shimmer', height)} />
      {helper ? (
        <span className="t-caption block">
          <span className={cn(BAR, 'h-2.5 w-40')} />
        </span>
      ) : null}
    </div>
  );
}
