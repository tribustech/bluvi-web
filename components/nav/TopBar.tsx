'use client';

import { useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Avatar } from '@/components/ui/Avatar';
import { FishLogo } from './brand';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { LogoHorizontal } from './brand';
import { iconButtonClass } from './IconButton';
import { PATHS, SECTIONS, type AdminLink } from './items';
import { MenuButton, type MenuEntry } from './MenuButton';
import { BAR, BAR_SHADOW, SHELL_MAX } from './shell';

/**
 * Who is looking: still resolving (neutral placeholder, never «Intră»), signed out, signed in, or
 * unknown — the session could not be read (CMS slow or down). Unknown renders exactly like pending
 * (owner rule 4: when we don't know, we don't show): a visitor who may be signed in is never sent
 * to sign in again, and is never told the read failed.
 */
export type TopBarViewer =
  | { status: 'pending' }
  | { status: 'unknown' }
  | { status: 'out'; signInHref?: string }
  | { status: 'in'; name: string; avatarUrl?: string | null };

/**
 * responsive: switches at 768 / 1280 by viewport (the site). The others force one layout at any
 * width so /dev/kit can show every layout in any column: phone (<768), tablet (768–1279),
 * desktop (≥1280).
 */
export type TopBarLayout = 'responsive' | 'phone' | 'tablet' | 'desktop';

type Props = {
  viewer: TopBarViewer;
  /** Key of the current section or admin link; undefined = nothing highlighted (a 404). */
  active?: string;
  /**
   * 'page' when the current page is the active entry's own page, 'true' when it only lies below it
   * (/concursuri on /concursuri/<id>): the tint is the same, the announcement is not.
   */
  activeCurrent?: 'page' | 'true';
  admin?: AdminLink[];
  /**
   * The viewer's lakes could not be read: Administrare stays (even with no other entry) and ends in
   * a «Nu am putut încărca bălțile tale · Reîncearcă» row that calls this — «not an operator» and
   * «could not check» never look the same.
   */
  onAdminRetry?: () => void;
  hasUnread?: boolean;
  onSearch?: () => void;
  onMenu?: () => void;
  onSignOut?: () => void;
  /**
   * @deprecated Ignored: an unknown session renders as pending and the shell re-reads it quietly.
   * Kept so the /dev/kit rows still type-check until they drop it.
   */
  onRetry?: () => void;
  /** @deprecated Ignored, see onRetry. */
  retrying?: boolean;
  /** «Ieși din cont» is running: the avatar slot is busy and cannot be pressed again. */
  signingOut?: boolean;
  /** Whether the phone menu is open (☰ aria-expanded). */
  menuOpen?: boolean;
  /** Changes on navigation: open dropdowns close. */
  resetKey?: string;
  layout?: TopBarLayout;
  /** Render a dropdown already open (the /dev/kit static example). */
  openMenu?: 'admin' | 'account';
  /** The page has scrolled under the bar: it lifts (shadow-e1) so it never merges with white content. */
  scrolled?: boolean;
  /** Phone only: the visitor is scrolling down, the bar slides away (reduced motion: fades). */
  concealed?: boolean;
  className?: string;
};

/**
 * One property's classes: `base` below 768, `md` from 768, `xl` from 1280, written with their
 * `md:` / `xl:` prefixes so Tailwind sees the literal classes. A forced layout strips the prefix
 * and keeps only the matching argument (each falls back to the smaller one), so keep one property
 * per call.
 */
type Pick3 = (base: string, md?: string, xl?: string) => string;

const bare = (cls: string) => cls.replace(/(^|\s)(?:md|xl):/g, '$1');

function picker(layout: TopBarLayout): Pick3 {
  return (base, md, xl) => {
    if (layout === 'phone') return base;
    if (layout === 'tablet') return md !== undefined ? bare(md) : base;
    if (layout === 'desktop') return xl !== undefined ? bare(xl) : md !== undefined ? bare(md) : base;
    return cn(base, md, xl);
  };
}

/** Hover: soft-fill (Fundații §06, no lift); pressed: opacity .8, the kit Button's. */
const PRESS = 'cursor-pointer transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast active:opacity-80';

/**
 * The section links and the Administrare trigger: one shape, so one gap rule spaces all five. The
 * pill stays 40 at every width (48 would crowd the 64px bar); below 1280 a transparent ::before
 * stretches the hit area to 48 (Fundații §07: 48 below 1280).
 */
