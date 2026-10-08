'use client';

import { Fragment } from 'react';
import type { chat } from '@/core/realtime';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { reactorName } from './model';

/*
 * fish ReactionsSheet (participant.chat c22): «Reacții» — who reacted with what, emoji → name (mine
 * «{nume} (eu)»), grouped by emoji; «Nicio reacție.» when they were all taken back. Live: the parent
 * reads the message again from the room on every snapshot. A sheet on the phone, a dialog from 768.
 */
export function ReactionsDialog({
  open,
  reactions,
  currentUserId,
  onClose,
}: {
  open: boolean;
  reactions: chat.ChatReactionSummary[];
  currentUserId: string;
  onClose: () => void;
}) {
  return (
    <ResponsiveSurface open={open} onClose={onClose} intent="info" title="Reacții" sheetSnap="fit">
      {reactions.length ? (
        <ul className="flex flex-col">
          {reactions.map((r, gi) => (
            <Fragment key={r.emoji}>
              {gi > 0 ? <li aria-hidden className="my-1.5 h-px bg-hairline" /> : null}
              {r.users.map(u => (
                <li key={`${r.emoji}-${u.userId}`} className="flex items-center gap-3 py-2">
                  <span className="w-8 text-center t-title1">{r.emoji}</span>
                  <span className="min-w-0 flex-1 truncate t-body text-ink">{reactorName(u, currentUserId)}</span>
                </li>
              ))}
            </Fragment>
          ))}
        </ul>
      ) : (
        <p className="py-4 text-center t-body text-muted">Nicio reacție.</p>
      )}
    </ResponsiveSurface>
  );
}
