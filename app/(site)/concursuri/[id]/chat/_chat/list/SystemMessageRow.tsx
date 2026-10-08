'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import type { chat } from '@/core/realtime';
import { formatTime24 } from '@/core/realtime/chat/format';
import { systemBodyFor, systemIconFor, systemLinkLabel, systemPartsFor } from '@/core/realtime/chat/systemMessages';
import { cn } from '@/components/ui/cn';
import { systemTarget, type OpenWeighingTarget, type SystemTarget } from './model';
import { SystemEventIcon } from './SystemEventIcon';

/*
 * fish SystemMessageRow (participant.chat c36–c37): a competition event is a card, never a bubble —
 * the tinted family icon, who it is about (stand chip + name in bold), what happened under it, the
 * time; the CMS copy's leading emoji is dropped (core systemPartsFor / systemBodyFor). A linked event
 * carries a chevron and opens: the ranking → Clasament, the allocation / registrations →
 * Participanți, a weighing → its detail over the chat (`onWeighing`). Penalties have no web page yet
 * (M6): no link until it exists. No menu, no reactions.
 */

export type OpenWeighing = (target: OpenWeighingTarget) => void;

export function StandChip({ label }: { label: string }) {
  return <span className="shrink-0 rounded-md bg-accent-tint px-1.5 py-px t-label text-accent-ink">{label}</span>;
}

/** The surface every standalone event and folded group sits in: a hairline card (highlighted: the leader). */
export function SystemCard({ children, highlighted = false, className }: { children: ReactNode; highlighted?: boolean; className?: string }) {
  return <div className={cn('rounded-card border bg-surface', highlighted ? 'border-accent-tint-2 p-3' : 'border-hairline px-3 py-0.5', className)}>{children}</div>;
}

/** Wraps a row in its link (Next Link) or the weighing button; plain when the event leads nowhere. */
export function SystemLink({
  target,
  label,
  onWeighing,
  className,
  children,
}: {
  target: SystemTarget;
  label: string;
  onWeighing?: OpenWeighing;
  className?: string;
  children: ReactNode;
}) {
  const cls = cn(
    'block w-full cursor-pointer rounded-control text-left outline-none hover:bg-soft-fill/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
    className,
  );
  if (target?.kind === 'href') {
    return (
      <Link href={target.href} aria-label={label} className={cls}>
        {children}
      </Link>
    );
  }
  if (target?.kind === 'weighing' && onWeighing) {
    return (
      <button type="button" aria-label={label} aria-haspopup="dialog" onClick={() => onWeighing(target)} className={cls}>
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}

/** One event as a line: icon, stand chip + name, the detail under it, time (+ chevron when linked). */
export function SystemEventLine({ message, competitionId, onWeighing }: { message: chat.ChatListMessage; competitionId: string; onWeighing?: OpenWeighing }) {
  const target = systemTarget(message.link, competitionId);
  const linked = target !== null && (target.kind === 'href' || !!onWeighing);
  const { stand, name, detail } = systemPartsFor(message);
  const cta = linked ? systemLinkLabel(message.link) : null;
  const time = formatTime24(message.createdAt?.toDate?.());
  return (
    <SystemLink target={linked ? target : null} label={`${systemBodyFor(message.text)}${cta ? `, ${cta}` : ''}`} onWeighing={onWeighing} className="-mx-1.5 px-1.5">
      <span className="flex items-center gap-2.5 py-2">
        <SystemEventIcon icon={systemIconFor(message.event)} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-1.5">
            {stand ? <StandChip label={stand} /> : null}
            {name ? <span className={cn('min-w-0 t-body-strong text-ink', detail ? 'truncate' : 'line-clamp-2')}>{name}</span> : null}
          </span>
          {detail ? <span className="line-clamp-2 t-caption text-muted">{detail}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 self-center">
          <span className="t-micro text-muted">{time}</span>
          {linked ? <ChevronRightIcon aria-hidden className="size-4 text-faint" /> : null}
        </span>
      </span>
    </SystemLink>
  );
}

export function SystemMessageRow({ message, competitionId, onWeighing }: { message: chat.ChatListMessage; competitionId: string; onWeighing?: OpenWeighing }) {
  return (
    <div className="mx-auto w-full max-w-180 px-4 py-1">
      <SystemCard>
        <SystemEventLine message={message} competitionId={competitionId} onWeighing={onWeighing} />
      </SystemCard>
    </div>
  );
}