const NAV_ITEM = cn(
  't-body-strong relative flex h-10 items-center rounded-control',
  'before:absolute before:inset-x-0 before:-inset-y-1 xl:before:hidden',
  PRESS,
);
const NAV_IDLE = 'text-ink-2 hover:bg-soft-fill hover:text-ink';
/**
 * Active: accent-ink text and a 2px accent bar flush with the bar's bottom edge (the 40px pill sits
 * 12px above the 64px bar's edge), so hover (a soft-fill pill) never looks selected.
 */
const NAV_ACTIVE =
  'text-accent-ink hover:bg-soft-fill after:absolute after:inset-x-3 after:-bottom-3 after:h-0.5 after:rounded-full after:bg-accent';

/** Dropdown and phone-menu rows share one icon size: outline 24 (Fundații §05). */
const MENU_ICON = 'size-6 shrink-0 text-ink-2';

/** The Administrare row when the viewer's lakes could not be read (onAdminRetry). */
const ADMIN_RETRY_LABEL = 'Nu am putut încărca bălțile tale · Reîncearcă';

/**
 * The top bar — the only navigation, at every width (ROADMAP §4, owner decision 2026-10-04).
 * - <768: logo · search · bell (signed in) · avatar or «Intră» · ☰ (opens the menu panel).
 * - ≥768: logo · Acasă, Bălți, Competiții, Partide · Administrare (organiser/operator) ·
 *   search (icon; a ⌘K field from 1280) · bell · avatar menu (Profil, Setări, Ieși din cont).
 * Height 56 / 64 from 768, hairline included (border-box), so the bar is exactly h-14 / h-16 and
 * siblings can rely on that. The surface is full width; the row sits in the shell column shared
 * with <main> (SHELL_MAX: full width up to 1680 of content, centred beyond), gutters 16 / 24 / 32
 * like the pages, and the cropped logo puts its ink on the gutter.
 * Every control is 48 below 1280 and 40 from 1280 (Fundații §07), 0 / 8 apart (48px targets need
 * no extra gap on a phone). The account cluster (bell + avatar / «Intră» / placeholder) has a fixed
 * minimum width that «Intră» fills, so search and ☰ do not move when the session resolves.
 * Scrolled, the bar lifts (shadow-e1); at rest the hairline alone ties it to the page header.
 */
