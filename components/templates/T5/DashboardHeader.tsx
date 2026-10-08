import type { ReactNode } from 'react';
import { DetailBackButton } from '@/components/templates/T3/DetailBackButton';
import { cn } from '@/components/ui/cn';

export interface DashboardHeaderProps {
  /** The h1: the lake's name, «Panou organizator», «Bună, Andrei». */
  title: ReactNode;
  /** Under the title: «Azi, sâmbătă 4 oct.» — what «azi» means for every number below. */
  caption?: ReactNode;
  /**
   * Phone back control — the templates' one back button (T3 DetailBackButton, fish BackButton):
   * history back, or `href` when the page was opened directly. From 768 the shell's breadcrumb band
   * takes over, so it is not rendered there.
   */
  back?: { href: string; label?: string; inApp?: boolean };
  /** Trailing controls (refresh, a primary action). Icon-sized on a phone, labelled from 768. */
  actions?: ReactNode;
  className?: string;
}

/**
 * T5 header. Phone (<768): the fish panel header — a surface band under the top bar (the ground
 * the 48px soft-fill chips of T3 headerChipClass are drawn for), back button, title centred
 * (title1, up to two balanced lines, so a long lake name is never cut) with the caption under it,
 * the actions (or an equal spacer) balancing the back button so the title stays optically centred.
 * From 768: a left-aligned page title (t-page-title) and caption on the page ground, the actions on
 * the right edge, centred on the title block. No eyebrow: from 768 the shell's breadcrumb band
 * carries the hierarchy («Acasă / Administrare / Chita Lake») one line above.
 */
export function DashboardHeader({ title, caption, back, actions, className }: DashboardHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-center gap-3 pt-2 md:gap-4 md:pt-6 xl:pt-8',
        // The phone band runs edge to edge: it pulls back by the shell's 16px gutter.
        'max-md:-mx-4 max-md:border-b max-md:border-hairline max-md:bg-surface max-md:px-4 max-md:pb-3',
        className,
      )}
    >
      {back ? (
        // A 48px slot (the icon button's size below 1280), so the back chip and a trailing icon
        // button balance and the title stays optically centred.
        <span className="flex w-12 shrink-0 md:hidden">
          <DetailBackButton fallbackHref={back.href} label={back.label} inApp={back.inApp} />
        </span>
      ) : null}
      <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5 md:text-left', back ? 'text-center' : 'text-left')}>
        <h1 className="t-title1 text-ink max-md:line-clamp-2 max-md:text-balance md:truncate md:t-page-title">{title}</h1>
        {caption ? <p className="truncate t-caption text-muted md:t-body">{caption}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : back ? (
        // Balances the back button so the title is centred on a phone.
        <span aria-hidden className="w-12 shrink-0 md:hidden" />
      ) : null}
    </header>
  );
}
