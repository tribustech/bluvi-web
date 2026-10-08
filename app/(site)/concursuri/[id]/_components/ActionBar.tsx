'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import {
  ArrowsPointingOutIcon,
  ArrowsUpDownIcon,
  ChatBubbleOvalLeftIcon,
  ArrowPathIcon,
  PlusCircleIcon,
  ScaleIcon,
  XCircleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  EllipsisHorizontalCircleIcon,
  MapPinIcon,
  TrophyIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus, RegistrationAction } from '@/core/competitions';
import type { CompetitionActiveWeighing } from '@/core/organizer';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { Sheet } from '@/components/surfaces/Sheet';
import type { chat } from '@/core/realtime';
import { ChatCountBadge, chatEntryLabel } from './ChatPanel';
import type { PageViewer } from './Follow';
import { nationalStandLabel, standLabel } from './stand';
import { DisabledRegisterButton, registerState, SessionRecheck, ViewerSlot, type RegisterState, type SlotViewer } from './viewerSlot';
import { VIEWS, type RankingViewKey } from './views';
import { LiveDot } from '@/components/templates/LiveDot';
import { ORGANIZER_ICON, optionTone } from './organizer/icons';
import type { OrganizerOption } from './organizer/model';

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
 * Extra-Cântar (a registered participant while the competition runs) asks in the bar, as fish:
 * the question with Anulează / Confirmă, then the bar says it is sending, then the result.
 *
 * «Organizare» (the author, before the start and while it runs, as fish — parity
 * competition-page.organizare c1) swaps the row for its submenu: «Înapoi» first, then fish's
 * organizerMenuOptions (organizer/model.ts), a row that scrolls sideways when it holds more tiles
 * than fit (fish's ScrollView); a write asks in the bar (Anulează / Confirmă) like Extra-Cântar. A
 * referee gets «Adaugă cântar» (the scale page, organizare c11); everyone but the author
 * «Penalizări» on a ranking type that supports penalties (bara-actiuni c10), once the role is known. «Înscrie-te» follows fish's rules (core registrationAction);
 * when it is offered it opens the registration form (or the team disclaimer first, for a new team
 * registration — competition-page.bara-actiuni.c4).
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
  /** Held for a tile that waits on the session (Chat): its shape, nothing pressable. */
  bone?: boolean;
  /** fish's red squares (end the competition, remove a referee): the danger tint. */
  tone?: 'accent' | 'danger';
};

export type SortOption = { value: string; label: string; Icon: Icon };

/** fish RankingBarSortBy, with the submenu's labels. */
export const SORT_OPTION: Record<'stand' | 'position' | 'club', SortOption> = {
  stand: { value: 'stand', label: 'Stand', Icon: MapPinIcon },
  club: { value: 'club', label: 'Club', Icon: UserGroupIcon },
  position: { value: 'position', label: 'Poziția în clasament', Icon: TrophyIcon },
};

/** fish RankingActionBar's in-bar confirmation (Extra-Cântar). */
export type BarConfirm = { question: string; onConfirm: () => void; onCancel: () => void; /** «Confirmă» as the danger button (an irreversible organizer write). */ tone?: 'danger' | 'primary' };

type Props = {
  competition: CompetitionWithMyStatus;
  /** The page's viewer: undefined while the session is pending (never shown as signed out). */
  viewer: PageViewer;
  signIn: string;
  /** The Sortare submenu's options; null = no Sortare (feeder rankings have a fixed order). */
  sortOptions: SortOption[] | null;
  onSort: (by: string) => void;
  onView: (view: RankingViewKey) => void;
  onFullView: () => void;
  fullViewDisabled: boolean;
  /** Signed in: the Chat tile, a link to the chat page (participant.b.chat-entry); `onOpen` marks the launch (c41). */
  chat?: { href: string; onOpen: () => void };
  chatBadge: chat.ChatBadge;
  barMessage: string | null;
  onBarMessageDismiss: () => void;
  /** false when the web has no view for this ranking type: the ranking tiles would act on nothing. */
  rankingAvailable?: boolean;
  /** «Înscrie-te» / «Modifică înscrierea» for this viewer, a guest's too (core registrationAction). */
  registration: RegistrationAction | null;
  /** Where an offered registration goes: the form, or the team disclaimer (core registrationAction.target). */
  registrationHref: string;
  /** Extra-Cântar: shown to a registered participant while the competition runs. */
  extraScale: { requested: boolean; onPress: () => void } | null;
  /** The bar is asking (Extra-Cântar): the question replaces the row. */
  confirm: BarConfirm | null;
  /** The bar is sending («Se înregistrează cererea...»). */
  loadingLabel: string | null;
  /** The route tabs other than Clasament: fish's «Acțiuni» button, opening the actions sheet (ActionsSheet). */
  onActions?: () => void;
  /** The author, not completed: fish's «Organizare» tile and its submenu (organizer/model.ts organizerMenuOptions). */
  organizer?: { options: OrganizerOption[]; onChoose: (o: OrganizerOption) => void };
  /** A referee once the ranking shows: «Adaugă cântar» → the scale page (organizare c11). */
  refereeScaleHref?: string;
  /** Not the author, a ranking type with penalties, after the start: «Penalizări» → the penalties page (bara-actiuni c10). */
  penaltiesHref?: string;
};

