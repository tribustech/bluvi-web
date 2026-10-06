'use client';

import { Suspense, useCallback, useId, useMemo, useState, type ComponentType, type SVGProps } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowTrendingUpIcon, ChevronDownIcon, ChevronRightIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  approvedParticipantIds,
  approvedRegistrationsByStand,
  participantStatisticsBatchQuery,
  participantStatisticsState,
  registrationCounts,
  registrationDisplayName,
  registrationTeamSubtitle,
  soloParticipant,
  type CompetitionWithMyStatus,
  type DetailRegistration,
} from '@/core/competitions';
import type { ParticipantStats, UserStatuteForCompetition } from '@/core/social';
import type { Transport } from '@/core/transport';
import { CardShell, Pill } from '@/components/cards';
import { formatWeight } from '@/components/ranking';
import { FishIcon } from '@/components/icons/brand';
import { listGridClass } from '@/components/templates/T1';
import { DetailBody, DetailSection, DetailSectionState } from '@/components/templates/T3';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { ButtonLink } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { signInHref } from '../../../_shell/SiteHeader';
import { isUnknownViewer, useViewerState } from '../../../_shell/viewer-context';
import { anglerHref } from '@/lib/routes';
import type { PageViewer } from './Follow';
import { QueryRetry } from './QueryRetry';
import { PAGE_RETRY } from './retry-policy';
import { Bone } from './tabParts';

/*
 * Concurs · Participanți — fish components/competition/CompetitionParticipants.tsx +
 * ParticipantCard.tsx (parity competition-page.participanti): the approved registrations, by stand
 * (unallocated first), one card each — the stand tag in the corner, the face(s), the name (a team:
 * its name, the members under it). The card opens on its stats: Capturi, CMMC, Concursuri per angler,
 * read for every participant in one batch (signed in only; signed out the card asks to sign in).
 *
 * Cards are the kit CardShell on the kit list grid (T1 listGridClass: auto-fill, more per row as the
 * screen grows, never wider cards; the one 16px gutter), aligned to their top so one opened card
 * does not stretch its row. On the phone they run edge to edge, 8px apart (the T3 phone blocks).
 *
 * The competition's author: fish shows the organizer's registrations list instead
 * (competition-page.participanti-organizator, M6). Until it ships the author sees this list under a
 * notice — the pending count (fish's main organizer signal) and the app's deep link to its pending
 * registrations. The notice is decided from the core's author and the session the server streams
 * with the page; the notice and the list sit in one Suspense boundary, so they are revealed together
 * (never a notice inserted over a painted list).
 *
 * Profiles: fish opens a one-user card's angler profile from its header. The profile (/pescari) is
 * M2 on the web (anglerHref is null until then): every header toggles the card, as a multi-member
 * card does in fish; the profile link takes over the moment it ships.
 */

/** The kit grid (T1, 340px cards) — the phone's rows edge to edge, 8px apart. */
const GRID = cn(listGridClass('lg'), 'items-start max-md:-mx-4 max-md:gap-2');

type Props = {
  t: Transport;
  competition: CompetitionWithMyStatus;
  viewer: PageViewer;
  statute: UserStatuteForCompetition | undefined;
  signIn: string;
  /** Where the organizer manages the registrations today (the competition in the Bluvi app). */
  appHref: string;
};

