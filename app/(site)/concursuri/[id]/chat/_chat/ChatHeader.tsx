'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftIcon, BellIcon, BellSlashIcon } from '@heroicons/react/24/outline';
import { competitionFollowersQuery } from '@/core/competitions';
import { FollowersList, followersSubtitle } from '@/components/cards/FollowersList';
import { IconButton } from '@/components/nav/IconButton';
import { Dialog } from '@/components/surfaces/Dialog';
import { Sheet } from '@/components/surfaces/Sheet';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { cn } from '@/components/ui/cn';
import { getInitials } from '@/components/ui/initials';
import { anglerHref } from '@/lib/routes';
import { pageTransport } from '../../_components/transport';
import { useChat } from './ChatController';

/*
 * fish ChatHeader (participant.chat.c1–c3, c9, c41), attached to the top of the chat:
 *  - back «Înapoi la concurs» (c41: a plain back when the competition is underneath, else the
 *    competition page replaces the chat);
 *  - the round banner (fish thumbnail → small → original; a button opening it large, c3) or the
 *    name's initials on the indigo disc;
 *  - the competition's name (the server's read: titled at first paint), the subtitle — the typing
 *    label, else «N urmăritori» (General: a button opening the followers list) / «N participanți»;
 *  - the bell for a room that pushes to the viewer (c9), crossed and red when muted.
 * Grey bars instead of the title and subtitle only while nothing names the room yet; once the
 * browser's read failed too (and the server had nothing), the title is «Chat» (fish).
 */

/** fish strips what is not a letter before taking the initials («Cupa 2026» → «CU»). */
const initialsOf = (name: string) => getInitials(name.replace(/[^\p{L}\s]/gu, '').trim() || name);

export function ChatHeader({ className }: { className?: string }) {
  const c = useChat();
  // fish ChatScreen: placeholders only while the competition loads, then the room is titled «Chat».
  const name = c.competition?.name ?? c.facts?.name ?? (c.competitionFailed ? 'Chat' : null);
  const thumb = c.competition?.banner ? (c.competition.banner.formats.small?.url ?? c.competition.banner.url) : (c.facts?.bannerThumb ?? null);
  const loading = !name;

  return (
    <header className={cn('flex min-h-16 items-center gap-2.5 border-b border-hairline bg-surface py-2 pr-2 pl-1 md:pr-3 md:pl-2', className)}>
      <IconButton aria-label="Înapoi la concurs" onClick={c.back} size="size-11">
        <ArrowLeftIcon aria-hidden />
      </IconButton>
      {loading ? (
        <span aria-hidden className="size-10 shrink-0 animate-shimmer rounded-full" />
      ) : thumb ? (
        c.openBanner ? (
          <button
            type="button"
            onClick={c.openBanner}
            aria-label="Poza concursului"
            aria-haspopup="dialog"
            className="shrink-0 cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a 40px CMS thumbnail */}
            <img src={thumb} alt="" className="size-10 rounded-full bg-soft-fill object-cover" />
          </button>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="size-10 shrink-0 rounded-full bg-soft-fill object-cover" />
        )
      ) : (
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent t-micro-strong text-on-accent">
          {initialsOf(name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {loading ? (
          <div role="status" aria-label="Se încarcă chatul" className="flex flex-col gap-1.5">
            <span aria-hidden className="block h-3.5 w-3/5 animate-shimmer rounded-full" />
            <span aria-hidden className="block h-2.5 w-1/3 animate-shimmer rounded-full" />
          </div>
        ) : (
          <>
            <h1 className="truncate t-heading text-ink">{name}</h1>
            {c.openFollowers ? (
              <button
                type="button"
                onClick={c.openFollowers}
                aria-haspopup="dialog"
                aria-label={`${c.subtitle}, vezi lista`}
                className="block max-w-full cursor-pointer truncate rounded-sm text-left t-caption text-muted hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
              >
                {c.subtitle}
              </button>
            ) : (
              <p aria-live="polite" className={cn('truncate t-caption', c.typingLabel ? 'text-accent-ink' : 'text-muted')}>
                {c.subtitle || ' '}
              </p>
            )}
          </>
        )}
      </div>
      {c.bell.show ? (
        <IconButton
          aria-label={c.bell.muted ? 'Activează notificările' : 'Oprește notificările'}
          aria-haspopup="dialog"
          disabled={c.bell.disabled}
          onClick={c.bell.open}
          size="size-11"
          className={cn(c.bell.muted ? 'text-status-danger-fg' : 'text-accent-ink', 'disabled:cursor-not-allowed disabled:opacity-50')}
        >
          {c.bell.muted ? <BellSlashIcon aria-hidden /> : <BellIcon aria-hidden />}
        </IconButton>
      ) : null}
    </header>
  );
}

/** c3: the competition's followers — phone sheet (fish FollowersListSheet), a dialog from 768. */
export function FollowersSurface() {
  const c = useChat();
  const breakpoint = useBreakpoint();
  const t = useMemo(() => pageTransport(), []);
  const { data, isPending, isError, refetch, isFetching } = useQuery({ ...competitionFollowersQuery(t, c.competitionId), enabled: c.followersOpen });
  const body = <FollowersList followers={data} pending={isPending} error={isError} retrying={isFetching} onRetry={() => void refetch()} hrefFor={anglerHref} />;
  if (breakpoint === 'mobile') {
    return (
      <Sheet open={c.followersOpen} onClose={c.closeFollowers} title="Urmăritori" subtitle={followersSubtitle(data)} initialSnap={0.9}>
        {body}
      </Sheet>
    );
  }
  return (
    <Dialog open={c.followersOpen} onClose={c.closeFollowers} title="Urmăritori" subtitle={followersSubtitle(data)} closeButton>
      <div className="-mx-5 max-h-[60dvh] overflow-y-auto px-5">{body}</div>
    </Dialog>
  );
}
