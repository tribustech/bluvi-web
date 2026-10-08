'use client';

import Link from 'next/link';
import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { FULL_BLEED_RULE, SHELL_GUTTERS, SHELL_MAX } from '@/components/nav/shell';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { cn } from '@/components/ui/cn';
import { T4_HEADER_TOP, type T4Offset } from './T4Frame';
import { T4ProgressPlaceholder } from './T4Steps';

/** Back: a link (leave the flow / the previous route) or a button (previous step, in-page). */
export type T4Back = { label: string } & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

type Props = {
  /** The current step's title (h1): «Alege standul și intervalul» — or a skeleton node while it is unknown (rule 4). */
  title: ReactNode;
  /** Context over the title, caps: «Chita Lake · Rezervare» (a skeleton may hold a grey bar in it). */
  eyebrow?: ReactNode;
  /** id of the h1, so a screen can move focus to it (a dismissed notice, a reset). */
  titleId?: string;
  /**
   * Only for a gate that can turn into step 1 IN PLACE (a load error after «Reîncearcă», signed
   * out): the segment row as an empty track at rest for `reserve` steps, plus the counter line's
   * height from 768, so the header is as tall as the step header and nothing under it jumps when
   * the state resolves. Terminal states (sent, missing, nothing to book) never pass it.
   */
  reserve?: number;
  /** 1-based. With `total`, prints «Pasul 1 din 3». */
  step?: number;
  total?: number;
  /** After the step counter, separated by «·»: <T4SaveStatus>, «Gratuit», … */
  status?: ReactNode;
  /**
   * The flow autosaves: keep the status line below 768 even while there is no status (idle), so
   * the sticky header does not grow 20px on the first «Se salvează…».
   */
  reserveStatus?: boolean;
  back?: T4Back;
  /** Right of the title: delete draft, help. */
  trailing?: ReactNode;
  /** <T4Progress>, under the title row below 1280. */
  progress?: ReactNode;
  offset?: T4Offset;
  /** The back control is inert while a submit runs (fish freezes the header during publish). */
  busy?: boolean;
  /**
   * Changes with the step (its id). On every change after the first render the h1 takes focus
   * (without scrolling), so «Continuă» / «Înapoi» / a step-list jump announce the new step and
   * keyboard users start at its top instead of on the CTA at the bottom.
   */
  focusKey?: string | number;
  className?: string;
};

/**
 * fish's wizard back button: the soft-fill square with an ink glyph and a visible hover
 * (brightness), the same chip as T3's back (headerChipClass); 48 / 40 from 1280.
 */
const BACK = headerChipClass();

/**
 * T4 header band: back · eyebrow · title · «Pasul n din N · autosave» · trailing, then the segment
 * progress (below 1280). Full-bleed surface under the top bar with a hairline edge; sticky below
 * 1280 so the step and its save state stay in view while a long step scrolls (fish keeps its
 * header fixed above the ScrollScreen); from 1280 it scrolls away and the rail keeps the steps.
 * Its row is the shell's column (SHELL_MAX), so the back control sits on the top bar's left edge.
 * Below 768, when `progress` is shown, «Pasul n din N» is left to the segment bar (it says the
 * same) — the sticky chrome stays short on a phone; the save status still shows.
 */
export function T4Header({
  title,
  eyebrow,
  titleId,
  reserve,
  step,
  total,
  status,
  reserveStatus = false,
  back,
  trailing,
  progress: progressProp,
  offset = 'shell',
  busy = false,
  focusKey,
  className,
}: Props) {
  const reserved = Boolean(reserve) && !(step && total) && !progressProp;
  const progress = reserved ? <T4ProgressPlaceholder steps={reserve ?? 3} /> : progressProp;
  const counter = step && total ? `Pasul ${step} din ${total}` : null;
  const h1 = useRef<HTMLHeadingElement>(null);
  const firstKey = useRef(focusKey);
  useEffect(() => {
    if (focusKey === undefined || focusKey === firstKey.current) return;
    firstKey.current = focusKey;
    h1.current?.focus({ preventScroll: true });
  }, [focusKey]);
  // On a phone the counter yields to the segment bar; the line stays only for a status (or its
  // reserved place, when the flow autosaves).
  const counterClass = progress ? 'hidden md:inline' : undefined;
  const lineClass = progress && !status && !reserveStatus ? 'hidden md:flex' : 'flex';
  return (
    <header
      // Full bleed wherever it is rendered (inside the shell's <main>, whose column stops at
      // SHELL_MAX): its white and hairline are pseudo-elements run edge to edge (nav/shell.tsx
      // FULL_BLEED_BG / _RULE, without their `relative`: the header is sticky, or relative from 1280).
      className={cn(
        'isolate z-sticky',
        "before:absolute before:inset-y-0 before:-inset-x-[100vmax] before:z-behind before:bg-surface before:content-['']",
        FULL_BLEED_RULE,
        'sticky xl:relative xl:top-0',
        T4_HEADER_TOP[offset],
        className,
      )}
    >
      <div className={cn('mx-auto pt-2 pb-3 md:pt-4 md:pb-4 xl:py-6', SHELL_MAX, SHELL_GUTTERS)}>
        <div className="flex items-center gap-3 xl:gap-4">
          {back ? <BackControl back={back} busy={busy} /> : null}
          <div className="min-w-0 flex-1">
            {eyebrow ? <p className="t-eyebrow truncate text-muted uppercase">{eyebrow}</p> : null}
            <h1
              ref={h1}
              id={titleId}
              tabIndex={focusKey === undefined && !titleId ? undefined : -1}
              className="t-title1 text-ink outline-none md:t-page-title"
            >
              {title}
            </h1>
            {reserved ? (
              // The counter line's height, from 768 (below it the segment row stands in for it).
              <div aria-hidden className="t-caption mt-0.5 hidden min-h-5 md:block" />
            ) : null}
            {counter || status || reserveStatus ? (
              <div className={cn('t-caption mt-0.5 min-h-5 min-w-0 items-center gap-1.5 text-muted', lineClass)}>
                {counter ? <span className={cn('shrink-0', counterClass)}>{counter}</span> : null}
                {counter && status ? (
                  <span aria-hidden className={cn('shrink-0', counterClass)}>
                    ·
                  </span>
                ) : null}
                {status}
              </div>
            ) : null}
          </div>
          {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
        </div>
        {progress ? <div className="mt-3 md:mt-4 xl:hidden">{progress}</div> : null}
      </div>
    </header>
  );
}

function BackControl({ back, busy }: { back: T4Back; busy: boolean }) {
  const icon = <ChevronLeftIcon aria-hidden />;
  if (back.href !== undefined && !busy) {
    return (
      <Link href={back.href} aria-label={back.label} className={BACK}>
        {icon}
      </Link>
    );
  }
  return (
    <button
      type="button"
      aria-label={back.label}
      aria-disabled={busy || undefined}
      onClick={busy ? undefined : back.onClick}
      className={cn(BACK, busy && 'cursor-not-allowed opacity-50 hover:brightness-100 active:opacity-50')}
    >
      {icon}
    </button>
  );
}