// No aria-label: the visible «Organizare» is the name (WCAG 2.5.3 Label in Name — «click Organizare»).
const organizerTile = (onPress: () => void): Tile => ({
  id: 'organizare',
  label: 'Organizare',
  Icon: Cog6ToothIcon,
  onPress,
});

export function MobileActionBar(props: Props) {
  const { competition, viewer, signIn, onSort, onView, onFullView, fullViewDisabled, chat: chatEntry, chatBadge, barMessage, confirm, loadingLabel } = props;
  const [menu, setMenu] = useState<'sortare' | 'organizare' | null>(null);
  const status = competition.competitionStatus;
  const barRef = useRef<HTMLDivElement>(null);
  // After a sort is picked the row under focus unmounts twice (the Sortare menu, then the message):
  // focus follows to the message, then back to the «Sortare» tile, never onto <body>.
  const focusAfterSort = useRef(false);
  useEffect(() => {
    if (!focusAfterSort.current) return;
    if (!barMessage) {
      focusAfterSort.current = false;
      // Back to «Sortare» only if focus is still in the bar (or was dropped on <body> when the
      // message unmounted): a reader who has moved on (into the ranking) is never pulled back.
      const active = document.activeElement;
      if (active && active !== document.body && !barRef.current?.contains(active)) return;
    }
    const target = barRef.current?.querySelector<HTMLElement>(barMessage ? '[data-bar-message]' : '[data-tile="sortare"]');
    target?.focus();
  }, [barMessage, menu]);
  // Opening the submenu unmounts the «Sortare» tile, closing it unmounts «Înapoi»: focus moves to
  // the first submenu button, and back to «Sortare» when it closes without a choice.
  // The submenu's tile is remembered with it: focus goes back to that tile when it closes.
  const [menuFocus, setMenuFocus] = useState<{ to: 'open' | 'closed'; which: 'sortare' | 'organizare'; n: number } | null>(null);
  useEffect(() => {
    if (!menuFocus) return;
    barRef.current?.querySelector<HTMLElement>(menuFocus.to === 'open' ? '[data-tile="back"]' : `[data-tile="${menuFocus.which}"]`)?.focus();
  }, [menuFocus]);
  // The bar's question (an organizer write) replaced the row: once it is answered, focus goes back to
  // the tile that asked it («Organizare»), if it is still in the bar or was dropped on <body>.
  const focusAfterConfirm = useRef<string | null>(null);
  const asking = !!confirm;
  useEffect(() => {
    if (asking || !focusAfterConfirm.current) return;
    const which = focusAfterConfirm.current;
    focusAfterConfirm.current = null;
    const active = document.activeElement;
    if (active && active !== document.body && !barRef.current?.contains(active)) return;
    barRef.current?.querySelector<HTMLElement>(`[data-tile="${which}"]`)?.focus();
  }, [asking]);
  const openMenu = (which: 'sortare' | 'organizare') => {
    setMenuFocus(f => ({ to: 'open', which, n: (f?.n ?? 0) + 1 }));
    setMenu(which);
  };
  const closeMenu = () => {
    setMenuFocus(f => ({ to: 'closed', which: f?.which ?? 'sortare', n: (f?.n ?? 0) + 1 }));
    setMenu(null);
  };

  let content;
  if (loadingLabel) {
    content = <BarLoading label={loadingLabel} />;
  } else if (confirm) {
    content = <BarConfirmRow {...confirm} />;
  } else if (barMessage) {
    content = <BarMessage message={barMessage} onDismiss={props.onBarMessageDismiss} />;
  } else if (menu === 'organizare' && props.organizer) {
    const { options, onChoose } = props.organizer;
    content = (
      <Bar
        label="Acțiuni organizator"
        onEscape={() => closeMenu()}
        tiles={[
          { id: 'back', label: 'Înapoi', Icon: ChevronLeftIcon, onPress: () => closeMenu() },
          ...options.map(
            (o): Tile =>
              o.action.type === 'link'
                ? { id: `org-${o.key}`, label: o.label, Icon: ORGANIZER_ICON[o.icon], href: o.action.href }
                // A link keeps the submenu until the page changes: unmounting it on click cancelled the navigation.
                : {
                    id: `org-${o.key}`,
                    label: o.label,
                    Icon: ORGANIZER_ICON[o.icon],
                    tone: optionTone(o),
                    onPress: () => {
                      // fish handleOptionSelect: a write that asks closes the submenu (the question
                      // takes the bar) and focus comes back to «Organizare» once it is answered; a
                      // dialog keeps the submenu behind it, so the dialog returns focus to this tile.
                      if (o.action.type === 'confirm') {
                        focusAfterConfirm.current = 'organizare';
                        setMenuFocus(f => ({ to: 'closed', which: 'organizare', n: (f?.n ?? 0) + 1 }));
                        setMenu(null);
                      }
                      onChoose(o);
                    },
                  },
          ),
        ]}
      />
    );
  } else if (menu === 'sortare') {
    const pick = (by: string) => {
      focusAfterSort.current = true;
      setMenu(null);
      onSort(by);
    };
    content = (
      <Bar
        label="Sortare clasament"
        onEscape={() => closeMenu()}
        tiles={[
          { id: 'back', label: 'Înapoi', Icon: ChevronLeftIcon, onPress: () => closeMenu() },
          ...(props.sortOptions ?? []).map(o => ({ id: o.value, label: o.label, Icon: o.Icon, onPress: () => pick(o.value) })),
        ]}
      />
    );
  } else if (status === 'notStarted') {
    const fallbackLabel = ['pending', 'registered'].includes(competition.userRegistrationStatus ?? '') ? 'Modifică înscrierea' : 'Înscrie-te';
    // The session decides the slot (viewerSlot.tsx): a guest's link is in the HTML when there is no
    // session cookie; a signed-in reader gets a bone until the page has the viewer — never the
    // guest's sign-in link first.
    const row = (v: SlotViewer) => (
      <RegisterRow
        state={registerState(v, props.registration, fallbackLabel)}
        signIn={signIn}
        href={props.registrationHref}
        chat={v === undefined ? 'bone' : v && v !== 'unknown' && chatEntry ? chatTile(chatEntry, chatBadge) : null}
        organizer={v && v !== 'unknown' && props.organizer?.options.length ? organizerTile(() => openMenu('organizare')) : null}
      />
    );
    content = (
      <ViewerSlot viewer={viewer} fallback={row(undefined)}>
        {row}
      </ViewerSlot>
    );
  } else {
    const tiles: Tile[] = [];
    // fish: «Organizare» first, for the author while it is not completed.
    if (props.organizer?.options.length && status === 'started') tiles.push(organizerTile(() => openMenu('organizare')));
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
      );
      // fish: a referee's «Adaugă cântar» (the scale page), after Cântare.
      if (props.refereeScaleHref) {
        tiles.push({ id: 'adauga-cantar', label: 'Adaugă cântar', Icon: ORGANIZER_ICON.scale, href: props.refereeScaleHref });
      }
      // fish: Extra-Cântar / «Anulează extra» for a registered participant while it runs.
      if (props.extraScale) {
        tiles.push({
          id: 'extra',
          label: props.extraScale.requested ? 'Anulează extra' : 'Extra-Cântar',
          Icon: props.extraScale.requested ? XCircleIcon : PlusCircleIcon,
          onPress: props.extraScale.onPress,
          accessibilityLabel: props.extraScale.requested ? 'Anulează cererea de extra cântar' : 'Solicită extra cântar',
        });
      }
      // fish: no Sortare on a feeder ranking (fixed order).
      if (props.sortOptions) {
        tiles.push({ id: 'sortare', label: 'Sortare', Icon: ArrowsUpDownIcon, onPress: () => openMenu('sortare'), accessibilityLabel: 'Sortare clasament' });
      }
      tiles.push({ id: 'statistici', label: 'Statistici', Icon: viewIcon('statistici'), onPress: () => onView('statistici') });
    }
    // fish: «Penalizări» for everyone but the author (who has it in the menu), after Statistici.
    if (props.penaltiesHref) {
      // Its visible label is its name (WCAG 2.5.3).
      tiles.push({ id: 'penalizari', label: 'Penalizări', Icon: ExclamationTriangleIcon, href: props.penaltiesHref });
    }
    // fish ActionButton (every tab but Clasament): «Acțiuni» opens the actions sheet.
    if (props.onActions) {
      tiles.push({ id: 'actiuni', label: 'Acțiuni', Icon: EllipsisHorizontalCircleIcon, onPress: props.onActions, accessibilityLabel: 'Acțiuni concurs' });
    }
    // fish withChatItem: Chat goes second (signed in only). While the session is pending its place
    // is held by a bone tile, so the tiles never move when it lands.
    const withChat = (v: SlotViewer) => {
      const row = [...tiles];
      const chat: Tile | null =
        v === undefined ? { id: 'chat', label: 'Chat', Icon: ChatBubbleOvalLeftIcon, bone: true } : v && v !== 'unknown' && chatEntry ? chatTile(chatEntry, chatBadge) : null;
      if (chat) row.splice(Math.min(1, row.length), 0, chat);
      return <Bar label="Acțiuni concurs" tiles={row} />;
    };
    content = (
      <ViewerSlot viewer={viewer} fallback={withChat(undefined)}>
        {withChat}
      </ViewerSlot>
    );
  }

  return (
    // w-0: the bar's min-content contribution is 0, so a scrolling row (the submenu) scrolls inside
    // the bar instead of widening the DetailActionBar row past the screen (where it was clipped).
    <div ref={barRef} className="w-0 min-w-0 flex-1">
      {/* Always mounted, so the sort confirmation is announced (a live region born with its text is not). */}
      <p role="status" className="sr-only">
        {loadingLabel ?? barMessage ?? ''}
      </p>
      {content}
    </div>
  );
}

