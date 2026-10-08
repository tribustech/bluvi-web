'use client';

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import {
  approvedParticipantIds,
  participantStatisticsBatchQuery,
  participantStatisticsState,
  registrationDisplayName,
  registrationTeamSubtitle,
  type CompetitionWithMyStatus,
  type DetailRegistration,
} from '@/core/competitions';
import type { ParticipantStats } from '@/core/social';
import type { Transport } from '@/core/transport';
import { formatWeight } from '@/components/ranking';
import { sectorFill } from '@/components/ranking/sector';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { anglerHref } from '@/lib/routes';
import { signInHref } from '../../../_shell/SiteHeader';
import { echoes } from './names';
import { GUEST_MESSAGE } from './participantParts';
import { PAGE_RETRY } from './retry-policy';
import { photo, useBrokenImages } from './brokenImages';

/*
 * PersonPopover — owner rule 17: on a wide screen a person (a participant, a ranking row, a
 * weighing's angler) opens in a popover anchored to the row that was pressed, never a page change.
 * It shows the avatar (a team: its faces), the name(s), the club, the sector and stand, the key
 * stats (Capturi, CMMC, Concursuri — the participant statistics batch the Participanți list reads,
 * one shared cache entry) and «Vezi profilul» → /pescari/[id] (signed out: sign-in first, the
 * profile is not public). A team lists each member with their own face, stats and profile link. A
 * registration typed in by the organizer has no account: no stats, no profile.
 *
 * The profile links are gated on anglerHref (lib/routes ON_WEB.angler): /pescari/[id] shipped in
 * M2-B1 (account.angler-profile), so «Vezi profilul» / «Profil» are links (rule 17). The gate stays:
 * a page switched off again turns them back into plain text, never a link to a 404.
 *
 * Keyboard: focus moves into the popover when it opens and is trapped there (Tab / Shift+Tab cycle),
 * Escape or «Închide» closes it and focus returns to the row that opened it; a press outside
 * closes it too (focus stays where the press put it). It lives in the top layer (popover="manual"),
 * so it sits above a docked side panel or a dialog without a z-index (inside a modal dialog it is
 * rendered in the dialog, which keeps it interactive), and it follows its row on scroll and resize.
 * Placement (`placement`): beside a docked panel (to its left, never over its title), else under
 * the row, over it only when that hides no heading, else beside the row.
 *
 * The phone keeps fish's sheet / expanding card: open it only when `usePersonPopoverEnabled()`
 * (≥1024). Hook-up:
 *
 *   const person = usePersonPopover();
 *   <tr onClick={e => person.open(registrationId, e.currentTarget)} …>
 *   <PersonPopover t={t} competition={competition} signedIn={…} target={person.target} onClose={person.close} />
 */

/** The width from which a person opens in the popover (below: the phone's sheet / card). */
export const PERSON_POPOVER_MIN_WIDTH = 1024;
const QUERY = `(min-width: ${PERSON_POPOVER_MIN_WIDTH}px)`;

export type PersonTarget = {
  /** The registration's documentId (DetailRegistration / allocation `registrationId`, ranking row `registrationId`). */
  registrationId: string;
  /** The row pressed: the popover is anchored to it and focus returns to it on close. */
  anchor: HTMLElement;
  /** The stand as the opening view names it (NC «A3(12)»); default «Sector A · Stand 12» from the registration. */
  standLabel?: string | null;
};

