import type { ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ICON_TILE, TONE_SQUARE, type T5Tone } from './tones';

export interface DashboardAlertProps {
  tone?: T5Tone;
  /** A 24px outline Heroicon, at its own size in the 36px tile. */
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** The only filled button of the page: the one thing owed a reply («Răspunde»). */
  action?: { href: string; label: string; srLabel?: string };
  className?: string;
}

/**
 * Description colour per tone: amber and pending read in their own ink (fish #96700B for amber),
 * so the icon square and the line under the title are one pair; the rest muted.
 */
const DESCRIPTION: Record<T5Tone, string> = {
  amber: 'text-status-warning-fg',
  pending: 'text-status-pending-fg',
  red: 'text-status-danger-fg',
  indigo: 'text-muted',
  green: 'text-muted',
  neutral: 'text-muted',
};

/**
 * The dashboard's call to action (fish features/bookings/ui/AlertCard): tinted icon square,
 * title + one line of detail, the page's one filled button (48 / 40 from 1280, the kit default —
 * the same height as the header's controls, so the row lines up with them). Shown only while there is
 * something to do — a quiet day never opens on an empty alert.
 */
export function DashboardAlert({ tone = 'pending', icon, title, description, action, className }: DashboardAlertProps) {
  return (
    // Below 768 the action takes its own full-width row under the text, so the title and the
    // detail keep the card's width; from 768 one row.
    <div className={cn('flex flex-col gap-3 rounded-card bg-surface p-4.5 shadow-e0 md:flex-row md:items-center', className)}>
      <div className="flex min-w-0 flex-1 items-start gap-3 md:items-center">
        <span aria-hidden className={cn(ICON_TILE, TONE_SQUARE[tone])}>
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="t-heading text-ink">{title}</p>
          {description ? <p className={cn('t-caption', DESCRIPTION[tone])}>{description}</p> : null}
        </div>
      </div>
      {action ? (
        <ButtonLink href={action.href} aria-label={action.srLabel} className="w-full md:w-auto">
          {action.label}
        </ButtonLink>
      ) : null}
    </div>
  );
}
