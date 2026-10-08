'use client';

import { CalendarDaysIcon, NoSymbolIcon, TicketIcon } from '@heroicons/react/24/outline';
import { DashboardAction, DashboardActions } from '@/components/templates/T5';
import { formatCount } from '@/core/realtime/chat/format';
import { panelLinks } from './model';

/**
 * c6 / c7 — fish QuickActionsRow + OperatorQuickAction: Calendar → Rezervări (pending badge, «99+»,
 * nothing at 0) → Blocaje, in this order.
 *
 * bar (below 1280): the T5 sticky row — a card at rest that pins under the top bar as a full-bleed
 * bar attached to the top edge (owner rule 3: it never floats), so the three stay one tap away while
 * the page scrolls under them, without covering anything at rest. Pinned it turns compact (fish
 * pinProgress / labelOpacity: icons only on a phone, ~56px), so it does not hide a fifth of the page.
 * The pending count is the bar's one unread signal: fish's solid red pill with white digits
 * (OperatorQuickAction $red6), in the bar and the list alike; the amber «în așteptare» tone stays the
 * alert card's.
 * list (from 1280): the left column's shortcuts card (DashboardActions list), the lake as its fact line.
 */
export function QuickActions({
  lakeId,
  lakeName,
  pending,
  stands,
  layout,
}: {
  lakeId: string;
  lakeName: string;
  pending: number;
  /** The lake's stand total, the card's one line of fact (0: no line). */
  stands: number;
  layout: 'bar' | 'list';
}) {
  const links = panelLinks(lakeId, pending);
  return (
    <DashboardActions
      label="Scurtături bălții"
      layout={layout}
      compactWhenStuck
      // The page's h1 already names the lake: the card says what it holds, the lake as its fact line.
      title={layout === 'list' ? 'Scurtături' : undefined}
      caption={layout === 'list' ? [lakeName, stands > 0 ? formatCount(stands, 'stand', 'standuri') : null].filter(Boolean).join(' · ') : undefined}
    >
      <DashboardAction href={links.calendar} label="Calendar" icon={<CalendarDaysIcon />} tone="accent" />
      <DashboardAction
        href={links.bookings}
        label="Rezervări"
        icon={<TicketIcon />}
        tone="accent"
        badge={pending}
        badgeTone="alert"
        badgeLabel={pending === 1 ? 'cerere în așteptare' : 'cereri în așteptare'}
      />
      <DashboardAction href={links.blocks} label="Blocaje" icon={<NoSymbolIcon />} tone="danger" />
    </DashboardActions>
  );
}