export function ParticipantsTab({ t, competition, viewer, statute, signIn, appHref }: Props) {
  const id = competition.documentId;
  const isAuthenticated = !!viewer;
  const registrations = useMemo(() => approvedRegistrationsByStand(competition.registrations), [competition.registrations]);
  const ids = useMemo(() => approvedParticipantIds(competition.registrations), [competition.registrations]);
  const statsQ = useQuery({ ...participantStatisticsBatchQuery(t, id, ids, { isAuthenticated }), ...PAGE_RETRY });
  const stats = participantStatisticsState(statsQ, ids, { isAuthenticated });
  const team = competition.competitionType === 'team';
  const [listRef, broken] = useBrokenImages<HTMLUListElement>();

  const stats$: StatsAccess =
    viewer === undefined
      ? { kind: 'pending' }
      : stats.isStatsUnauthorized
        ? { kind: 'signIn', href: signIn }
        : // Failed once and nothing to show: stays «failed» while the retry runs (TanStack puts a
          // data-less query back to pending on refetch), so QueryRetry keeps its busy state and can
          // say «Tot nu s-a putut încărca.».
          !statsQ.data && statsQ.errorUpdatedAt > 0
          ? { kind: 'failed', retry: () => void statsQ.refetch(), retrying: statsQ.isFetching }
          : stats.isLoading
            ? { kind: 'pending' }
            : { kind: 'ok', map: stats.statsMap };

  return (
    <DetailBody>
      {/* The notice and the list are revealed together, once the session the server streams has
          answered (the list's bones until then): the notice never pushes painted cards down. */}
      <Suspense fallback={<ParticipantsBones />}>
        <AuthorNotice competition={competition} statute={statute} appHref={appHref} />
        {registrations.length === 0 ? (
          <DetailSectionState
            icon={
              <span className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">
                <UserGroupIcon aria-hidden />
              </span>
            }
            heading="Încă nu s-au înregistrat participanți pentru această competiție."
          />
        ) : (
          <DetailSection
            tone="plain"
            title={team ? 'Echipe înscrise' : 'Participanți înscriși'}
            description={team ? (registrations.length === 1 ? '1 echipă aprobată' : `${registrations.length} echipe aprobate`) : registrations.length === 1 ? '1 participant aprobat' : `${registrations.length} participanți aprobați`}
          >
            <ul ref={listRef} className={GRID}>
              {registrations.map(r => (
                <li key={r.documentId}>
                  <ParticipantCard registration={r} team={team} stats={stats$} viewer={viewer} broken={broken} />
                </li>
              ))}
            </ul>
          </DetailSection>
        )}
      </Suspense>
    </DetailBody>
  );
}

/**
 * The list's bones — its section header and six cards on the same grid (also the tab's skeleton:
 * CompetitionSkeleton TabBones), so nothing moves when the list lands.
 */