/**
 * Before the start: «Înscrie-te» as the bar's full-width primary button, with one line under it
 * that always says what it does or why it is closed (the line's height is always there, so the bar
 * never grows when the session lands), and Chat beside it when signed in.
 */
function RegisterRow({
  state,
  signIn,
  href,
  chat,
  organizer = null,
}: {
  state: RegisterState;
  signIn: string;
  href: string;
  chat: Tile | 'bone' | null;
  organizer?: Tile | null;
}) {
  const icon = <ClipboardDocumentListIcon />;
  const line =
    state.kind === 'pending'
      ? null
      : state.kind === 'signIn'
        ? 'Intră în cont pentru a te înscrie.'
        : state.kind === 'offered'
          ? null
          : state.reason;
  const unknown = state.kind === 'unknown';
  return (
    <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {state.kind === 'pending' ? (
          <span role="status" aria-label="Se verifică înscrierea…" className="block h-12 w-full animate-shimmer rounded-control" />
        ) : state.kind === 'signIn' ? (
          <ButtonLink block href={signIn} icon={icon} aria-describedby="inscriere-motiv">
            {state.label}
          </ButtonLink>
        ) : state.kind === 'offered' ? (
          // Offered: the registration form (or the team disclaimer before a new team entry).
          <ButtonLink block href={href} icon={icon}>
            {state.label}
          </ButtonLink>
        ) : (
          // fish: 50% opacity, not pressable; the web also says why (fish's «Acțiuni» sheet reason).
          <DisabledRegisterButton block label={state.label} describedBy={line ? 'inscriere-motiv' : undefined} />
        )}
        <p className="flex flex-wrap items-center justify-center gap-x-2 text-center t-caption text-muted">
          <span id={line ? 'inscriere-motiv' : undefined}>{line ?? '\u00a0'}</span>
          {/* An unread session: the way to check again, in the line (the bar keeps its height). */}
          {unknown ? <SessionRecheck /> : null}
        </p>
      </div>
      {organizer ? (
        <div className="w-16 shrink-0">
          <TileControl tile={organizer} />
        </div>
      ) : null}
      {chat ? (
        <div className="w-16 shrink-0">
          <TileControl tile={chat === 'bone' ? { id: 'chat', label: 'Chat', Icon: ChatBubbleOvalLeftIcon, bone: true } : chat} />
        </div>
      ) : null}
    </div>
  );
}

