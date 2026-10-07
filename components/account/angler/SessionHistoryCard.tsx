'use client';

import { ChevronRightIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { CardShell, CardTitle } from '@/components/cards';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { fmtKg, fmtSpan, venueSubtitle } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { figureLabel, fmtSessionRange, type PublicSession } from '@/core/social';
import { partidaHref } from '@/lib/routes';

/*
 * A session on the profile's Sesiuni tab — fish components/profile/SessionHistoryCard.tsx (cards E
 * and F of mock 11a; parity account.angler-profile c23–c25), on the kit card (CardShell + CardTitle:
 * the stretched link once the card opens something).
 *  - The VENUE is the title (fallback «Partidă») with «{localitate} · {stand}» under it; the
 *    angler's name is deliberately absent — you are on their profile.
 *  - Three figures: «{n} captură/capturi» («20 / de capturi», formatCount's plural), «{total} kg total» («—» when unknown), the length
 *    labelled «durată» — or «de pescuit» while live, ticking.
 *  - The photo strip (at most three tiles, the last «+N» when there are more) with the total count.
 *  - Live: the «Live» ribbon, the card's glow, the footer «Începută acum {span}» (ticking).
 *    Finished: the date range «26 IUL · 06:40 – 18:10» («17 FEB 14:32 – 18 FEB 12:54» past
 *    midnight — core fmtSessionRange), omitted when endedAt is missing (a CMS
 *    predating it — never a wrong «Începută acum 2160h»).
 *  - c25: the whole card opens the partidă (fish /partide/comunitate/{id} → the web's
 *    /partide/[documentId], lib/routes partidaHref — the member view when it is the viewer's own),
 *    with c24's «Vezi partida» (live) / «Vezi rezumatul» (ended) in the footer.
 * Dates are Romania time (the server render and the browser agree).
 */

const TICK_MS = 30_000;
const subscribeTick = (cb: () => void) => {
  const id = window.setInterval(cb, TICK_MS);
  return () => window.clearInterval(id);
};

/** A clock that only exists in the browser (null on the server and while hydrating), ticking every 30s. */
export function useNowTick(): number | null {
  return useSyncExternalStore(
    subscribeTick,
    () => Math.floor(Date.now() / TICK_MS) * TICK_MS,
    () => null,
  );
}

/** fish fmtRange in Romania time — core fmtSessionRange (the end day named when it differs). */
export const sessionRange = fmtSessionRange;

const PHOTO_TILES = 3;

export function SessionHistoryCard({ session }: { session: PublicSession }) {
  const now = useNowTick();
  const startedMs = new Date(session.startedAt).getTime();
  const live = session.isActive;
  // Live: the CMS sends durationMs 0 (it is computed from endedAt), so a live card's length only
  // exists with a clock — on the server and while hydrating it is «—», never «0 min» (rule 4).
  const duration = live ? (now != null ? fmtSpan(Math.max(0, now - startedMs)) : '—') : fmtSpan(session.durationMs);
  const photos = session.photos ?? [];
  const photoTotal = Math.max(session.photoCount ?? photos.length, photos.length);
  const shown = photos.slice(0, PHOTO_TILES);
  const hidden = photoTotal - shown.length;
  const subtitle = venueSubtitle(session.locality ?? null, session.standName ?? null);
  const footerLeft = live
    ? now != null
      ? `Începută acum ${fmtSpan(Math.max(0, now - startedMs))}`
      : null
    : session.endedAt
      ? sessionRange(session.startedAt, session.endedAt)
      : null;
  const href = partidaHref(session.documentId);

  return (
    <CardShell
      interactive={!!href}
      className={cn('h-full w-full gap-3 p-4', live && 'ring-2 ring-status-live-fg/30 shadow-[var(--shadow-e2),var(--shadow-e0)]')}
      label={live ? `${session.venueName ?? 'Partidă'}, în desfășurare` : undefined}
    >
      <header className="flex min-h-11 items-center gap-3">
        <Thumb url={session.photoUrl} />
        <span className="flex min-w-0 flex-1 flex-col">
          <CardTitle href={href ?? undefined} className="line-clamp-2 t-body-strong text-ink">
            {session.venueName ?? 'Partidă'}
          </CardTitle>
          {subtitle ? <span className="truncate t-caption text-muted">{subtitle}</span> : null}
        </span>
        {live ? (
          <span className="shrink-0 self-start" data-testid="session-live">
            <StatusPill tone="live">
              <span aria-hidden className="size-1.5 rounded-full bg-current animate-live motion-reduce:animate-none" />
              Live
            </StatusPill>
          </span>
        ) : null}
      </header>
      <dl className="grid grid-cols-3 divide-x divide-hairline rounded-control bg-page py-2.5" data-testid="session-stats">
        <Stat label={figureLabel(session.catches, 'captură', 'capturi')} value={String(session.catches)} />
        <Stat label="kg total" value={session.totalKg == null ? '—' : fmtKg(session.totalKg)} accent={session.totalKg != null} />
        <Stat label={live ? 'de pescuit' : 'durată'} value={duration} />
      </dl>
      {shown.length ? (
        <ul aria-label={formatCount(photoTotal, 'fotografie', 'fotografii')} className="grid grid-cols-3 gap-1.5" data-testid="session-photos">
          {shown.map((p, i) => {
            const more = hidden > 0 && i === shown.length - 1;
            return (
              <li key={i} className="relative flex aspect-square items-center justify-center overflow-hidden rounded-control bg-soft-fill">
                <PhotoIcon aria-hidden className="size-6 text-faint" />
                <StripPhoto src={p.thumbUrl ?? p.url} />
                {more ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-photo-scrim t-heading text-on-photo-scrim" data-testid="session-photos-more">
                    +{hidden}
                  </span>
                ) : p.weightKg != null ? (
                  <span className="absolute bottom-1 left-1 rounded-badge bg-photo-scrim px-1.25 t-micro-strong text-on-photo-scrim">
                    {fmtKg(p.weightKg)}
                    {' '}kg
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
      {footerLeft || href ? (
        <footer className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-hairline pt-2.5">
          {footerLeft ? (
            <span className="t-caption text-muted tabular-nums" data-testid="session-footer">
              {footerLeft}
            </span>
          ) : null}
          {href ? (
            <span aria-hidden className="ml-auto inline-flex items-center gap-0.5 t-button-compact text-accent-ink">
              {live ? 'Vezi partida' : 'Vezi rezumatul'}
              <ChevronRightIcon className="size-4" />
            </span>
          ) : null}
        </footer>
      ) : null}
    </CardShell>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: ReactNode; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center px-1">
      <dt className="t-micro text-muted">{label}</dt>
      <dd className={cn('order-first t-heading tabular-nums', accent ? 'text-accent-ink' : 'text-ink')}>{value}</dd>
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <span aria-hidden className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-control bg-accent-tint text-accent-ink">
      <PhotoIcon className="size-5" />
      {url && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- CMS rendition at thumb size.
        <img src={url} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />
      ) : null}
    </span>
  );
}

function StripPhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element -- CMS thumb rendition.
  return <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="absolute inset-0 size-full object-cover" />;
}
