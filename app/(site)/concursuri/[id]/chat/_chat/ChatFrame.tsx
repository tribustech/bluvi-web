'use client';

import Link from 'next/link';
import { ArrowTopRightOnSquareIcon, CalendarDaysIcon, ChevronRightIcon, LockClosedIcon, MapPinIcon, PhotoIcon, TrophyIcon, UserGroupIcon, UsersIcon } from '@heroicons/react/24/outline';
import { formatCount } from '@/core/realtime/chat/format';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { competitionDateProse, displayEnd } from '../../_components/dates';
import { ChatHeader } from './ChatHeader';
import { FRAME_H } from './ChatStates';
import { useChat } from './ChatController';
import { ClosedNotice } from './ClosedNotice';
import { Composer } from './Composer';
import { FollowPrompt } from './FollowPrompt';
import { MessageList } from './MessageList';
import { RoomTabs } from './RoomTabs';

/*
 * The chat's layout (participant.chat). The page never scrolls: the frame is the viewport under the
 * site bar (56 / 64, minus the offline banner), so the phone bar never conceals and nothing floats
 * (owner rule 3); each column scrolls on its own.
 *
 *  - Phone (fish full-screen chat): header attached to the top, the room switcher and the follow
 *    prompt under it, the conversation, the composer attached to the bottom (safe-area padding).
 *  - 768–1279: the same column, header + tabs over the conversation, on a surface panel.
 *  - ≥1280, three columns: left 280 — the competition card (banner, status, dates, lake, links to
 *    Clasament and Participanți) and the rooms as a vertical tab list; centre — the header, the
 *    conversation (bubbles ≤ min(82%, 560 px)) and the composer at the column's bottom; right 320 — «Poze din
 *    cameră» (the room's photos, buildRoomGallery) and quick facts.
 */

export function ChatFrame() {
  const c = useChat();
  return (
    <div className={cn(FRAME_H, 'flex bg-surface md:bg-page md:p-4 xl:grid xl:grid-cols-[280px_minmax(0,1fr)_320px] xl:gap-4 xl:px-6 2xl:px-8')}>
      <aside aria-label="Concursul" className="hidden min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain xl:flex">
        <CompetitionCard />
        <RoomTabs orientation="vertical" />
      </aside>
      <section
        aria-label="Conversația"
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-surface md:mx-auto md:max-w-200 md:rounded-card md:shadow-e1 md:ring-1 md:ring-hairline xl:mx-0 xl:max-w-none"
      >
        <ChatHeader />
        <div className="flex flex-col gap-2 border-b border-hairline px-4 py-2 empty:hidden xl:hidden">
          <RoomTabs />
        </div>
        <FollowPrompt className="mx-4 mt-3" />
        <MessageList />
        {c.closed ? <ClosedNotice closesAtMs={c.closesAtMs} /> : <Composer />}
      </section>
      <aside aria-label="Despre cameră" className="hidden min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain xl:flex">
        <RoomPhotos />
        <QuickFacts />
      </aside>
    </div>
  );
}

const STATUS: Partial<Record<string, { tone: StatusTone; label: string }>> = {
  started: { tone: 'live', label: 'Live' },
  notStarted: { tone: 'info', label: 'Viitor' },
  completed: { tone: 'neutral', label: 'Încheiat' },
  cancelled: { tone: 'cancelled', label: 'Anulat' },
};

/** ≥1280 left column: the competition (its banner opens the viewer, like the header's disc). */
function CompetitionCard() {
  const c = useChat();
  const f = c.facts;
  const name = c.competition?.name ?? f?.name;
  const banner = c.competition?.banner ? (c.competition.banner.formats.medium?.url ?? c.competition.banner.url) : (f?.bannerLarge ?? null);
  const status = STATUS[c.competition?.competitionStatus ?? f?.competitionStatus ?? ''];
  const start = c.competition?.startDate ?? f?.startDate;
  const end = c.competition ? displayEnd(c.competition) : f ? displayEnd(f) : undefined;
  const lake = c.competition?.lake?.name ?? f?.lakeName;
  if (!name) {
    return <div aria-hidden className="h-72 shrink-0 animate-shimmer rounded-card" />;
  }
  return (
    <article className="shrink-0 overflow-hidden rounded-card bg-surface shadow-e1 ring-1 ring-hairline">
      {banner ? (
        c.openBanner ? (
          <button type="button" onClick={c.openBanner} aria-label="Poza concursului" aria-haspopup="dialog" className="block w-full cursor-pointer outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent">
            {/* eslint-disable-next-line @next/next/no-img-element -- a CMS banner, sized by the column */}
            <img src={banner} alt="" className="aspect-video w-full bg-soft-fill object-cover" />
          </button>
        ) : null
      ) : (
        <div aria-hidden className="flex aspect-video w-full items-center justify-center bg-accent-tint text-accent-ink">
          <TrophyIcon className="size-10" />
        </div>
      )}
      <div className="flex flex-col gap-2 p-4">
        {status ? <StatusPill tone={status.tone} className="self-start">{status.label}</StatusPill> : null}
        <p className="t-body-strong text-ink">{name}</p>
        <ul className="flex flex-col gap-1.5 t-caption text-ink-2">
          {start && end ? (
            <li className="flex items-center gap-1.5">
              <CalendarDaysIcon aria-hidden className="size-4 shrink-0 text-accent-ink" />
              {competitionDateProse(start, end)}
            </li>
          ) : null}
          {lake ? (
            <li className="flex min-w-0 items-center gap-1.5">
              <MapPinIcon aria-hidden className="size-4 shrink-0 text-accent-ink" />
              <span className="truncate">{lake}</span>
            </li>
          ) : null}
        </ul>
      </div>
      <nav aria-label="Concursul" className="border-t border-hairline">
        <CardLink href={routes.competitionRanking(c.competitionId)} Icon={TrophyIcon} label="Clasament" />
        <CardLink href={routes.competitionParticipants(c.competitionId)} Icon={UserGroupIcon} label="Participanți" />
      </nav>
    </article>
  );
}

