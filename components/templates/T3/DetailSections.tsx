'use client';

import { createContext, Suspense, use, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { settledScrollMargin } from '@/components/nav/stickyStack';
import { cn } from '@/components/ui/cn';
import { DetailPinnedTitle } from './DetailPinned';
import { focusLandingSpot } from './focus';
import { usePinnedFollowingBar } from './followBar';
import { FULL_BLEED_HAIRLINE, FULL_BLEED_SURFACE, STICKY_TOP } from './metrics';

/*
 * T3 section navigation for single-scroll detail pages — fish lakes/[lakeId].tsx
 * (VenueSectionChips + VenuePinnedNav + computeActiveSection + the scroll lock).
 *
 *  - <DetailSectionsProvider sections> owns the scroll spy: the active section is the last one
 *    whose top has passed its own scroll-margin (the pinned rows), the last one at the page end.
 *    Sections hidden at this width (`hideFromXl` / `hideFromLg`) are skipped. A chip tap jumps straight to its
 *    section and holds the highlight there until the scroll settles (fish
 *    isScrollingToSectionRef), so the highlight never walks through the sections in between; and
 *    when the jump ends at the page end (a short last section), the section the user picked keeps
 *    the highlight — not the last one — until the user scrolls on their own.
 *  - <DetailSectionNav> phone + tablet: the sticky chip row. On the phone it also pins the mini
 *    title row (fish VenuePinnedNav) once the header has scrolled away.
 *  - <DetailSectionToc> ≥1280: the same sections as a sticky index in the left column.
 *
 * Every chip is a real `#id` link: without JS it still jumps; with JS the URL hash follows the
 * chip and focus moves to the section, so keyboard and screen-reader users land where they went.
 */

export type DetailSectionItem = {
  id: string;
  label: string;
  /** A count or short tag after the label in the left index («3», «NOU»). */
  hint?: string | number;
  /**
   * The section has nothing to show from 1280 (its content moved to the side columns) and is
   * `xl:hidden`: it stays a chip below 1280, and is left out of the ≥1280 index.
   */
  hideFromXl?: boolean;
  /**
   * The same from 1024 (`min-[1024px]:hidden` on the section — e.g. a lake's Prezentare with no
   * description, whose tiles and facts move into the summary card there): no chip from 1024, no
   * entry in the ≥1280 index.
   */
  hideFromLg?: boolean;
  /**
   * `false`: the section's place in the order is known, but whether it shows is not decided by the
   * server read — it is left out until the page's own client read registers it (useRegisterSection).
   * A registration always wins over this flag (a section that appears / leaves while the page is open).
   */
  visible?: boolean;
};

type Ctx = {
  sections: DetailSectionItem[];
  active: string | undefined;
  go: (id: string) => void;
  register: (id: string, visible: boolean) => void;
};
const SectionsContext = createContext<Ctx | null>(null);

function useSections(): Ctx {
  const ctx = use(SectionsContext);
  if (!ctx) throw new Error('DetailSectionNav / DetailSectionToc must be inside <DetailSectionsProvider>');
  return ctx;
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A section that shows or hides from a client read (a poll) tells the nav, so its chip appears and
 * leaves with it. `undefined` (no data yet) keeps what the server list said. Outside a provider: a no-op.
 */
export function useRegisterSection(id: string, visible: boolean | undefined) {
  const register = use(SectionsContext)?.register;
  useEffect(() => {
    if (register && visible !== undefined) register(id, visible);
  }, [register, id, visible]);
}

/** Takes the streamed section list once its promise resolves (it must not reject: settle the reads first). */
function Refine({ list, onList }: { list: Promise<DetailSectionItem[]>; onList: (l: DetailSectionItem[]) => void }) {
  const value = use(list);
  useEffect(() => onList(value), [value, onList]);
  return null;
}

/**
 * `sections`: the list known when the page renders. `refined`: the final list, when some sections
 * depend on reads that stream in after the page (a section that turns out empty drops out, a count
 * arrives, a gated section appears once the session is known) — the nav swaps to it when it lands.
 */
export function DetailSectionsProvider({
  sections: initial,
  refined,
  children,
}: {
  sections: DetailSectionItem[];
  refined?: Promise<DetailSectionItem[]>;
  children: ReactNode;
}) {
  const [listed, setSections] = useState(initial);
  const [registered, setRegistered] = useState<Record<string, boolean>>({});
  const sections = useMemo(() => listed.filter(s => registered[s.id] ?? s.visible !== false), [listed, registered]);
  const register = useCallback(
    (id: string, visible: boolean) => setRegistered(r => (r[id] === visible ? r : { ...r, [id]: visible })),
    [],
  );
  const [active, setActive] = useState<string | undefined>(sections[0]?.id);
  const locked = useRef(false);
  const unlockTimer = useRef<number | undefined>(undefined);
  /** The last section a chip jumped to; cleared when the user scrolls on their own. */
  const picked = useRef<string | null>(null);
  const key = sections.map(s => s.id).join('|');
  // Which sections are laid out per width: a section that comes back above the active one (a lake's
  // or a water's Prezentare, once its reads settle) is measured again — at the top of the page it
  // takes the highlight back instead of leaving it on the next section.
  const layoutKey = sections.map(s => `${s.hideFromLg ? 'l' : ''}${s.hideFromXl ? 'x' : ''}`).join('|');

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    let frame = 0;
    const measure = () => {
      frame = 0;
      if (locked.current) return;
      // Only sections laid out at this width (a `hideFromXl` one has no box from 1280).
      const els = ids
        .map(id => document.getElementById(id))
        .filter((el): el is HTMLElement => !!el && el.getClientRects().length > 0);
      if (!els.length) return;
      let current = els[0].id;
      for (const el of els) {
        const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
        if (el.getBoundingClientRect().top <= margin + 1) current = el.id;
      }
      const doc = document.documentElement;
      if (window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - 2) {
        // At the end: the last section — unless a chip brought the user here and its section is in view.
        const target = picked.current ? document.getElementById(picked.current) : null;
        const rect = target && target.getClientRects().length > 0 ? target.getBoundingClientRect() : null;
        current = target && rect && rect.top < window.innerHeight && rect.bottom > 0 ? target.id : els[els.length - 1].id;
      }
      setActive(prev => (prev === current ? prev : current));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    // The jump settled, or the user took the page over mid-flight: hand the highlight back to the spy.
    const release = () => {
      if (!locked.current) return;
      locked.current = false;
      window.clearTimeout(unlockTimer.current);
      schedule();
    };
    // The user's own scroll intent: the picked section no longer outranks the page end.
    const takeOver = () => {
      picked.current = null;
      release();
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    window.addEventListener('scrollend', release);
    window.addEventListener('wheel', takeOver, { passive: true });
    window.addEventListener('touchstart', takeOver, { passive: true });
    window.addEventListener('keydown', takeOver);
    schedule();
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scrollend', release);
      window.removeEventListener('wheel', takeOver);
      window.removeEventListener('touchstart', takeOver);
      window.removeEventListener('keydown', takeOver);
      window.clearTimeout(unlockTimer.current);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [key, layoutKey]);

  const go = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    // The margin for the bar state the jump ends in: a jump down hides the phone bar (the pinned
    // stack is 56px shorter), a jump up brings it back — else the heading lands 56px under a
    // pinned row with an empty band between them.
    const from = window.scrollY;
    const top = el.getBoundingClientRect().top + from;
    const guess = Math.max(0, top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0));
    const target = Math.max(0, top - settledScrollMargin(el, from, guess));
    setActive(id);
    picked.current = id;
    // fish shouldLockForSectionScroll: only lock when the page will actually move.
    if (Math.abs(target - window.scrollY) > 2) {
      locked.current = true;
      window.clearTimeout(unlockTimer.current);
      // Safety net where `scrollend` is missing (older Safari).
      unlockTimer.current = window.setTimeout(() => {
        locked.current = false;
      }, 1200);
    }
    window.scrollTo({ top: target, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    window.history.replaceState(window.history.state, '', `#${id}`);
    focusLandingSpot(el, { preventScroll: true });
  }, []);

  const value = useMemo(() => ({ sections, active, go, register }), [sections, active, go, register]);
  return (
    <SectionsContext value={value}>
      {children}
      {refined ? (
        <Suspense fallback={null}>
          <Refine list={refined} onList={setSections} />
        </Suspense>
      ) : null}
    </SectionsContext>
  );
}

function onChipClick(e: MouseEvent<HTMLAnchorElement>, id: string, go: (id: string) => void) {
  // Let modified clicks (new tab…) do what links do.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  e.preventDefault();
  go(id);
}

export type DetailSectionNavProps = {
  /** Accessible name of the chip row. */
  label?: string;
  /** Phone mini row, once pinned: the page title (fish VenuePinnedNav `title`). */
  pinnedTitle: string;
  /** Pinned row, left: the back chip (fish VenuePinnedNav `leftAccessory`, lakes c12). */
  pinnedStart?: ReactNode;
  /** Under the pinned title: «★ 4,33 · 1 recenzie». */
  pinnedMeta?: ReactNode;
  /** Pinned row, right: a share chip. */
  pinnedEnd?: ReactNode;
  /** Hide from 1280, where <DetailSectionToc> takes over (default). */
  hideFromXl?: boolean;
  className?: string;
};

/**
 * Sticky section switcher (fish VenueSectionChips; selected = accent filled), on the shell gutters
 * (16 / 24 / 32), as ONE container (owner rule 20): a segmented track on the phone, a tab bar with an
 * accent underline from 768. On the phone the nav carries the mini title row above the chips: it overlaps the
 * header's last 46px while the header is visible (invisible, click-through) and turns opaque once
 * the nav pins, so the page never jumps when it appears.
 */
export function DetailSectionNav({
  label = 'Secțiuni',
  pinnedTitle,
  pinnedStart,
  pinnedMeta,
  pinnedEnd,
  hideFromXl = true,
  className,
}: DetailSectionNavProps) {
  const { sections, active, go } = useSections();
  const navRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  // Pinned: it also flags the sticky stack, so the top bar above drops its shadow (shell BAR_SHADOW).
  // It follows the phone bar by CSS (STICKY_TOP: the bar's own `top` transition, owner rule 3).
  const pinned = usePinnedFollowingBar(navRef);

  // fish: the selected chip scrolls into view, 60px from the row's left edge.
  useEffect(() => {
    const row = rowRef.current;
    const chip = active ? row?.querySelector<HTMLElement>(`[data-section="${CSS.escape(active)}"]`) : null;
    if (!row || !chip) return;
    row.scrollTo({ left: Math.max(0, chip.offsetLeft - 60), behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [active]);

  if (!sections.length) return null;
  // A tab bar that can only point at the one section on the page is chrome with no job: hidden
  // wherever fewer than two sections are laid out at that width. The phone keeps it — its pinned
  // mini row (back, title, share; lakes c12) is the page's header once the hero has scrolled away.
  const laidOut = { md: sections.length, lg: sections.filter(s => !s.hideFromLg).length, xl: sections.filter(s => !s.hideFromLg && !s.hideFromXl).length };

  return (
    <nav
      ref={navRef}
      aria-label={label}
      data-t3="chips"
      data-pinned={pinned || undefined}
      className={cn(
        // Phone: click-through over the header's last 46px (the mini row's place) until it pins.
        'group/pin sticky z-above max-md:pointer-events-none max-md:-mt-11.5',
        STICKY_TOP,
        FULL_BLEED_SURFACE,
        FULL_BLEED_HAIRLINE,
        // Phone: the surface only shows once pinned (the mini row is transparent over the header).
        'max-md:before:opacity-0 max-md:data-pinned:before:opacity-100 max-md:after:opacity-0 max-md:data-pinned:after:opacity-100',
        // Pinned, it is the lowest member of the sticky stack: it alone casts the shadow (the bar drops
        // its own) — from the full-bleed surface, so the shadow spans the screen like the white band
        // instead of stopping at the column's gutters.
        'data-pinned:before:shadow-e1',
        laidOut.md < 2 && 'md:max-[1024px]:hidden',
        laidOut.lg < 2 && 'min-[1024px]:max-xl:hidden',
        (hideFromXl || laidOut.xl < 2) && 'xl:hidden',
        className,
      )}
    >
      {/* Phone mini row (fish PINNED_MINI_HEIGHT 46): the shared T3 pinned anatomy. */}
      <DetailPinnedTitle pinned={pinned} start={pinnedStart} title={pinnedTitle} meta={pinnedMeta} end={pinnedEnd} />
      {/*
        Owner rule 20 (ROADMAP §4b): one container, a strong selected state, hover and focus — never
        loose pills. Phone: a segmented track (soft-fill, the selected chip filled accent-ink, fish's
        selected look); ≥768: a tab bar on the nav's full-bleed hairline, the selected tab's accent
        underline sitting on it. The scroller keeps fish's chip behaviour (scroll-into-view, spy).
      */}
      <div
        ref={rowRef}
        className="pointer-events-auto flex h-14.5 items-center overflow-x-auto bg-surface px-4 [scrollbar-width:none] md:items-stretch md:bg-transparent md:px-6 xl:px-8 [&::-webkit-scrollbar]:hidden"
      >
        <ul data-t3-section-track="" className="flex w-max shrink-0 gap-1 rounded-full bg-soft-fill p-1 md:gap-6 md:rounded-none md:bg-transparent md:p-0">
          {sections.map(s => {
            const selected = s.id === active;
            return (
              // A section with no box at this width keeps no chip pointing at it.
              <li key={s.id} className={cn('flex shrink-0', s.hideFromXl && 'xl:hidden', s.hideFromLg && 'min-[1024px]:hidden')}>
                <a
                  href={`#${s.id}`}
                  data-section={s.id}
                  aria-current={selected ? 'location' : undefined}
                  onClick={e => onChipClick(e, s.id, go)}
                  className={cn(
                    'relative flex h-8 items-center rounded-full px-3.5 t-label whitespace-nowrap outline-none',
                    'transition-[background-color,color,box-shadow,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
                    // ≥768 a tab: full height, the underline on the hairline, no pill.
                    "md:h-auto md:rounded-control md:px-0 md:t-body-strong md:after:absolute md:after:inset-x-0 md:after:bottom-0 md:after:h-0.5 md:after:rounded-full md:after:content-['']",
                    // Selected on accent-ink, not accent: 12px labels need 4.5:1 (white on accent is 4.47).
                    selected
                      ? 'bg-accent-ink text-on-accent shadow-e1 md:bg-transparent md:text-accent-ink md:shadow-none md:after:bg-accent'
                      : 'text-ink hover:bg-surface md:text-muted md:hover:bg-transparent md:hover:text-ink md:hover:after:bg-hairline',
                  )}
                >
                  {s.label}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

/** ≥1280: the section index in the left column (sticky with it). */
export function DetailSectionToc({ title = 'Pe această pagină', className }: { title?: string; className?: string }) {
  const { sections: all, active, go } = useSections();
  const sections = all.filter(s => !s.hideFromXl && !s.hideFromLg);
  if (!sections.length) return null;
  return (
    // -mx-3: the rows keep their 12px hover / active padding, while the labels and the eyebrow sit
    // on the page gutter like the breadcrumb, title and photo above them.
    <nav aria-label={title} className={cn('-mx-3 flex flex-col gap-2', className)}>
      <p className="px-3 t-eyebrow text-muted uppercase">{title}</p>
      <ul className="flex flex-col gap-0.5">
        {sections.map(s => {
          const selected = s.id === active;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={selected ? 'location' : undefined}
                onClick={e => onChipClick(e, s.id, go)}
                className={cn(
                  'relative flex h-10 items-center gap-2 rounded-control px-3 transition-colors duration-(--duration-fast)',
                  selected
                    ? 't-body-strong bg-accent-tint text-accent-ink before:absolute before:inset-y-2 before:left-0 before:w-0.75 before:rounded-full before:bg-accent'
                    : 't-body text-ink-2 hover:bg-soft-fill hover:text-ink',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {s.hint !== undefined ? (
                  // Muted, not faint: a count is information (AA on the page grey), not a disabled control.
                  <span className={cn('t-label tabular-nums', selected ? 'text-accent-ink' : 'text-muted')}>{s.hint}</span>
                ) : null}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
