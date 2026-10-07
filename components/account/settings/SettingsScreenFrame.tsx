'use client';

import type { ReactNode } from 'react';
import { useBack } from '@/components/nav/useBack';
import { ListHeader, ListPage } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { SETTINGS_ASIDE, SETTINGS_BODY, SETTINGS_COLUMN, SETTINGS_STACK } from './styles';

/**
 * The frame of a settings screen (fish: BackButton + heading2 over a #F4F5F7 ScrollScreen of cards):
 * - the header: the back control (history when the page before is the site's own, else
 *   `backFallback` — components/nav/useBack) and the screen's h1;
 * - the body: the cards on the page ground, 16 apart (24 from 768).
 * Width — the edges of /notificari (account.notifications), so the header never moves between them:
 * phone, the cards edge to the 16px gutters (fish's 20px padding); 768–1279 one column up to 720,
 * centred; from 1280 the header and cards anchored to the shell's left gutter, capped at 840 (a switch
 * stays next to its label), with a docked side column (`aside`, 320/360) right after it. Its track is
 * reserved even when `aside` is empty, so the cards never move. ListPage's shell (gutters, rhythm).
 * No sticky header (owner rule 3): the band scrolls away, only the shell's top bar stays.
 * `titleId` is the h1's id (tabIndex -1: a screen may move focus to it after an action).
 * `busy` marks the cards as a loading skeleton (aria-busy); `status` is the live announcement of that
 * state («Se încarcă…»), rendered OUTSIDE the busy region so assistive tech does not hold it back.
 */
export function SettingsScreenFrame({
  title,
  titleId,
  backFallback,
  busy = false,
  status,
  aside,
  children,
}: {
  title: string;
  titleId?: string;
  /** Where «Înapoi» goes without in-site history (a deep link, a new tab). */
  backFallback: string;
  /** The body is a loading skeleton (aria-busy). */
  busy?: boolean;
  /** A live status line (sr-only) announced next to the busy body, never inside it. */
  status?: string;
  /** The docked side column from 1280 (an AsideSection); hidden below. */
  aside?: ReactNode;
  children: ReactNode;
}) {
  const back = useBack(backFallback);
  return (
    <ListPage
      header={
        <div className={SETTINGS_COLUMN}>
          <ListHeader title={title} titleId={titleId} back={{ label: 'Înapoi', onClick: back }} />
        </div>
      }
    >
      {status ? (
        <p role="status" className="sr-only">
          {status}
        </p>
      ) : null}
      <div className={SETTINGS_BODY}>
        <div aria-busy={busy || undefined} className={cn(SETTINGS_COLUMN, SETTINGS_STACK)}>
          {children}
        </div>
        {aside ? (
          <aside aria-label={title} aria-busy={busy || undefined} className={SETTINGS_ASIDE}>
            {aside}
          </aside>
        ) : null}
      </div>
    </ListPage>
  );
}
