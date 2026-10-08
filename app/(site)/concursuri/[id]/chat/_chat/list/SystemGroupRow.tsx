'use client';

import { Fragment, useId } from 'react';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type { chat } from '@/core/realtime';
import { formatCount } from '@/core/realtime/chat/format';
import { systemGroupBreakdown } from '@/core/realtime/chat/listItems';
import { systemIconFor, type SystemIcon } from '@/core/realtime/chat/systemMessages';
import { cn } from '@/components/ui/cn';
import { SystemEventIcon } from './SystemEventIcon';
import { SystemCard, SystemEventLine, type OpenWeighing } from './SystemMessageRow';

/*
 * fish SystemGroupRow (participant.chat c39): a run of ≥ 2 routine events (podium moves, weighings,
 * extra requests, sign-ups, withdrawals — core collapseSystemRuns) folded into one card: the
 * families' icons stacked, «{n} evenimente», the breakdown («3 cântăriri · 1 schimbare pe podium»)
 * and «Vezi» / «Ascunde», which opens the events INSIDE the card. Folded again on the next visit
 * (the list's state lives with the room on screen).
 */
const MAX_ICONS = 3;

function groupIcons(messages: chat.ChatListMessage[]): SystemIcon[] {
  const counts = new Map<SystemIcon, number>();
  for (const m of messages) {
    const icon = systemIconFor(m.event);
    counts.set(icon, (counts.get(icon) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_ICONS)
    .map(([icon]) => icon);
}

export function SystemGroupRow({
  item,
  competitionId,
  onToggle,
  onWeighing,
}: {
  item: chat.SystemGroupItem;
  competitionId: string;
  onToggle: (id: string) => void;
  onWeighing?: OpenWeighing;
}) {
  const icons = groupIcons(item.messages);
  const count = formatCount(item.messages.length, 'eveniment', 'evenimente');
  const breakdown = systemGroupBreakdown(item.messages);
  const panelId = useId();
  const Chevron = item.expanded ? ChevronUpIcon : ChevronDownIcon;
  return (
    <div className="mx-auto w-full max-w-180 px-4 py-1">
      <SystemCard>
        <button
          type="button"
          aria-expanded={item.expanded}
          aria-controls={panelId}
          aria-label={`${count}: ${breakdown}`}
          onClick={() => onToggle(item.id)}
          className="-mx-1.5 flex w-[calc(100%+12px)] cursor-pointer items-center gap-2.5 rounded-control px-1.5 py-2 text-left outline-none hover:bg-soft-fill/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          <span className="isolate flex shrink-0">
            {icons.map((icon, i) => (
              // The most frequent family on top (fish zIndex MAX_ICONS - index).
              <span key={icon} className={cn('relative', i > 0 && '-ml-3.5')} style={{ zIndex: MAX_ICONS - i }}>
                <SystemEventIcon icon={icon} ring={icons.length > 1} />
              </span>
            ))}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="t-body-strong text-ink">{count}</span>
            <span className="truncate t-caption text-muted">{breakdown}</span>
          </span>
          <span className="flex shrink-0 items-center gap-0.5 t-label text-accent-ink">
            {item.expanded ? 'Ascunde' : 'Vezi'}
            <Chevron aria-hidden className="size-4" />
          </span>
        </button>
        <div id={panelId} hidden={!item.expanded}>
          {item.expanded
            ? item.messages.map(m => (
                <Fragment key={m.id}>
                  <div aria-hidden className="ml-10 h-px bg-hairline" />
                  <SystemEventLine message={m} competitionId={competitionId} onWeighing={onWeighing} />
                </Fragment>
              ))
            : null}
        </div>
      </SystemCard>
    </div>
  );
}