/** fish BarLoading: the bar says what it is sending. */
function BarLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-12 w-full items-center gap-3" aria-busy>
      <ArrowPathIcon aria-hidden className="size-6 shrink-0 animate-spin text-accent-ink motion-reduce:animate-none" />
      <span className="flex-1 t-body text-ink">{label}</span>
    </div>
  );
}

/** fish's in-bar confirmation: the question, then Anulează / Confirmă. */
function BarConfirmRow({ question, onConfirm, onCancel, tone }: BarConfirm) {
  const ref = useRef<HTMLDivElement>(null);
  // The question takes the tile's place: focus moves to it (and Escape answers «Anulează»).
  useEffect(() => ref.current?.querySelector<HTMLElement>('button')?.focus(), []);
  return (
    <div
      ref={ref}
      role="group"
      aria-label={question}
      onKeyDown={e => {
        if (e.key === 'Escape') onCancel();
      }}
      className="flex flex-col gap-2 py-1"
    >
      <p className="t-body-strong text-ink">{question}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="compact" onClick={onCancel}>
          Anulează
        </Button>
        <Button size="compact" variant={tone === 'danger' ? 'danger' : 'primary'} onClick={onConfirm}>
          Confirmă
        </Button>
      </div>
    </div>
  );
}

function chatTile(entry: { href: string; onOpen: () => void }, chatBadge: chat.ChatBadge): Tile {
  return {
    id: 'chat',
    label: 'Chat',
    Icon: ChatBubbleOvalLeftIcon,
    href: entry.href,
    onPress: entry.onOpen,
    badge: chatBadge,
    accessibilityLabel: chatEntryLabel(chatBadge, 'Chat competiție'),
  };
}

