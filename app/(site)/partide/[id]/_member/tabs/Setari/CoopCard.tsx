'use client';

import { useCallback } from 'react';
import { ArrowPathIcon, ShareIcon, UserMinusIcon, UsersIcon } from '@heroicons/react/24/outline';
import { Avatar, toneForId } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { partidaInviteMessage, type SessionMember } from '@/core/partide';
import { useSiteToast } from '../../../../../_shell/Toast';
import { membersLabel } from './model';
import { CARD } from './parts';

/*
 * «Partidă în echipă» (fish features/partide/components/CoopCard.tsx; c1, c2): the join code large
 * and spaced, «Invită» (live) — the Web Share API with fish's message, else the message is copied
 * and a toast says so —, «Schimbă codul» (owner, live), and the roster: avatar, name («Pescar»
 * fallback), «Organizator» under the host and, for the owner of a live partidă, «Elimină {name}» on
 * every other member. An ended partidă keeps the code and the roster, read-only.
 */

export function CoopCard({
  joinCode,
  members,
  hostUid,
  viewerUid,
  canShareJoinCode,
  canManageMembers,
  canRotateJoinCode,
  onKickMember,
  onRotateJoinCode,
}: {
  joinCode: string;
  members: SessionMember[];
  hostUid: string | null;
  viewerUid: string | null;
  canShareJoinCode: boolean;
  canManageMembers: boolean;
  canRotateJoinCode: boolean;
  onKickMember: (member: SessionMember) => void;
  onRotateJoinCode: () => void;
}) {
  const toast = useSiteToast();
  const onInvite = useCallback(async () => {
    const text = partidaInviteMessage(joinCode);
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast('Invitația a fost copiată.', 'success');
    } catch {
      // A dismissed share sheet (fish: Share.share(...).catch(() => {})).
    }
  }, [joinCode, toast]);

  return (
    <section aria-labelledby="setari-coop" data-testid="setari-coop" className={cn(CARD, 'flex flex-col gap-4 p-4 xl:p-5')}>
      <h2 id="setari-coop" className="flex items-center gap-2 t-eyebrow text-muted uppercase">
        <UsersIcon aria-hidden className="size-4 stroke-2 text-accent" />
        Partidă în echipă
      </h2>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span id="setari-cod-label" className="t-caption text-muted">
            Cod de acces
          </span>
          <p aria-labelledby="setari-cod-label" data-testid="setari-join-code" className="t-num-26 tracking-[0.2em] text-accent-ink">
            {joinCode}
          </p>
        </div>
        {canShareJoinCode ? (
          <Button icon={<ShareIcon />} aria-label={`Invită — distribuie codul de acces ${joinCode}`} onClick={() => void onInvite()}>
            Invită
          </Button>
        ) : null}
      </div>

      {canRotateJoinCode ? (
        <Button variant="outline" size="compact" icon={<ArrowPathIcon />} className="self-start" onClick={onRotateJoinCode}>
          Schimbă codul
        </Button>
      ) : null}

      {members.length ? (
        <div className="flex flex-col gap-1 border-t border-hairline pt-3">
          <p data-testid="setari-members-count" className="t-caption text-muted">
            {membersLabel(members.length)}
          </p>
          <ul aria-label="Membri" className="flex flex-col">
            {members.map(m => {
              const name = m.name ?? 'Pescar';
              const isHost = m.uid === hostUid;
              return (
                <li key={m.uid} data-testid="setari-member" className="flex min-h-14 items-center gap-3 py-1.5">
                  <Avatar name={name} src={m.avatar} size={40} tone={toneForId(m.uid)} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate t-body text-ink">
                      {name}
                      {m.uid === viewerUid ? <span className="text-muted"> (tu)</span> : null}
                    </span>
                    {isHost ? <span className="t-caption font-bold text-accent-ink">Organizator</span> : null}
                  </span>
                  {canManageMembers && !isHost ? (
                    <button
                      type="button"
                      aria-label={`Elimină ${name}`}
                      title={`Elimină ${name}`}
                      onClick={() => onKickMember(m)}
                      className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-control bg-status-danger-bg text-status-danger-fg transition-[filter] duration-(--duration-fast) hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:opacity-80"
                    >
                      <UserMinusIcon aria-hidden className="size-5" />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