export function TopBar({
  viewer,
  active,
  activeCurrent = 'page',
  admin = [],
  onAdminRetry,
  hasUnread = false,
  onSearch,
  onMenu,
  onSignOut,
  signingOut = false,
  menuOpen = false,
  resetKey,
  layout = 'responsive',
  openMenu,
  scrolled = false,
  concealed = false,
  className,
}: Props) {
  const r = picker(layout);
  const adminActive = admin.some((a) => a.key === active);
  const iconSize = r('size-12', undefined, 'xl:size-10');
  return (
    <header
      data-scrolled={scrolled || undefined}
      data-concealed={concealed || undefined}
      className={cn(
        'border-b border-hairline bg-surface',
        // Lifted once scrolled — unless a row is pinned under it: then that row casts the shadow.
        'transition-[box-shadow,translate,opacity] duration-(--duration-fast) ease-fast',
        BAR_SHADOW,
        // Phone hide-on-scroll: slides up (medium, ease-slow); reduced motion fades instead.
        'data-concealed:pointer-events-none data-concealed:-translate-y-full data-concealed:duration-(--duration-medium) data-concealed:ease-slow',
        'motion-reduce:data-concealed:translate-y-0 motion-reduce:data-concealed:opacity-0',
        r('h-14', 'md:h-16'),
        className,
      )}
    >
      <div className={cn('mx-auto flex h-full items-center', SHELL_MAX, r('gap-0', 'md:gap-2'), r('px-4', 'md:px-6', 'xl:px-8'))}>
        <Link
          href="/"
          aria-label="Bluvi, acasă"
          className={cn('-ml-1 shrink-0 rounded-control px-1 py-1 text-accent-ink', r('mr-auto', 'md:mr-0'))}
        >
          <LogoHorizontal className={cn('w-auto', r('h-6', 'md:h-7'))} />
        </Link>

        <nav aria-label="Navigare principală" className={cn('min-w-0', r('hidden', 'md:block'), r('', 'md:ml-3', 'xl:ml-6'))}>
          <ul className={cn('flex items-center', r('gap-0.5', undefined, 'xl:gap-1'))}>
            {SECTIONS.map(({ key, label, href }) => {
              const isActive = key === active;
              return (
                <li key={key}>
                  <Link
                    href={href}
                    aria-current={isActive ? activeCurrent : undefined}
                    className={cn(NAV_ITEM, r('px-2.5', undefined, 'xl:px-3'), isActive ? NAV_ACTIVE : NAV_IDLE)}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
            {admin.length > 0 || onAdminRetry ? (
              <li>
                <MenuButton
                  label="Administrare"
                  align="start"
                  resetKey={resetKey}
                  defaultOpen={openMenu === 'admin'}
                  currentInside={adminActive}
                  // 64px bar, 40px trigger at 12–52: the menu hangs 4px below the bar's edge (68).
                  menuClassName="top-full mt-4"
                  trigger={
                    <>
                      Administrare
                      <ChevronDownIcon className="size-6" aria-hidden />
                    </>
                  }
                  triggerClassName={cn(
                    NAV_ITEM,
                    'gap-1 aria-expanded:bg-soft-fill',
                    r('pr-1.5 pl-2.5', undefined, 'xl:pr-2 xl:pl-3'),
                    // Active keeps its accent text and bar while open; an inactive trigger turns ink.
                    adminActive ? NAV_ACTIVE : cn(NAV_IDLE, 'aria-expanded:text-ink'),
                  )}
                  entries={[
                    ...admin.map((a): MenuEntry => ({
                      kind: 'link',
                      key: a.key,
                      label: a.label,
                      caption: a.caption,
                      href: a.href,
                      current: a.key === active ? activeCurrent : undefined,
                      icon: a.Icon ? <a.Icon className={MENU_ICON} aria-hidden /> : undefined,
                    })),
                    ...(onAdminRetry
                      ? [
                          {
                            kind: 'action',
                            key: 'admin-retry',
                            label: ADMIN_RETRY_LABEL,
                            onSelect: onAdminRetry,
                            icon: <ArrowPathIcon className={MENU_ICON} aria-hidden />,
                          } satisfies MenuEntry,
                        ]
                      : []),
                  ]}
                />
              </li>
            ) : null}
          </ul>
        </nav>

        <div className={cn('flex-1', r('hidden', 'md:block'))} />

        <SearchTrigger onSearch={onSearch} r={r} iconSize={iconSize} />

        {/* On /intra the signed-out slot is empty for good: no cluster at all (no reserved width, no
            extra gap), so the search ends on the gutter and nothing sits before ☰. */}
        {viewer.status === 'out' && !viewer.signInHref ? null : (
          // xl:ml-1: 12px between the search field and the account cluster, so the field and «Intră»
          // (or the bell) read as two groups.
          <div
            className={cn(
              'flex shrink-0 items-center justify-end',
              r(BAR.accountMin, BAR.accountMinMd, BAR.accountMinXl),
              r('gap-0', 'md:gap-2'),
              r('', undefined, 'xl:ml-1'),
            )}
          >
            {viewer.status === 'in' ? (
              <Link
                href={PATHS.notifications}
                aria-label={hasUnread ? 'Notificări, ai notificări noi' : 'Notificări'}
                aria-current={active === 'notificari' ? activeCurrent : undefined}
                className={iconButtonClass({
                  size: iconSize,
                  className: active === 'notificari' ? 'bg-accent-tint text-accent-ink' : undefined,
                })}
              >
                <BellIcon aria-hidden />
                {hasUnread ? (
                  // On the glyph's top-right corner: the 24px glyph is centred in the 48 / 40 button.
                  <span
                    aria-hidden
                    className={cn(
                      'absolute size-2.5 rounded-full border-2 border-surface bg-live',
                      r('top-3', undefined, 'xl:top-2'),
                      r('right-3', undefined, 'xl:right-2'),
                    )}
                  />
                ) : null}
              </Link>
            ) : null}
            <AccountSlot
              viewer={viewer}
              active={active}
              activeCurrent={activeCurrent}
              admin={admin}
              onSignOut={onSignOut}
              signingOut={signingOut}
              resetKey={resetKey}
              defaultOpen={openMenu === 'account'}
              r={r}
              slotSize={iconSize}
            />
          </div>
        )}

        <button
          type="button"
          onClick={onMenu}
          aria-label="Meniu"
          aria-haspopup="dialog"
          aria-expanded={menuOpen}
          className={iconButtonClass({ size: iconSize, className: cn('text-ink', r('flex', 'md:hidden')) })}
        >
          <Bars3Icon aria-hidden />
        </button>
      </div>
    </header>
  );
}

const isApple = () => {
  const nav = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return /Mac|iPhone|iPad/i.test(nav.userAgentData?.platform || nav.platform || '');
};
const noSubscribe = () => () => {};

/**
 * The search shortcut as this platform writes it: «⌘K» on Apple, «Ctrl K» elsewhere; null on the
 * server and during hydration (render nothing), so the markup never mismatches.
 */
export function useSearchShortcut(): string | null {
  return useSyncExternalStore(
    noSubscribe,
    () => (isApple() ? '⌘K' : 'Ctrl K'),
    () => null,
  );
}

/** <1280: a magnifier button. ≥1280: a field-like button with the ⌘K / Ctrl K hint. */
function SearchTrigger({ onSearch, r, iconSize }: { onSearch?: () => void; r: Pick3; iconSize: string }) {
  const shortcut = useSearchShortcut();
  return (
    <>
      <button
        type="button"
        onClick={onSearch}
        aria-label="Caută"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className={iconButtonClass({ size: iconSize, className: r('flex', undefined, 'xl:hidden') })}
      >
        <MagnifyingGlassIcon aria-hidden />
      </button>
      <button
        type="button"
        onClick={onSearch}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        className={cn(
          // The kit field's look, state for state (components/forms/Field.tsx controlShell): soft-fill
          // at rest with a transparent 2px border, no hover change, muted placeholder; focus turns it
          // surface with the accent border + tint ring. 40 tall: it only shows from 1280, where
          // controls are 40. TODO(kit): a shared `fieldLook({ size })` export from Field.tsx and a
          // `--shadow-focus-field` token, so this and controlShell come from one definition.
          't-field h-10 shrink-0 cursor-pointer items-center gap-2 rounded-control border-2 border-transparent bg-soft-fill pr-1.5 pl-2.5 text-left text-muted',
          'transition-[background-color,border-color,box-shadow,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
          'focus-visible:border-accent focus-visible:bg-surface focus-visible:shadow-[0_0_0_4px_var(--color-accent-tint-2)] focus-visible:outline-none',
          BAR.searchField,
          r('hidden', undefined, 'xl:flex'),
        )}
      >
        <MagnifyingGlassIcon className="size-6 shrink-0" aria-hidden />
        <span className="flex-1 truncate">Caută bălți, concursuri, pescari</span>
        {shortcut ? (
          <kbd aria-hidden className="t-nano rounded-badge bg-surface px-1 py-0.5 text-muted">
            {shortcut}
          </kbd>
        ) : null}
      </button>
    </>
  );
}

/** The account cluster's round slot (avatar or placeholder), 48 / 40 like every bar control. */
const SLOT = 'relative flex shrink-0 items-center justify-center rounded-full';

/** What the account menu's identity block says under the name: the admin roles, else «Pescar». */
function roleCaption(admin: AdminLink[]): string {
  const roles = [
    admin.some((a) => a.key === 'organizator') ? 'Organizator' : null,
    admin.some((a) => a.key.startsWith('operator-')) ? 'Operator baltă' : null,
  ].filter(Boolean);
  return roles.length ? roles.join(' · ') : 'Pescar';
}

function AccountSlot({
  viewer,
  active,
  activeCurrent,
  admin,
  onSignOut,
  signingOut,
  resetKey,
  defaultOpen,
  r,
  slotSize,
}: {
  viewer: TopBarViewer;
  active?: string;
  activeCurrent: 'page' | 'true';
  admin: AdminLink[];
  onSignOut?: () => void;
  signingOut: boolean;
  resetKey?: string;
  defaultOpen: boolean;
  r: Pick3;
  slotSize: string;
}) {
  const slot = cn(SLOT, slotSize);
  if (viewer.status === 'pending' || viewer.status === 'unknown') {
    // Same footprint as the avatar, and nobody signed in ever sees «Intră». Unknown (the session
    // read gave no answer in time) looks exactly like pending — owner rule 4 (ROADMAP §4b): when we
    // don't know, we don't show. No warning dot, no copy; the shell re-reads quietly (SiteTopBar).
    return (
      <span aria-hidden className={slot}>
        <span className="size-8 rounded-full bg-soft-fill" />
      </span>
    );
  }
  if (viewer.status === 'out') {
    if (!viewer.signInHref) return null;
    // The visitor's main action: the kit outline Button (48 / 40), filling the cluster's width. Not
    // a filled pill next to the soft-fill search field (they read as two inputs), and not primary:
    // white on accent is 4.46:1 at 14px, under AA.
    return (
      <ButtonLink href={viewer.signInHref} variant="outline" className="w-full" data-sign-in>
        Intră
      </ButtonLink>
    );
  }
  const entries: MenuEntry[] = [
    {
      kind: 'link',
      key: 'profil',
      label: 'Profil',
      href: PATHS.profile,
      current: active === 'profil' ? activeCurrent : undefined,
      icon: <UserCircleIcon className={MENU_ICON} aria-hidden />,
    },
    {
      kind: 'link',
      key: 'setari',
      label: 'Setări',
      href: PATHS.settings,
      current: active === 'setari' ? activeCurrent : undefined,
      icon: <Cog6ToothIcon className={MENU_ICON} aria-hidden />,
    },
    ...(onSignOut
      ? ([
          { kind: 'separator', key: 'sep-iesi' },
          {
            kind: 'action',
            key: 'iesi',
            label: 'Ieși din cont',
            onSelect: onSignOut,
            danger: true,
            icon: <ArrowRightStartOnRectangleIcon className="size-6 shrink-0" aria-hidden />,
          },
        ] satisfies MenuEntry[])
      : []),
  ];
  // The avatar is fish's Profil tab: its accent ring (round the 32px avatar, the trigger's 4px
  // inset is the gap) and the «current page inside» name show on /profil only (parity
  // global.shell.c7). /setari is marked by its own menu row («current»), never by the ring.
  const accountActive = active === 'profil';
  // «Ieși din cont» is on its way: the trigger stays mounted (focus stays on it) but is busy — no
  // menu, a spinner in place of the avatar; SiteTopBar announces it in its polite status.
  return (
    <MenuButton
      label={`Contul meu, ${viewer.name}`}
      resetKey={resetKey}
      defaultOpen={defaultOpen}
      currentInside={accountActive}
      busy={signingOut}
      // 56 / 64px bar, a 48px trigger at 4–52 / 8–56 below 1280, 40px at 12–52 from 1280: the menu
      // hangs 4px below the bar's edge (60 / 68).
      menuClassName={cn('top-full', r('mt-2', 'md:mt-3', 'xl:mt-4'))}
      // Identity block: avatar 40 + name + role. Its left edge is the rows' (px-3), so the avatar
      // lines up with the row icons below it.
      header={
        <div className="flex items-center gap-2.5">
          <AccountAvatar name={viewer.name} src={viewer.avatarUrl} size={40} />
          <div className="flex min-w-0 flex-col">
            <p className="t-body-strong truncate text-ink">{viewer.name}</p>
            <p className="t-caption truncate text-muted">{roleCaption(admin)}</p>
          </div>
        </div>
      }
      trigger={
        signingOut ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-soft-fill text-muted">
            <ArrowPathIcon className="size-6 animate-spin" aria-hidden />
          </span>
        ) : (
          <AccountAvatar name={viewer.name} src={viewer.avatarUrl} size={32} />
        )
      }
      triggerClassName={cn(
        slot,
        PRESS,
        'hover:bg-soft-fill aria-expanded:bg-soft-fill aria-disabled:cursor-progress aria-disabled:active:opacity-100',
        accountActive && 'ring-2 ring-accent',
      )}
      entries={entries}
    />
  );
}

/**
 * The account's picture: the profile photo, or — without one — the round Bluvi mark, as fish's
 * Profil tab draws it (global.shell.c6), never initials on a colour disc.
 */
function AccountAvatar({ name, src, size }: { name: string; src?: string | null; size: 32 | 40 }) {
  if (src) return <Avatar name={name} src={src} size={size} tone="indigo" />;
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent', size === 40 ? 'size-10' : 'size-8')}>
      <FishLogo className={size === 40 ? 'size-6' : 'size-5'} />
    </span>
  );
}