/** A view's icon, the one its chip and desktop tab use. */
const viewIcon = (key: RankingViewKey): Icon => VIEWS.find(v => v.key === key)?.Icon ?? TrophyIcon;

/**
 * Up to six tiles share the width evenly (≥ 59px each at 375); a long label wraps to two lines inside
 * its tile. More than six (the author's submenu, a referee's full row): each tile keeps 80px (fish
 * gives these labels labelMaxWidth 104, CompetitionRanking.tsx:580-601) and its label up to three
 * lines, so «Alocă participanții pe standuri» / «Adaugă participanți fără cont» are never cut; the
 * row scrolls sideways (fish's ScrollView). At 375 about 4.5 tiles fit, so a tile is always cut at
 * the edge and the row reads as «more»; the edge fades until the end of the row is reached.
 */
const EVEN_MAX = 6;
function Bar({ label, tiles, onEscape }: { label: string; tiles: Tile[]; onEscape?: () => void }) {
  const scroll = tiles.length > EVEN_MAX;
  const [atEnd, setAtEnd] = useState(false);
  return (
    // Inside the T3 DetailActionBar row (its 16px gutters): the tiles run edge to edge.
    <nav
      aria-label={label}
      className="-mx-4 min-w-0"
      onKeyDown={
        onEscape
          ? e => {
              if (e.key === 'Escape') {
                e.preventDefault();
                onEscape();
              }
            }
          : undefined
      }
    >
      <ul
        onScroll={
          scroll
            ? e => {
                const el = e.currentTarget;
                setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 2);
              }
            : undefined
        }
        className={cn(
          'flex px-2',
          scroll && 'snap-x overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          scroll && !atEnd && '[mask-image:linear-gradient(to_left,transparent,black_--spacing(8))]',
        )}
      >
        {tiles.map(tile => (
          <li key={tile.id} className={scroll ? 'w-20 shrink-0 snap-start' : 'min-w-0 flex-1'}>
            <TileControl tile={tile} lines={scroll ? 3 : 2} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

const noSubscribe = () => () => {};

/**
 * The tiles are server-rendered, but a button's handler only exists once the bar has hydrated: a
 * tap before that did nothing (the dialog stayed shut, the phone list stayed on screen). Until then
 * the button is aria-disabled — announced as unavailable, and a tap is ignored instead of lost; it
 * keeps its look (no 40% flash on every page load). Links work without JavaScript and stay as they are.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

function TileControl({ tile, lines = 2 }: { tile: Tile; lines?: 2 | 3 }) {
  const hydrated = useHydrated();
  if (tile.bone) {
    return (
      <span aria-hidden className="flex w-full flex-col items-center gap-0.5 py-0.5">
        <span className="size-8 animate-shimmer rounded-control" />
        <span className="h-3 w-8 animate-shimmer rounded-full" />
      </span>
    );
  }
  const body = (
    <>
      <span
        className={cn(
          'relative flex size-8 items-center justify-center rounded-control',
          tile.tone === 'danger' ? 'bg-status-danger-bg text-status-danger-fg' : 'bg-accent-tint text-accent-ink',
        )}
      >
        <tile.Icon aria-hidden className="size-6" />
        <ChatCountBadge badge={tile.badge ?? null} className="absolute -top-2 left-5" />
      </span>
      <span data-tile-label className={cn('text-center t-micro text-ink', lines === 3 ? 'line-clamp-3 max-w-19' : 'line-clamp-2 max-w-17')}>
        {tile.label}
      </span>
    </>
  );
  const cls =
    'flex w-full cursor-pointer flex-col items-center gap-0.5 rounded-control py-0.5 transition-opacity duration-(--duration-fast) active:opacity-80 ' +
    'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';
  if (tile.href) {
    return (
      <Link href={tile.href} onClick={tile.onPress} aria-label={tile.accessibilityLabel} data-tile={tile.id} className={cls}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={hydrated ? tile.onPress : undefined}
      disabled={tile.disabled}
      aria-disabled={hydrated ? undefined : true}
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

/**
 * fish ActiveWeighingBanner (+ MultipleActiveWeighingsBanner). Signed-in only, as in fish. One
 * weighing: pressing it opens that weighing's detail (competition-page.cantar-detaliu, parity
 * shell.c25). Several: pressing opens the list, one entry per weighing (shell.c24), each opening
 * its detail. A weighing whose stand has no sector does nothing (fish handlePressActiveWeighing).
 */
export function ActiveWeighingBanner({
  weighings,
  onPress,
  isNc = false,
}: {
  weighings: CompetitionActiveWeighing[] | undefined;
  onPress: (weighing: CompetitionActiveWeighing) => void;
  /** nationalChampionship / fipsed (stand.ts isNationalType): fish's «A3(12)» stand label. */
  isNc?: boolean;
}) {
  const [listOpen, setListOpen] = useState(false);
  if (!weighings?.length || !weighings[0]?.stand) return null;
  const label = (w: CompetitionActiveWeighing) =>
    isNc
      ? nationalStandLabel(w.stand.sectors[0]?.name, w.stand.sectorDrawPosition, w.stand.name)
      : standLabel(w.stand.sectors[0]?.name ?? '', w.stand.name);
  const several = weighings.length > 1;
  const text = several
    ? `Cântare în curs pe standurile ${weighings.map(label).join(', ')}.`
    : `${weighings[0].weighingType === 'normal' ? 'Cântar' : 'Extra-cântar'} în curs pe standul ${label(weighings[0])}.`;
  const open = (w: CompetitionActiveWeighing) => {
    if (!w.stand.sectors.length) return;
    onPress(w);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => (several ? setListOpen(true) : open(weighings[0]))}
        aria-haspopup={several ? 'dialog' : undefined}
        // accent-ink, not accent: 12px white on accent is 4.46:1.
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2.5 bg-accent-ink px-4 py-2 text-on-accent"
      >
        <LiveDot tone="inverse" />
        {/* No live region: the button's own name says it; a status here re-announced on every refetch. */}
        <span className="truncate t-caption">{text}</span>
      </button>
      {several ? (
        <Sheet open={listOpen} onClose={() => setListOpen(false)} title="Cântare în curs">
          <ul className="flex flex-col gap-2 pb-4">
            {weighings.map(w => (
              <li key={w.weighingDocumentId}>
                <button
                  type="button"
                  onClick={() => {
                    setListOpen(false);
                    open(w);
                  }}
                  className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-card bg-soft-fill px-4 py-3 text-left text-ink"
                >
                  <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-control bg-accent-tint text-accent-ink">
                    <ScaleIcon className="size-5" />
                  </span>
                  <span className="t-body">
                    {`Vezi ${w.weighingType === 'normal' ? 'cântarul live' : 'extra-cântarul live'} pe standul ${label(w)}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}
    </>
  );
}