/** ≥1024 (false on the server and until hydrated: the phone's behaviour). */
export function usePersonPopoverEnabled(): boolean {
  return useSyncExternalStore(
    cb => {
      const m = window.matchMedia(QUERY);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

/** The popover's open state: `open(registrationId, row)`, `close()`; pressing the open row again closes it. */
export function usePersonPopover() {
  const [target, setTarget] = useState<PersonTarget | null>(null);
  const open = useCallback((registrationId: string, anchor: HTMLElement, standLabel?: string | null) => {
    setTarget(cur => (cur && cur.registrationId === registrationId && cur.anchor === anchor ? null : { registrationId, anchor, standLabel }));
  }, []);
  const close = useCallback(() => setTarget(null), []);
  return { target, open, close };
}

type Props = {
  t: Transport;
  competition: CompetitionWithMyStatus;
  /** Signed in (stats shown), signed out (a quiet sign-in hint), unknown (undefined: no stats part yet). */
  signedIn: boolean | undefined;
  target: PersonTarget | null;
  onClose: () => void;
  /**
   * The accounts whose stats to read; default the approved ones (the Participanți roster's batch).
   * The organizer's list passes every account, pending and rejected too.
   */
  statsIds?: string[];
};

export function PersonPopover({ t, competition, signedIn, target, onClose, statsIds }: Props) {
  const registration = useMemo(() => (target ? (competition.registrations.find(r => r.documentId === target.registrationId) ?? null) : null), [competition.registrations, target]);
  if (!target || !registration) return null;
  return <Popover key={`${target.registrationId}`} t={t} competition={competition} signedIn={signedIn} target={target} registration={registration} onClose={onClose} statsIds={statsIds} />;
}

const GAP = 8;
const EDGE = 12;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Side = 'below' | 'above' | 'left' | 'right';
type Rect = { top: number; left: number; bottom: number; right: number };

/**
 * Where the popover goes (viewport px). Inside the docked side panel (Cântare's weighing detail,
 * ContextSurface ≥1280, an `aside`) it opens to the panel's left, its top on the row's, so it never
 * covers the panel's own title; a row in the right half of the screen does the same beside the row.
 * Otherwise under the row; over it only when that covers no heading; else beside the row (right,
 * then left); else under it, kept inside the viewport.
 */
function placement(anchor: HTMLElement, el: HTMLElement): { top: number; left: number; side: Side } {
  const a = anchor.getBoundingClientRect();
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const clampTop = (top: number) => Math.max(EDGE, Math.min(top, vh - h - EDGE));
  const clampLeft = (left: number) => Math.max(EDGE, Math.min(left, vw - w - EDGE));
  const sideTop = clampTop(a.top - 8);
  const rect = (top: number, left: number): Rect => ({ top, left, bottom: top + h, right: left + w });
  const headings = [...document.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"]')]
    .filter(n => !el.contains(n))
    .map(n => n.getBoundingClientRect())
    .filter(r => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < vh);
  const coversHeading = (r: Rect) => headings.some(hr => hr.left < r.right && hr.right > r.left && hr.top < r.bottom && hr.bottom > r.top);

  const dock = anchor.closest('aside');
  if (dock) {
    const d = dock.getBoundingClientRect();
    if (d.left - GAP - w >= EDGE) return { top: sideTop, left: d.left - GAP - w, side: 'left' };
  }
  const leftOfRow = a.left - GAP - w;
  if (a.left > vw / 2 && leftOfRow >= EDGE) return { top: sideTop, left: leftOfRow, side: 'left' };

  const left = clampLeft(a.left + Math.min(24, a.width / 4));
  if (vh - a.bottom - GAP - EDGE >= h) return { top: a.bottom + GAP, left, side: 'below' };
  const above = a.top - GAP - h;
  if (above >= EDGE && !coversHeading(rect(above, left))) return { top: above, left, side: 'above' };
  if (a.right + GAP + w <= vw - EDGE) return { top: sideTop, left: a.right + GAP, side: 'right' };
  if (leftOfRow >= EDGE) return { top: sideTop, left: leftOfRow, side: 'left' };
  if (above >= EDGE) return { top: above, left, side: 'above' };
  return { top: clampTop(a.bottom + GAP), left, side: 'below' };
}

function Popover({
  t,
  competition,
  signedIn,
  target,
  registration: r,
  onClose,
  statsIds,
}: Omit<Props, 'target'> & {
  target: PersonTarget;
  registration: DetailRegistration;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // A photo that fails to load shows the initials (as the lists do).
  const [brokenRef, broken] = useBrokenImages<HTMLDivElement>();
  const setRef = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el;
      return brokenRef(el);
    },
    [brokenRef],
  );
  const titleId = useId();
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    side: Side;
  } | null>(null);
  const { anchor } = target;

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = placement(anchor, el);
    setPos(p => (p && p.top === next.top && p.left === next.left && p.side === next.side ? p : next));
  }, [anchor]);

  // Top layer, then placed before paint; focus into it.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    try {
      el.showPopover();
    } catch {
      /* already shown, or no popover support: still fixed-positioned */
    }
    place();
    return () => {
      try {
        el.hidePopover();
      } catch {
        /* gone */
      }
    };
  }, [place]);

  // Focus into it once placed (hidden until then: a hidden element cannot take focus).
  const placed = pos !== null;
  useLayoutEffect(() => {
    if (!placed) return;
    const el = ref.current;
    (el?.querySelector<HTMLElement>('[data-autofocus]') ?? el)?.focus({
      preventScroll: true,
    });
  }, [placed]);

  // Follow the row; close when it leaves the page (unmounted row) or on a press outside.
  useEffect(() => {
    const onMove = () => {
      if (!anchor.isConnected) return onClose();
      place();
    };
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (ref.current?.contains(n) || anchor.contains(n)) return;
      onClose();
    };
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    document.addEventListener('pointerdown', onDown, true);
    const ro = new ResizeObserver(() => place());
    if (ref.current) ro.observe(ref.current);
    return () => {
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
      document.removeEventListener('pointerdown', onDown, true);
      ro.disconnect();
    };
  }, [anchor, onClose, place]);

  const closeAndReturn = () => {
    onClose();
    if (anchor.isConnected) anchor.focus({ preventScroll: true });
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      // Not the side panel's / dialog's Escape: only the popover closes.
      e.preventDefault();
      e.stopPropagation();
      closeAndReturn();
      return;
    }
    if (e.key !== 'Tab') return;
    const el = ref.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) {
      e.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === el)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Stats: the batch the Participanți list reads (same key → one cache entry).
  const ids = useMemo(() => statsIds ?? approvedParticipantIds(competition.registrations), [statsIds, competition.registrations]);
  const isAuthenticated = signedIn === true;
  const statsQ = useQuery({
    ...participantStatisticsBatchQuery(t, competition.documentId, ids, {
      isAuthenticated,
    }),
    ...PAGE_RETRY,
  });
  const stats = participantStatisticsState(statsQ, ids, { isAuthenticated });
  const statsState: PersonStats =
    signedIn === undefined
      ? { kind: 'pending' }
      : !signedIn || stats.isStatsUnauthorized
        ? { kind: 'signIn' }
        : !statsQ.data && statsQ.errorUpdatedAt > 0
          ? { kind: 'failed', retry: () => void statsQ.refetch() }
          : stats.isLoading
            ? { kind: 'pending' }
            : { kind: 'ok', map: stats.statsMap };

  const team = competition.competitionType === 'team';
  const type = team ? 'team' : 'single';
  const name = registrationDisplayName(r, type);
  const rawSubtitle = registrationTeamSubtitle(r, type);
  const subtitle = team && rawSubtitle && !echoes(rawSubtitle, name) ? rawSubtitle : null;
  const where = standWhere(competition, r, target.standLabel);
  const club = r.club?.name ?? null;
  const guest = r.participants.length === 0;
  // null while the web has no profile page (ON_WEB.angler): no link rather than a 404.
  const profileOf = (documentId: string) => {
    const href = anglerHref(documentId);
    return href && signedIn === false ? signInHref(href) : href;
  };
  const soloProfile = !guest && !team ? profileOf(r.participants[0].documentId) : null;

  return createPortal(
    <div
      ref={setRef}
      popover="manual"
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-person-popover
      onKeyDown={onKeyDown}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
      className={cn(
        'fixed m-0 w-90 max-w-[calc(100vw-24px)] overflow-hidden rounded-card border-0 bg-surface p-0 text-ink shadow-e2 outline-none',
        'max-h-[min(36rem,calc(100vh-24px))] overflow-y-auto overscroll-contain',
        'opacity-100 transition-[opacity,translate] duration-(--duration-fast) ease-fast starting:opacity-0 motion-reduce:transition-none',
        pos?.side === 'above' ? 'starting:translate-y-1' : pos?.side === 'left' ? 'starting:translate-x-1' : pos?.side === 'right' ? 'starting:-translate-x-1' : 'starting:-translate-y-1',
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-4 pb-3">
        {team && r.participants.length > 0 ? (
          <FaceStack
            size={40}
            people={r.participants.slice(0, 3).map(p => ({
              name: p.username,
              src: photo(p.avatar?.url, broken),
            }))}
            overflow={Math.max(0, r.participants.length - 3)}
          />
        ) : (
          <Avatar name={r.participants[0]?.username ?? r.guestName ?? name} src={photo(r.participants[0]?.avatar?.url, broken)} size={48} tone={guest ? 'neutral' : undefined} />
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={titleId} className="line-clamp-2 t-heading text-ink">
            {name}
          </h2>
          {subtitle ? <p className="line-clamp-2 t-caption text-ink-2">{subtitle}</p> : null}
          {club ? <p className="truncate t-caption text-muted">{club}</p> : null}
        </div>
        <button
          type="button"
          onClick={closeAndReturn}
          aria-label="Închide"
          className="-mt-1 -mr-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted hover:bg-soft-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          <XMarkIcon aria-hidden className="size-5" />
        </button>
      </header>

      <p className="mx-4 flex items-center gap-2 t-caption text-ink-2">
        {where.sector ? <SectorDot name={where.sector} /> : null}
        <span className="t-label text-ink">{where.label}</span>
      </p>

      <div className="flex flex-col gap-3 px-4 pt-3 pb-4">
        {guest ? (
          <p className="t-caption text-ink-2">{GUEST_MESSAGE}</p>
        ) : team ? (
          <ul aria-label="Membrii echipei" className="flex flex-col divide-y divide-hairline rounded-card bg-page px-3">
            {r.participants.map((p, i) => {
              const href = profileOf(p.documentId);
              return (
                <li key={p.documentId} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.username} src={photo(p.avatar?.url, broken)} size={32} />
                    <span className="min-w-0 flex-1 truncate t-body-strong text-ink">{p.username}</span>
                    {href ? (
                      <Link
                        href={href}
                        data-autofocus={i === 0 ? '' : undefined}
                        aria-label={`Profilul lui ${p.username}`}
                        className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-control px-2 t-label text-accent-ink hover:bg-accent-tint focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
                      >
                        Profil
                        <ArrowRightIcon aria-hidden className="size-3.5" />
                      </Link>
                    ) : null}
                  </div>
                  <PersonStatsRow stats={statsState} documentId={p.documentId} compact />
                </li>
              );
            })}
          </ul>
        ) : (
          <PersonStatsRow stats={statsState} documentId={r.participants[0].documentId} />
        )}

        {statsState.kind === 'signIn' && !guest ? (
          <p className="t-caption text-muted">
            <Link
              href={signInHref(window.location.pathname, window.location.search)}
              className="rounded-control t-label text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
            >
              Intră în cont
            </Link>{' '}
            ca să vezi statisticile.
          </p>
        ) : null}

        {soloProfile ? (
          <ButtonLink href={soloProfile} variant="primary" size="compact" block data-autofocus="" iconRight={<ArrowRightIcon aria-hidden />}>
            Vezi profilul
          </ButtonLink>
        ) : null}
      </div>
    </div>,
    // Inside a modal dialog (Cântare's detail to 1279) everything outside it is inert: the popover
    // is put in the dialog's subtree (still the top layer, above it).
    anchor.closest('dialog') ?? document.body,
  );
}

type PersonStats = { kind: 'pending' } | { kind: 'signIn' } | { kind: 'failed'; retry: () => void } | { kind: 'ok'; map: Record<string, ParticipantStats> };

/** Capturi · CMMC · Concursuri — the unit apart, smaller and muted (owner rule 10). */
function PersonStatsRow({ stats, documentId, compact }: { stats: PersonStats; documentId: string; compact?: boolean }) {
  if (stats.kind === 'signIn') return null;
  if (stats.kind === 'failed') {
    return (
      <p role="alert" className="flex items-center gap-2 t-caption text-ink-2">
        Statisticile nu au putut fi încărcate.
        <button
          type="button"
          onClick={stats.retry}
          className="cursor-pointer rounded-control t-label text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          Reîncearcă
        </button>
      </p>
    );
  }
  const tile = cn('flex min-w-0 flex-col rounded-control', compact ? 'bg-surface px-2 py-1.5' : 'bg-page px-3 py-2');
  if (stats.kind === 'pending') {
    return (
      <div aria-busy="true" className="grid grid-cols-3 gap-1.5">
        <span role="status" className="sr-only">
          Se încarcă statisticile…
        </span>
        {[0, 1, 2].map(i => (
          <span key={i} aria-hidden className={cn(tile, 'h-12 animate-shimmer')} />
        ))}
      </div>
    );
  }
  const s = stats.map[documentId];
  // Not in the batch (an account the batch did not ask for): unknown, so nothing — never zeros.
  if (!s) return null;
  const items: { label: string; value: string; unit?: string }[] = [
    { label: 'Capturi', value: String(s.catches) },
    {
      label: 'CMMC',
      value: s.biggestCatchKg == null ? '–' : formatWeight(s.biggestCatchKg),
      unit: s.biggestCatchKg == null ? undefined : 'kg',
    },
    { label: 'Concursuri', value: String(s.competitions) },
  ];
  return (
    <dl className="grid grid-cols-3 gap-1.5">
      {items.map(({ label, value, unit }) => (
        <div key={label} className={tile}>
          <dt className="t-micro text-muted">{label}</dt>
          <dd className={cn('truncate text-ink tabular-nums', compact ? 't-label' : 't-body-strong')}>
            {value}
            {unit ? <span className="ml-0.5 t-micro text-muted">{unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function SectorDot({ name }: { name: string }) {
  const fill = sectorFill(name, 'var(--color-accent)');
  return <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />;
}

/** «Sector A · Stand 12» (or the opening view's own label), «Nealocat» without a stand. */
function standWhere(competition: CompetitionWithMyStatus, r: DetailRegistration, override: string | null | undefined): { sector: string | null; label: string } {
  if (!r.stand) return { sector: null, label: 'Nealocat' };
  const sector = competition.sectors.find(s => s.stands.some(st => st.documentId === r.stand?.documentId))?.name ?? null;
  if (override) return { sector, label: `Stand ${override}` };
  return {
    sector,
    label: sector ? `Sector ${sector} · Stand ${r.stand.name}` : `Stand ${r.stand.name}`,
  };
}
