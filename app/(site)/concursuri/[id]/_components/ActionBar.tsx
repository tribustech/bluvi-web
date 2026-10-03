'use client';

import { useEffect, useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import {
  ArrowTopRightOnSquareIcon,
  ArrowsUpDownIcon,
  ChartBarIcon,
  ChatBubbleOvalLeftIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  MapPinIcon,
  ShareIcon,
  TrophyIcon,
} from '@heroicons/react/24/solid';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import type { CompetitionActiveWeighing } from '@/core/organizer';
import { cn } from '@/components/ui/cn';
import type { RankingSort } from './ranking';
import { inkForFill } from './sectorInk';
import type { RankingViewKey } from './views';
import type { chat } from '@/core/realtime';

/*
 * fish components/competition/RankingActionBar.tsx (getRankingActionBarItems, BarMessageView) and
 * components/ActiveWeighingBanner.tsx, phone only. Tile colours are fish's Material hues; with no
 * tokens for them they borrow the nearest sector tokens (see views.ts).
 *
 * Not on the web yet (no web flow behind them): Organizare (author), Adaugă cântar (referee),
 * Extra-Cântar (registered angler), Penalizări.
 */

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type Tile = {
  id: string;
  label: string;
  Icon: Icon;
  fill: string;
  onPress?: () => void;
  href?: string;
  disabled?: boolean;
  badge?: { text: string; tone: 'alert' | 'info' } | null;
  accessibilityLabel?: string;
};

type Props = {
  competition: CompetitionWithMyStatus;
  isAuthenticated: boolean;
  signIn: string;
  onSort: (by: RankingSort) => void;
  onView: (view: RankingViewKey) => void;
  onFullView: () => void;
  fullViewDisabled: boolean;
  onShare: () => void;
  onChat?: () => void;
  chatBadge: chat.ChatBadge;
  barMessage: string | null;
  onBarMessageDismiss: () => void;
  /** false when the web has no view for this ranking type (feeder): the ranking tiles would act on nothing. */
  rankingAvailable?: boolean;
};

export function MobileActionBar(props: Props) {
  const { competition, isAuthenticated, signIn, onSort, onView, onFullView, fullViewDisabled, onShare, onChat, chatBadge } = props;
  const [menu, setMenu] = useState<'sortare' | null>(null);
  const status = competition.competitionStatus;

  if (props.barMessage) return <BarMessage message={props.barMessage} onDismiss={props.onBarMessageDismiss} />;

  if (menu === 'sortare') {
    const pick = (by: RankingSort) => {
      setMenu(null);
      onSort(by);
    };
    return (
      <Bar
        label="Sortare clasament"
        tiles={[
          { id: 'back', label: 'Înapoi', Icon: ChevronLeftIcon, fill: 'bg-ink-2', onPress: () => setMenu(null) },
          { id: 'stand', label: 'Stand', Icon: MapPinIcon, fill: 'bg-sector-a', onPress: () => pick('stand') },
          { id: 'position', label: 'Poziția în clasament', Icon: TrophyIcon, fill: 'bg-sector-w', onPress: () => pick('position') },
        ]}
      />
    );
  }

  const tiles: Tile[] = [];
  if (status === 'notStarted') {
    const label = ['pending', 'registered'].includes(competition.userRegistrationStatus ?? '') ? 'Modifică înscrierea' : 'Înscrie-te';
    tiles.push(
      isAuthenticated
        ? // Registration is an app flow (forms, team, payment rules); the web has none yet.
          { id: 'inscrie-te', label, Icon: ClipboardDocumentListIcon, fill: 'bg-sector-v', disabled: true }
        : { id: 'inscrie-te', label, Icon: ClipboardDocumentListIcon, fill: 'bg-sector-v', href: signIn, accessibilityLabel: 'Înscrie-te la competiție' },
    );
  } else if ((status === 'started' || status === 'completed') && props.rankingAvailable !== false) {
    tiles.push(
      { id: 'vezi-full', label: 'Vezi full', Icon: ArrowTopRightOnSquareIcon, fill: 'bg-sector-a', onPress: onFullView, disabled: fullViewDisabled, accessibilityLabel: 'Vezi clasament full screen' },
      { id: 'cantare', label: 'Cântare', Icon: ClockIcon, fill: 'bg-sector-f', onPress: () => onView('cantare'), accessibilityLabel: 'Vezi cântarele din concurs' },
      { id: 'sortare', label: 'Sortare', Icon: ArrowsUpDownIcon, fill: 'bg-sector-m', onPress: () => setMenu('sortare'), accessibilityLabel: 'Sortare clasament' },
      { id: 'statistici', label: 'Statistici', Icon: ChartBarIcon, fill: 'bg-sector-n', onPress: () => onView('statistici') },
    );
  }
  tiles.push({ id: 'share', label: 'Share', Icon: ShareIcon, fill: 'bg-sector-w', onPress: onShare, accessibilityLabel: 'Share competiția' });
  // fish withChatItem: Chat goes second (signed in only).
  if (onChat) {
    tiles.splice(Math.min(1, tiles.length), 0, {
      id: 'chat',
      label: 'Chat',
      Icon: ChatBubbleOvalLeftIcon,
      fill: 'bg-sector-g',
      onPress: onChat,
      badge: chatBadge,
      accessibilityLabel: chatBadge
        ? chatBadge.text === 'Nou'
          ? 'Chat competiție, mesaje noi'
          : `Chat competiție, ${chatBadge.text} mesaje necitite`
        : 'Chat competiție',
    });
  }

  return <Bar label="Acțiuni concurs" tiles={tiles} />;
}

function Bar({ label, tiles }: { label: string; tiles: Tile[] }) {
  return (
    <nav aria-label={label} className="bg-surface shadow-[0_-1px_0_var(--color-hairline)]">
      <ul className="flex overflow-x-auto pt-1 pb-1 pl-4 [scrollbar-width:none]">
        {tiles.map(tile => (
          <li key={tile.id} className="w-[75px] shrink-0">
            <TileControl tile={tile} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function TileControl({ tile }: { tile: Tile }) {
  const body = (
    <>
      <span className={cn('relative flex size-7 items-center justify-center rounded-lg', tile.fill, inkForFill(tile.fill))}>
        <tile.Icon aria-hidden className="size-4" />
        {tile.badge ? (
          <span
            aria-hidden
            className={cn(
              'absolute -top-2 left-4 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-[1.5px] border-surface px-1 t-nano',
              tile.badge.tone === 'alert' ? 'bg-live text-on-accent' : 'bg-accent text-on-accent',
            )}
          >
            {tile.badge.text}
          </span>
        ) : null}
      </span>
      <span className="line-clamp-2 min-h-6 max-w-16 text-center t-micro text-ink">{tile.label}</span>
    </>
  );
  const cls = 'flex w-full flex-col items-center gap-0.5 py-1 active:opacity-70';
  if (tile.href) {
    return (
      <Link href={tile.href} aria-label={tile.accessibilityLabel} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={tile.onPress}
      disabled={tile.disabled}
      aria-label={tile.accessibilityLabel}
      className={cn(cls, 'disabled:opacity-40')}
    >
      {body}
    </button>
  );
}

/** fish BarMessageView: green check + message instead of the row; gone after 2.5 s, or on tap. */
function BarMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 2500);
    return () => clearTimeout(id);
  }, [message, onDismiss]);
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="flex h-16 w-full items-center gap-3 border-t border-hairline bg-surface px-4 text-left"
    >
      <CheckCircleIcon aria-hidden className="size-[22px] shrink-0 text-success" />
      <span role="status" className="flex-1 t-body text-ink">
        {message}
      </span>
    </button>
  );
}

/** fish ActiveWeighingBanner (+ MultipleActiveWeighingsBanner). Signed-in only, as in fish. */
export function ActiveWeighingBanner({
  weighings,
  onPress,
}: {
  weighings: CompetitionActiveWeighing[] | undefined;
  onPress: () => void;
}) {
  if (!weighings?.length || !weighings[0]?.stand) return null;
  const label = (w: CompetitionActiveWeighing) => `${w.stand.sectors[0]?.name ?? ''}${w.stand.name}`;
  const text =
    weighings.length === 1
      ? `${weighings[0].weighingType === 'normal' ? 'Cântar' : 'Extra-cântar'} în curs pe standul ${label(weighings[0])}.`
      : `Cântare în curs pe standurile ${weighings.map(label).join(', ')}.`;
  return (
    <button
      type="button"
      onClick={onPress}
      className="flex w-full items-center justify-center gap-2.5 bg-accent px-4 py-1.5 text-on-accent"
    >
      <span aria-hidden className="size-2 shrink-0 animate-live rounded-full bg-on-accent" />
      <span role="status" className="truncate t-caption">
        {text}
      </span>
    </button>
  );
}
