import Link from 'next/link';
import { useId, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { LINK_ACTION, LINK_ACTION_TEXT } from './tones';

export interface DashboardSectionProps {
  title: ReactNode;
  /** Muted line under the title («2 vin · 3 stau · 1 pleacă»). Nothing when empty. */
  caption?: ReactNode;
  /** Trailing link in the heading row («Vezi toate»), or any small control. */
  action?: { href: string; label: string; srLabel?: string } | ReactNode;
  /**
   * card: a surface card with an 18px inset (fish CONTENT_INSET), heading t-heading.
   * plain: no card — a t-title2 heading over content that brings its own surfaces (tile grids, rails).
   */
  variant?: 'card' | 'plain';
  /**
   * Card only: the ground. navy — the one dark promo card of a page (Acasă «Ia Bluvi pe baltă»):
   * navy ground (the same in both themes), white heading; body text brings its own on-navy ink
   * (lavender-3 for secondary copy). Never a glow, never the signature lavender on the heading.
   */
  tone?: 'surface' | 'navy';
  /**
   * Card only: the body runs edge to edge (row lists, tables); rows bring their own inset. The one
   * inset rule of a flush body: its first row's content starts 12px under the heading or caption
   * (the header's 4 + the row's own 8 — DashboardLines bare does it, a custom row uses pt-2).
   */
  flush?: boolean;
  /** Card only: a row under a hairline («Vezi toate (8 standuri)»). */
  footer?: ReactNode;
  /** Opacity .5 while a refetch for this section runs (fish trend card, `busy`). */
  dimmed?: boolean;
  headingLevel?: 2 | 3;
  children: ReactNode;
  className?: string;
}

function isLinkAction(a: DashboardSectionProps['action']): a is { href: string; label: string; srLabel?: string } {
  return typeof a === 'object' && a !== null && 'href' in a && 'label' in a;
}

/**
 * A titled region of a dashboard (a `<section>` named by its heading). The id comes from
 * React's useId, so the same section can sit in the stacked and the column composition at once.
 */
export function DashboardSection({
  title,
  caption,
  action,
  variant = 'card',
  tone = 'surface',
  flush,
  footer,
  dimmed,
  headingLevel = 2,
  children,
  className,
}: DashboardSectionProps) {
  const id = useId();
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const card = variant === 'card';
  const navy = card && tone === 'navy';
  const actionEl = isLinkAction(action) ? (
    <Link
      href={action.href}
      aria-label={action.srLabel}
      // 44px target; -my-3 keeps the heading row at its text height.
      className={cn(LINK_ACTION, '-my-3')}
    >
      {action.label}
    </Link>
  ) : (
    action
  );

  return (
    <section aria-labelledby={id} className={cn(card && 'overflow-hidden rounded-card', card && (navy ? 'bg-navy' : 'bg-surface shadow-e0'), className)}>
      <div className={cn('flex items-start gap-3', card ? 'px-4.5 pt-4.5' : 'pb-3', card && (flush ? 'pb-1' : 'pb-3'))}>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <H id={id} className={cn(navy ? 'text-on-photo-scrim' : 'text-ink', card ? 't-heading' : 't-title2')}>
            {title}
          </H>
          {caption ? <p className={cn('t-caption', navy ? 'text-lavender-3' : 'text-muted')}>{caption}</p> : null}
        </div>
        {actionEl ? <div className="flex shrink-0 items-center">{actionEl}</div> : null}
      </div>
      <div
        className={cn(
          'transition-opacity duration-(--duration-fast) ease-fast',
          card && !flush && 'px-4.5 pb-4.5',
          dimmed && 'opacity-50',
        )}
      >
        {children}
      </div>
      {card && footer ? <div className="border-t border-hairline">{footer}</div> : null}
    </section>
  );
}

/** A centred link row for a section footer («Vezi toate (8 standuri)»). */
export function SectionFooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={cn('flex min-h-11 w-full items-center justify-center px-4.5 py-3 transition-colors duration-(--duration-fast) hover:bg-soft-fill', LINK_ACTION_TEXT)}
    >
      {children}
    </Link>
  );
}