export function ParticipantsBones() {
  return (
    <div aria-hidden className="px-4 py-3 md:p-0">
      <span className="mb-3 flex flex-col gap-0.5 xl:mb-4">
        <Bone className="w-48 t-title2" />
        <Bone className="w-32 t-caption" />
      </span>
      <span className={GRID}>
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} data-bone="card" className="flex min-h-20 items-center gap-3 rounded-card bg-surface py-3 pr-18 pl-4 shadow-e0 max-md:rounded-none max-md:shadow-none">
            <span className="size-12 shrink-0 animate-shimmer rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col">
              <Bone className="w-32 t-body-strong" />
              <Bone className="w-20 t-caption" />
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * fish's deep link to the organizer's registrations (helpers/getRedirectLocationForNotification.ts:
 * COMPETITION_NEW_REGISTRATION_ORGANIZER): the Participanți tab, on its pending filter when some wait.
 */
export function organizerAppHref(appHref: string, pending: number): string {
  return `${appHref}?activeTabId=participanti${pending > 0 ? '&participantsFilter=pending' : ''}`;
}

/**
 * The organizer notice, decided from data present at the first paint — the core's author and the
 * session read the server streams (useViewerState) — never from the statute read after the list
 * has painted. The statute stays the fallback for a core without its author. An unknown session
 * shows nothing (never a guess). Until competition-page.participanti-organizator ships, it carries
 * fish's organizer signal: how many registrations wait for approval.
 */
function AuthorNotice({ competition, statute, appHref }: { competition: CompetitionWithMyStatus; statute: UserStatuteForCompetition | undefined; appHref: string }) {
  const state = useViewerState();
  const user = isUnknownViewer(state) ? null : state;
  const isAuthor = user ? (competition.author ? competition.author.documentId === user.documentId : statute?.userRole === 'author') : false;
  if (!isAuthor) return null;
  const { pending } = registrationCounts(competition.registrations);
  return (
    <DetailSection
      id="organizator"
      title="Ești organizatorul acestui concurs"
      description="Aprobarea, respingerea și editarea înscrierilor se fac deocamdată din aplicația Bluvi."
    >
      <div className="flex flex-wrap items-center gap-3">
        {pending > 0 ? <StatusPill tone="pending">{pending === 1 ? '1 înscriere în așteptare' : `${pending} înscrieri în așteptare`}</StatusPill> : null}
        <ButtonLink href={organizerAppHref(appHref, pending)} variant="secondary" size="compact">
          {pending > 0 ? 'Aprobă-le în aplicație' : 'Gestionează în aplicație'}
        </ButtonLink>
      </div>
    </DetailSection>
  );
}

/**
 * The avatar photos that failed to load (a dead CMS URL): the kit Avatar has no fallback for a
 * broken <img> yet, so the list listens for image errors (capture phase: `error` does not bubble)
 * and the card renders the initials instead. TODO(kit, ui owner): Avatar should keep a `failed`
 * state from its <img> onError and show the initials itself; then drop this.
 */
function useBrokenImages<T extends HTMLElement>() {
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  // A callback ref: the list mounts after the tab (behind its Suspense boundary).
  const ref = useCallback((el: T | null) => {
    if (!el) return;
    const mark = (img: HTMLImageElement) => {
      const src = img.getAttribute('src');
      if (src) setBroken(b => (b.has(src) ? b : new Set(b).add(src)));
    };
    const onError = (e: Event) => {
      if (e.target instanceof HTMLImageElement) mark(e.target);
    };
    el.addEventListener('error', onError, true);
    // One that failed before hydration (server-rendered, no listener yet).
    el.querySelectorAll('img').forEach(img => {
      if (img.complete && img.naturalWidth === 0) mark(img);
    });
    return () => el.removeEventListener('error', onError, true);
  }, []);
  return [ref, broken] as const;
}

type StatsAccess =
  | { kind: 'pending' }
  | { kind: 'signIn'; href: string }
  | { kind: 'failed'; retry: () => void; retrying: boolean }
  | { kind: 'ok'; map: Record<string, ParticipantStats> };

const GUEST_MESSAGE = 'Statisticile nu sunt disponibile pentru utilizatorii adăugați manual.';

/** fish ParticipantCard. */
function ParticipantCard({
  registration: r,
  team,
  stats,
  viewer,
  broken,
}: {
  registration: DetailRegistration;
  team: boolean;
  stats: StatsAccess;
  viewer: PageViewer;
  broken: ReadonlySet<string>;
}) {
  const [expanded, setExpanded] = useState(false);
  // The stats mount on the first opening and stay, so the panel can animate closed.
  const [opened, setOpened] = useState(false);
  const panelId = useId();
  const type = team ? 'team' : 'single';
  const name = registrationDisplayName(r, type);
  const rawSubtitle = registrationTeamSubtitle(r, type);
  // A guest team's subtitle often repeats its name («Bibanu si Paul Sarbu» / «Bibanul si Paul Sarbu»).
  const subtitle = rawSubtitle && !echoes(rawSubtitle, name) ? rawSubtitle : null;
  const solo = soloParticipant(r);
  // fish: a one-user card opens the profile (signed out: sign-in first — the profile is not public).
  const profile = solo ? profileHref(solo.documentId, viewer) : null;
  const toggle = () => {
    setOpened(true);
    setExpanded(e => !e);
  };
  const toggleLabel = expanded ? 'Restrânge detaliile' : 'Arată detaliile';

  const identity = (
    <>
      <CardAvatar registration={r} team={team} name={name} broken={broken} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="line-clamp-2 t-body-strong text-ink">{name}</span>
        {subtitle ? <span className="line-clamp-2 t-caption text-muted">{subtitle}</span> : null}
      </span>
    </>
  );
  // pr-18: the right 72px are the chevron's column and the corner tag's width («Stand 12»,
  // «Nealocat»), so a two-line name never runs under the tag.
  const HEADER = 'flex min-h-20 w-full items-center gap-3 py-3 pr-18 pl-4 text-left';
  const FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';
  // From 768 the card lifts on hover (CardShell); the phone's edge-to-edge row tints instead.
  const HOVER = cn('transition-colors duration-(--duration-fast)', !expanded && 'max-md:hover:bg-soft-fill');

  return (
    <CardShell interactive label={name} className="max-md:rounded-none max-md:shadow-none!">
      {/* fish's corner pill: «Stand 12» (teal → the info status pair) / «Nealocat» (red). */}
      <Pill tone={r.stand?.name ? 'info' : 'danger'} className="pointer-events-none absolute top-0 right-0 z-above rounded-none! rounded-bl-card!">
        {r.stand?.name ? `Stand ${r.stand.name}` : 'Nealocat'}
      </Pill>
      {profile ? (
        <>
          <Link href={profile} className={cn(HEADER, FOCUS, HOVER)}>
            {identity}
          </Link>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-label={toggleLabel}
            onClick={toggle}
            className={cn('absolute right-0 bottom-0 flex h-20 w-12 items-center justify-center text-muted hover:text-ink', FOCUS)}
          >
            <ChevronDownIcon aria-hidden className={cn('size-5 transition-transform duration-(--duration-fast)', expanded && 'rotate-180')} />
          </button>
        </>
      ) : (
        // Every other card: the whole header is the toggle (the chevron with it).
        <button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={toggle} className={cn(HEADER, FOCUS, HOVER, 'relative cursor-pointer')}>
          {identity}
          <span className="sr-only">, {toggleLabel}</span>
          <span aria-hidden className="absolute right-0 bottom-0 flex h-20 w-12 items-center justify-center text-muted">
            <ChevronDownIcon className={cn('size-5 transition-transform duration-(--duration-fast)', expanded && 'rotate-180')} />
          </span>
        </button>
      )}
      {/* The disclosure opens in height (grid rows 0fr → 1fr), part of the card: its white, under a
          hairline. Closed it is inert (out of the tab order and the accessibility tree). */}
      <div
        id={panelId}
        inert={!expanded}
        className={cn(
          'grid transition-[grid-template-rows] duration-(--duration-fast) ease-fast motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-hairline bg-surface px-4 py-3">
            {opened ? <CardStats registration={r} stats={stats} viewer={viewer} broken={broken} /> : null}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/** The angler's profile (signed out: sign-in, then the profile — it is not public), or null while the web has none. */
function profileHref(documentId: string, viewer: PageViewer): string | null {
  const href = anglerHref(documentId);
  if (!href) return null;
  return viewer === null ? signInHref(href) : href;
}

/** A photo URL, or none when it failed to load (useBrokenImages): the initials instead. */
const photo = (src: string | null | undefined, broken: ReadonlySet<string>) => (src && !broken.has(src) ? src : undefined);

/**
 * fish renderAvatars: a guest's face, an angler's photo, a team's stacked faces. A team's faces sit
 * in a fixed 88px slot, so the names of a team list start on one line whatever the member count:
 * up to three faces, or two and «+N» (fish stacks up to four — the fourth would widen the slot).
 */
function CardAvatar({ registration: r, team, name, broken }: { registration: DetailRegistration; team: boolean; name: string; broken: ReadonlySet<string> }) {
  if (team) {
    const people = r.participants.map(p => ({ name: p.username, src: photo(p.avatar?.url, broken) }));
    const shown = people.length <= 3 ? people : people.slice(0, 2);
    return (
      <span className="flex w-22 shrink-0 items-center">
        {r.participants.length === 0 ? (
          <Avatar name={r.guestName || name} size={40} tone="neutral" />
        ) : (
          <FaceStack size={32} people={shown} overflow={people.length - shown.length} />
        )}
      </span>
    );
  }
  if (r.guestName && r.participants.length === 0) return <Avatar name={r.guestName} size={48} tone="neutral" />;
  const p = r.participants[0];
  return <Avatar name={p?.username ?? name} src={photo(p?.avatar?.url, broken)} size={48} />;
}

/** The opened card: the sign-in prompt, the stats of its angler(s), or the guest line. */
function CardStats({ registration: r, stats, viewer, broken }: { registration: DetailRegistration; stats: StatsAccess; viewer: PageViewer; broken: ReadonlySet<string> }) {
  if (stats.kind === 'signIn') {
    return (
      <div className="flex flex-col items-center gap-1 py-1 text-center">
        <p className="t-caption text-ink-2">Trebuie să fii autentificat pentru a vedea statisticile pescarilor.</p>
        <Link href={stats.href} className="inline-flex min-h-11 items-center rounded-control px-2 t-body-strong text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent">
          Intră în cont
        </Link>
      </div>
    );
  }
  if (stats.kind === 'failed') {
    return (
      <div role="alert" className="flex flex-col items-center gap-2 py-1 text-center">
        <p className="t-caption text-ink-2">Statisticile nu au putut fi încărcate.</p>
        <QueryRetry fetching={stats.retrying} failed onRetry={stats.retry} size="compact" />
      </div>
    );
  }
  if (r.participants.length <= 1) {
    const p = r.participants[0];
    // fish's guest line (parity c8), short and centred: the opened card stays compact.
    return p ? <StatsRow stats={stats} documentId={p.documentId} /> : <p className="mx-auto max-w-60 text-center t-caption text-balance text-ink-2">{GUEST_MESSAGE}</p>;
  }
  return (
    // One member per block, hairlines between: inside a block (name → stats, 8px) tighter than
    // between blocks (12 + 12px around the hairline).
    <ul className="flex flex-col divide-y divide-hairline">
      {r.participants.map(p => {
        const href = profileHref(p.documentId, viewer);
        const row = (
          <>
            <Avatar name={p.username} src={photo(p.avatar?.url, broken)} size={32} />
            <span className="min-w-0 flex-1 truncate t-body-strong text-ink">{p.username}</span>
            {href ? <ChevronRightIcon aria-hidden className="size-4 text-muted" /> : null}
          </>
        );
        return (
          <li key={p.documentId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            {href ? (
              <Link href={href} className="flex min-h-11 items-center gap-2.5 rounded-control hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent">
                {row}
              </Link>
            ) : (
              <p className="flex min-h-8 items-center gap-2.5">{row}</p>
            )}
            <StatsRow stats={stats} documentId={p.documentId} />
          </li>
        );
      })}
    </ul>
  );
}

type Icon = ComponentType<SVGProps<SVGSVGElement>>;

/** A stat: the T3 inset tile (DetailFacts `grid`: page grey, card radius, no shadow — never a card in the card). */
const TILE = 'flex min-w-0 items-center gap-2 rounded-card bg-page px-2.5 py-2';

/** fish statsSection: Capturi, CMMC («x kg», «–» when unknown), Concursuri. */
function StatsRow({ stats, documentId }: { stats: StatsAccess; documentId: string }) {
  if (stats.kind === 'pending') {
    return (
      <div aria-busy="true" className="grid grid-cols-3 gap-1.5">
        <span className="sr-only" role="status">
          Se încarcă statisticile…
        </span>
        {[0, 1, 2].map(i => (
          <span key={i} aria-hidden className={TILE}>
            <span className="size-5 shrink-0 animate-shimmer rounded-badge" />
            <span className="flex min-w-0 flex-1 flex-col">
              <Bone className="w-10 t-micro" />
              <Bone className="w-8 t-label" />
            </span>
          </span>
        ))}
      </div>
    );
  }
  if (stats.kind !== 'ok') return null;
  const s = stats.map[documentId];
  // fish: a missing entry reads as 0 catches / 0 competitions; CMMC «–» when unknown.
  const items: { label: string; value: string; Icon: Icon }[] = [
    { label: 'Capturi', value: String(s?.catches ?? 0), Icon: FishGlyph },
    { label: 'CMMC', value: s?.biggestCatchKg == null ? '–' : `${formatWeight(s.biggestCatchKg)} kg`, Icon: ArrowTrendingUpIcon },
    { label: 'Concursuri', value: String(s?.competitions ?? 0), Icon: TrophyIcon },
  ];
  return (
    <ul aria-label="Statistici" className="grid grid-cols-3 gap-1.5">
      {items.map(({ label, value, Icon }) => (
        <li key={label} className={TILE}>
          <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-badge bg-accent-tint text-accent-ink">
            <Icon className="size-3.5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="t-micro text-muted">{label}</span>
            <span className="truncate t-label text-ink tabular-nums">{value}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function FishGlyph(props: SVGProps<SVGSVGElement>) {
  return <FishIcon size={14} {...props} />;
}

/** The subtitle only echoes the name: the same text once case, diacritics, spacing and a letter or two are set aside. */
function echoes(subtitle: string, name: string): boolean {
  const norm = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('ro')
      .replace(/[^a-z0-9]+/g, '');
  const a = norm(subtitle);
  const b = norm(name);
  if (!a || !b) return false;
  if (a === b) return true;
  // A near-copy (a typo apart): at most 2 edits, and under a tenth of the text.
  return Math.abs(a.length - b.length) <= 2 && editDistance(a, b) <= Math.min(2, Math.floor(Math.max(a.length, b.length) / 10));
}

function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
