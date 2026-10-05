'use client';

import Link from 'next/link';
import { createContext, use, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { ICON_TILE, ICON_TILE_SOLID, LINK_ACTION, TONE_SQUARE, type T5Tone } from './tones';

type LinesContext = { bare: boolean; dense: boolean };
const Context = createContext<LinesContext>({ bare: false, dense: false });

/**
 * A card of summary lines separated by hairlines (fish panel «anulări / de evaluat», Acasă «Balta
 * mea» rows). Render only the lines that carry news; when none do, render nothing — or pass an
 * explicit «all clear» line.
 */
export function DashboardLines({
  label,
  bare = false,
  dense = false,
  children,
  className,
}: {
  label?: string;
  /**
   * Inside a <DashboardSection flush> (which brings the card and the heading): no card of its own,
   * and the first line sits 12px under the heading (the flush sections' one inset rule).
   */
  bare?: boolean;
  /**
   * A narrow column (the 264–320px «ce mă așteaptă» aside): the action moves under the text, the
   * title keeps to two lines and the description to one, so a line never stacks into a ragged
   * block. Pass a short title there («2 anulări de pescari»).
   */
  dense?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <ul aria-label={label} className={cn('divide-y divide-hairline', !bare && 'overflow-hidden rounded-card bg-surface shadow-e0', className)}>
      <Context value={{ bare, dense }}>{children}</Context>
    </ul>
  );
}

export interface DashboardLineProps {
  tone?: T5Tone;
  /** A 24px outline Heroicon, in the page's 36px icon tile… */
  icon: ReactNode;
  /** …or a 20px solid presence mark (the «Nimic de rezolvat» check). */
  solid?: boolean;
  title: ReactNode;
  description?: ReactNode;
  /** A text link, never a filled button (the alert owns the page's one button). */
  action?: { href: string; label: string; srLabel?: string };
}

export function DashboardLine({ tone = 'neutral', icon, solid = false, title, description, action }: DashboardLineProps) {
  const { bare, dense } = use(Context);
  const link = action ? (
    <Link href={action.href} aria-label={action.srLabel} className={cn(LINK_ACTION, dense ? '-mt-1.5 -mb-3 self-start' : '-my-3')}>
      {action.label}
    </Link>
  ) : null;
  return (
    <li className={cn('flex gap-3 p-4.5', dense ? 'items-start' : 'items-center', bare && 'first:pt-2')}>
      <span aria-hidden className={cn(solid ? ICON_TILE_SOLID : ICON_TILE, TONE_SQUARE[tone])}>
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {/* Dense: a long title wraps to two balanced lines at most, never an orphaned word. */}
        <p className={cn('t-body-strong text-ink', dense && 'line-clamp-2 text-pretty')}>{title}</p>
        {description ? <p className={cn('t-caption text-muted', dense && 'truncate')}>{description}</p> : null}
        {dense ? link : null}
      </div>
      {dense ? null : link}
    </li>
  );
}
