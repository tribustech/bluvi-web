'use client';

import { useEffect, useRef, useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import {
  ArrowsPointingOutIcon,
  ArrowsUpDownIcon,
  ChatBubbleOvalLeftIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClipboardDocumentListIcon,
  MapPinIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import type { CompetitionActiveWeighing } from '@/core/organizer';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { chat } from '@/core/realtime';
import { ChatCountBadge } from './ChatPanel';
import type { RankingSort } from './ranking';
import { VIEWS, type RankingViewKey } from './views';

/*
 * fish components/competition/RankingActionBar.tsx (getRankingActionBarItems, BarMessageView) and
 * components/ActiveWeighingBanner.tsx, phone only. fish paints every tile its own Material hue; on
 * the web indigo is the only accent (Fundații §01): every tile is the same accent-tint icon box.
 * Copy: fish says «Vezi full» and «Share»; the web says «Tot ecranul» and «Distribuie» (the header's
 * word for the same action) — a deliberate deviation, the screen is Romanian. A view's tile takes the
 * view's own icon (views.ts), so Cântare / Statistici look the same in the chips and in the bar.
 *
 * Distribuie is never a tile: the phone header always has the share chip, and a second share
 * button one screen below it only repeated it (fish's «Share» tile). The tiles that remain share
 * the row evenly (at most five: the ranking tiles + Chat).
 *
 * Before the start the bar's one action is «Înscrie-te»: the primary CTA, a full-width 48px filled
 * Button (Fundații §07), not a utility tile — tiles are for the ranking's utilities (and Chat).
 *
 * Not on the web yet (no web flow behind them): Organizare (author), Adaugă cântar (referee),
 * Extra-Cântar (registered angler), Penalizări.
 */

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
type Tile = {
  id: string;
  label: string;
  Icon: Icon;
  onPress?: () => void;
  href?: string;
  disabled?: boolean;
  badge?: chat.ChatBadge;
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
  onChat?: () => void;
  chatBadge: chat.ChatBadge;
  barMessage: string | null;
  onBarMessageDismiss: () => void;
  /** false when the web has no view for this ranking type (feeder): the ranking tiles would act on nothing. */
  rankingAvailable?: boolean;
};

export function MobileActionBar(props: Props) {
  const { competition, isAuthenticated, signIn, onSort, onView, onFullView, fullViewDisabled, onChat, chatBadge, barMessage } = props;
  const [menu, setMenu] = useState<'sortare' | null>(null);
  const status = competition.competitionStatus;
  const barRef = useRef<HTMLDivElement>(null);
  // After a sort is picked the row under focus unmounts twice (the Sortare menu, then the message):
  // focus follows to the message, then back to the «Sortare» tile, never onto <body>.
  const focusAfterSort = useRef(false);
  useEffect(() => {
    if (!focusAfterSort.current) return;
    const target = barRef.current?.querySelector<HTMLElement>(barMessage ? '[data-bar-message]' : '[data-tile="sortare"]');
    target?.focus();
    if (!barMessage) focusAfterSort.current = false;
  }, [barMessage, menu]);

  let content;
  if (barMessage) {
    content = <BarMessage message={barMessage} onDismiss={props.onBarMessageDismiss} />;
  } else if (menu === 'sortare') {
    const pick = (by: RankingSort) => {
      focusAfterSort.current = true;
      setMenu(null);
      onSort(by);
    };
    content = (
      <Bar
        label="Sortare clasament"
        tiles={[
          { id: 'back', label: 'Înapoi', Icon: ChevronLeftIcon, onPress: () => setMenu(null) },
          { id: 'stand', label: 'Stand', Icon: MapPinIcon, onPress: () => pick('stand') },
          { id: 'position', label: 'Poziția în clasament', Icon: TrophyIcon, onPress: () => pick('position') },
        ]}
      />
    );
  } else if (status === 'notStarted') {
    const label = ['pending', 'registered'].includes(competition.userRegistrationStatus ?? '') ? 'Modifică înscrierea' : 'Înscrie-te';
    const icon = <ClipboardDocumentListIcon />;
    content = (
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {isAuthenticated ? (
            // Registration is an app flow (forms, team, payment rules); the web has none yet.
            <Button block disabled icon={icon} title="Înscrierea se face din aplicația Bluvi.">
              {label}
            </Button>
          ) : (
            <ButtonLink block href={signIn} icon={icon}>
              {label}
            </ButtonLink>
          )}
        </div>
        {onChat ? (
          <div className="w-16 shrink-0">
            <TileControl tile={chatTile(onChat, chatBadge)} />
          </div>
        ) : null}
      </div>
    );
  } else {
    const tiles: Tile[] = [];
    if ((status === 'started' || status === 'completed') && props.rankingAvailable !== false) {
      tiles.push(
        {
          id: 'tot-ecranul',
          label: 'Tot ecranul',
          Icon: ArrowsPointingOutIcon,
          onPress: onFullView,
          disabled: fullViewDisabled,
          accessibilityLabel: 'Vezi clasamentul pe tot ecranul',
        },
        { id: 'cantare', label: 'Cântare', Icon: viewIcon('cantare'), onPress: () => onView('cantare'), accessibilityLabel: 'Vezi cântarele din concurs' },
        { id: 'sortare', label: 'Sortare', Icon: ArrowsUpDownIcon, onPress: () => setMenu('sortare'), accessibilityLabel: 'Sortare clasament' },
        { id: 'statistici', label: 'Statistici', Icon: viewIcon('statistici'), onPress: () => onView('statistici') },
      );
    }
    // fish withChatItem: Chat goes second (signed in only).
    if (onChat) tiles.splice(Math.min(1, tiles.length), 0, chatTile(onChat, chatBadge));
    content = <Bar label="Acțiuni concurs" tiles={tiles} />;
  }

  return (
    <div ref={barRef} className="min-w-0 flex-1">
      {/* Always mounted, so the sort confirmation is announced (a live region born with its text is not). */}
      <p role="status" className="sr-only">
        {barMessage ?? ''}
      </p>
      {content}
    </div>
  );
}

function chatTile(onChat: () => void, chatBadge: chat.ChatBadge): Tile {
  return {
    id: 'chat',
    label: 'Chat',
    Icon: ChatBubbleOvalLeftIcon,
    onPress: onChat,
    badge: chatBadge,
    accessibilityLabel: chatBadge
      ? chatBadge.text === 'Nou'
        ? 'Chat competiție, mesaje noi'
        : `Chat competiție, ${chatBadge.text} mesaje necitite`
      : 'Chat competiție',
  };
}

/** A view's icon, the one its chip and desktop tab use. */
const viewIcon = (key: RankingViewKey): Icon => VIEWS.find(v => v.key === key)?.Icon ?? TrophyIcon;

/** Up to five tiles share the width evenly; a long label wraps to two lines inside its tile. */
function Bar({ label, tiles }: { label: string; tiles: Tile[] }) {
  return (
    // Inside the T3 DetailActionBar row (its 16px gutters): the tiles run edge to edge.
    <nav aria-label={label} className="-mx-4 min-w-0">
      <ul className="flex px-2">
        {tiles.map(tile => (
          <li key={tile.id} className="min-w-0 flex-1">
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
      <span className="relative flex size-8 items-center justify-center rounded-control bg-accent-tint text-accent-ink">
        <tile.Icon aria-hidden className="size-6" />
        <ChatCountBadge badge={tile.badge ?? null} className="absolute -top-2 left-5" />
      </span>
      <span className="line-clamp-2 max-w-17 text-center t-micro text-ink">{tile.label}</span>
    </>
  );
  const cls =
    'flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-control py-0.5 transition-opacity duration-(--duration-fast) active:opacity-80 ' +
    'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';
  if (tile.href) {
    return (
      <Link href={tile.href} aria-label={tile.accessibilityLabel} data-tile={tile.id} className={cls}>
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
      data-tile={tile.id}
      className={cn(cls, 'disabled:cursor-not-allowed disabled:opacity-40')}
    >
      {body}
    </button>
  );
}

/**
 * fish BarMessageView: green check + message instead of the row; gone after 2.5 s, or on tap. The
 * text is announced by MobileActionBar's permanent status line, not here.
 */
function BarMessage({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 2500);
    return () => clearTimeout(id);
  }, [message, onDismiss]);
  return (
    <button
      type="button"
      data-bar-message
      onClick={onDismiss}
      className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-control text-left outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
    >
      <CheckCircleIcon aria-hidden className="size-6 shrink-0 text-success" />
      <span className="flex-1 t-body text-ink">{message}</span>
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
      // accent-ink, not accent: 12px white on accent is 4.46:1.
      className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2.5 bg-accent-ink px-4 py-2 text-on-accent"
    >
      <span aria-hidden className="size-2 shrink-0 animate-live rounded-full bg-on-accent" />
      {/* No live region: the button's own name says it; a status here re-announced on every refetch. */}
      <span className="truncate t-caption">
        {text}
      </span>
    </button>
  );
}