function CardLink({ href, Icon, label }: { href: string; Icon: typeof TrophyIcon; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-3 px-4 t-body text-ink outline-none hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent [&+&]:border-t [&+&]:border-hairline"
    >
      <Icon aria-hidden className="size-5 shrink-0 text-accent-ink" />
      <span className="flex-1">{label}</span>
      <ChevronRightIcon aria-hidden className="size-4 text-muted" />
    </Link>
  );
}

/** ≥1280 right column: every photo of the room on screen (oldest first); a tile opens the viewer. */
function RoomPhotos() {
  const c = useChat();
  const { attachments } = c.gallery;
  const shown = attachments.slice(-12);
  return (
    <section aria-labelledby="chat-poze" className="shrink-0 rounded-card bg-surface p-4 shadow-e1 ring-1 ring-hairline">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="chat-poze" className="t-heading text-ink">
          Poze din cameră
        </h2>
        {attachments.length ? <span className="t-caption text-muted">{formatCount(attachments.length, 'poză', 'poze')}</span> : null}
      </div>
      {c.current.room.isLoading ? (
        <div aria-hidden className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="aspect-square animate-shimmer rounded-control" />
          ))}
        </div>
      ) : shown.length ? (
        <ul className="grid grid-cols-3 gap-1.5">
          {shown.map((a, i) => (
            <li key={`${a.id}-${i}`}>
              <button
                type="button"
                onClick={() => c.openGallery(a.id)}
                aria-label={`Imagine ${attachments.length - shown.length + i + 1} din ${attachments.length}`}
                className="block aspect-square w-full cursor-pointer overflow-hidden rounded-control bg-soft-fill outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- chat attachments (CMS / blob URLs) */}
                <img src={a.thumbnailUrl || a.url} alt="" loading="lazy" className="size-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-control bg-soft-fill px-4 py-6 text-center">
          <PhotoIcon aria-hidden className="size-6 text-muted" />
          <p className="t-caption text-ink-2">Nicio poză în cameră încă.</p>
        </div>
      )}
    </section>
  );
}

/** ≥1280 right column: who the room reaches and whether it is open. */
function QuickFacts() {
  const c = useChat();
  const viewers = c.competition?.viewers ?? c.facts?.viewers;
  const registered = c.competition ? c.competition.registrations.filter(r => r.registrationStatus === 'registered').length : c.facts?.registered;
  const rows: { Icon: typeof UsersIcon; text: string; key: string }[] = [];
  if (viewers !== undefined) rows.push({ key: 'u', Icon: UsersIcon, text: formatCount(viewers, 'urmăritor', 'urmăritori') });
  if (registered !== undefined) rows.push({ key: 'p', Icon: UserGroupIcon, text: formatCount(registered, 'participant', 'participanți') });
  if (c.closed) rows.push({ key: 'c', Icon: LockClosedIcon, text: 'Chat închis: doar citire' });
  return (
    <section aria-labelledby="chat-despre" className="shrink-0 rounded-card bg-surface p-4 shadow-e1 ring-1 ring-hairline">
      <h2 id="chat-despre" className="mb-2 t-heading text-ink">
        Despre cameră
      </h2>
      <p className="mb-3 t-caption text-ink-2">
        {c.activeRoom === 'general' ? 'Mesajele se văd de către urmăritorii concursului.' : 'Mesajele se văd de către participanți și organizatori.'}
      </p>
      {rows.length ? (
        <ul className="flex flex-col gap-2 t-body text-ink">
          {rows.map(({ key, Icon, text }) => (
            <li key={key} className="flex items-center gap-2">
              <Icon aria-hidden className="size-5 shrink-0 text-accent-ink" />
              {text}
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={routes.competition(c.competitionId)}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-sm t-label text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        Pagina concursului
        <ArrowTopRightOnSquareIcon aria-hidden className="size-4" />
      </Link>
    </section>
  );
}
