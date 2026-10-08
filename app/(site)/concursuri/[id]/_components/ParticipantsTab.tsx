'use client';

import { Suspense, useId, useMemo, useState, useSyncExternalStore, type ComponentType, type ReactNode, type SVGProps } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowTrendingUpIcon, ChevronDownIcon, ChevronRightIcon, InformationCircleIcon, TrophyIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  approvedParticipantIds,
  approvedRegistrationsByStand,
  formatCount,
  participantStatisticsBatchQuery,
  participantStatisticsState,
  registrationDisplayName,
  registrationTeamSubtitle,
  soloParticipant,
  type CompetitionWithMyStatus,
  type DetailRegistration,
} from '@/core/competitions';
import { allocatedParticipantsQuery } from '@/core/organizer';
import type { UserStatuteForCompetition } from '@/core/social';
import type { Transport } from '@/core/transport';
import { CardShell, Pill } from '@/components/cards';
import { formatWeight } from '@/components/ranking';
import { FishIcon } from '@/components/icons/brand';
import { listGridClass } from '@/components/templates/T1';
import { DetailBody, DetailSection, DetailSectionState } from '@/components/templates/T3';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { useBreakpoint } from '@/components/surfaces/useBreakpoint';
import { isUnknownViewer, useViewerState } from '../../../_shell/viewer-context';
import type { PageViewer } from './Follow';
import { echoes } from './names';
import { GUEST_MESSAGE, isGuest, profileHref, type Group, type StatsAccess } from './participantParts';
import { ParticipantsRoster, ParticipantsRosterBones, type StandText } from './ParticipantsRoster';
import { PersonPopover, usePersonPopover, usePersonPopoverEnabled } from './PersonPopover';
import { QueryRetry } from './QueryRetry';
import { PAGE_RETRY } from './retry-policy';
import { isNationalType, nationalStandLabel } from './stand';
import { sortedSectors } from './standOrder';
import { Bone } from './tabParts';
import { photo, useBrokenImages } from './brokenImages';
import { RegistrationsList } from './registrations/RegistrationsList';

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
 * The competition's author sees the organizer's registrations list instead, as in fish
 * (competition-page.participanti-organizator: registrations/RegistrationsList.tsx). Decided from the
 * core's author and the session the server streams with the page (ByViewer), inside the list's
 * Suspense boundary, so the right list is revealed at once (never one list swapped for the other).
 *
 * Profiles: fish opens a one-user card's angler profile from its header. The profile (/pescari) is
 * M2 on the web (anglerHref is null until then): every header toggles the card, as a multi-member
 * card does in fish; the profile link takes over the moment it ships.
 *
 * From 768 (owner rules 14, 17, 18) the list is a designed roster (ParticipantsRoster): one surface
 * per sector with the sector's colour as its accent, each entry its face(s), name(s), club, the stand
 * as a squad number and the headline stats inline (signed in). Signed out the same layout without
 * the stats, and one quiet sign-in hint above; the guest line once when nobody has a Bluvi account.
 * From 1024 pressing an entry opens the person's popover anchored to it (PersonPopover: faces, club,
 * sector and stand, stats, «Vezi profilul» once the profile is on the web); 768–1023 the entries are
 * plain rows (everything the popover would add is already inline). The phone keeps fish's list (by stand, cards that open on
 * their stats). Until the width is known (server render, hydration) both are drawn and CSS shows the
 * right one, so nothing moves.
 *
 * From 768 the sectors run by name (standOrder.ts), as Cântare's table lists them, and on a national
 * championship a stand is named as Cântare and the ranking name it («A3(12)»: the sector's letter,
 * the draw position read from the allocation, the stand in brackets; «A12» until it is read). The
 * phone keeps fish's corner tag «Stand 12».
 */

/** The kit grid (T1, 340px cards) — the phone's rows edge to edge, 8px apart. */
const GRID = cn(listGridClass('lg'), 'items-start max-md:-mx-4 max-md:gap-2');

const noSubscribe = () => () => {};

type Props = {
  t: Transport;
  competition: CompetitionWithMyStatus;
  viewer: PageViewer;
  statute: UserStatuteForCompetition | undefined;
  signIn: string;
  /** The competition in the Bluvi app (unused here since the organizer's list is on the web). */
  appHref: string;
};

export function ParticipantsTab({ t, competition, viewer, statute, signIn }: Props) {
  const id = competition.documentId;
  const isAuthenticated = !!viewer;
  const registrations = useMemo(() => approvedRegistrationsByStand(competition.registrations), [competition.registrations]);
  const ids = useMemo(() => approvedParticipantIds(competition.registrations), [competition.registrations]);
  const statsQ = useQuery({ ...participantStatisticsBatchQuery(t, id, ids, { isAuthenticated }), ...PAGE_RETRY });
  const stats = participantStatisticsState(statsQ, ids, { isAuthenticated });
  const team = competition.competitionType === 'team';
  const [listRef, broken] = useBrokenImages<HTMLDivElement>();
  // The width, once the client knows it (the server render and hydration draw both lists).
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const breakpoint = useBreakpoint();
  const showPhone = !hydrated || breakpoint === 'mobile';
  const showRoster = !hydrated || breakpoint !== 'mobile';
  const person = usePersonPopover();
  // Owner rule 17: the popover from 1024 only; 768–1023 the roster's rows are plain (stats inline).
  const popoverOn = usePersonPopoverEnabled();
  const groups = useMemo(() => sectorGroups(registrations, competition.sectors), [registrations, competition.sectors]);
  // NC from 768: the stands as Cântare names them (the draw position is the allocation's).
  const isNc = isNationalType(competition.rankingType);
  const allocatedQ = useQuery({
    ...allocatedParticipantsQuery(t, id),
    ...PAGE_RETRY,
    enabled: isNc && hydrated && breakpoint !== 'mobile' && registrations.length > 0,
  });
  const draws = allocatedQ.data;
  const sectorOfStand = useMemo(() => {
    const m = new Map<string, string>();
    for (const sector of competition.sectors) for (const stand of sector.stands) m.set(stand.documentId, sector.name);
    return m;
  }, [competition.sectors]);
  const sectorName = (r: DetailRegistration) => (r.stand ? (sectorOfStand.get(r.stand.documentId) ?? null) : null);
  const standText: StandText = r => {
    if (!r.stand?.name) return null;
    if (!isNc) return r.stand.name;
    return nationalStandLabel(sectorOfStand.get(r.stand.documentId), draws?.[r.stand.documentId]?.sectorDrawPosition, r.stand.name);
  };

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
  // Nobody with a Bluvi account: no stats to show anywhere — said once above the list (from 768).
  const allGuests = registrations.length > 0 && registrations.every(isGuest);
  const mixed = !allGuests && registrations.some(isGuest);

  return (
    <DetailBody>
      {/* The notice and the list are revealed together, once the session the server streams has
          answered (the list's bones until then): the notice never pushes painted cards down. */}
      <Suspense fallback={<ParticipantsBones />}>
        <ByViewer competition={competition} statute={statute} organizer={<RegistrationsList t={t} competition={competition} />}>
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
            description={team ? formatCount(registrations.length, 'echipă aprobată', 'echipe aprobate') : formatCount(registrations.length, 'participant aprobat', 'participanți aprobați')}
          >
            <div ref={listRef}>
              {showPhone ? (
                <ul className={cn(GRID, showRoster && 'md:hidden')}>
                  {registrations.map(r => (
                    <li key={r.documentId}>
                      <ParticipantCard registration={r} team={team} stats={stats$} viewer={viewer} broken={broken} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {showRoster ? (
                <div className={cn('flex flex-col gap-4', showPhone && 'max-md:hidden')}>
                  {stats$.kind === 'signIn' ? (
                    // Signed out: the same roster without the stats, said once and quietly.
                    <p className="flex items-start gap-1.5 t-caption text-muted">
                      <InformationCircleIcon aria-hidden className="mt-px size-4 shrink-0" />
                      <span>
                        Statisticile pescarilor se văd după ce{' '}
                        <Link href={stats$.href} className="rounded-control t-label text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent">
                          intri în cont
                        </Link>
                        .
                      </span>
                    </p>
                  ) : allGuests ? (
                    <p className="t-caption text-muted">{GUEST_MESSAGE}</p>
                  ) : stats$.kind === 'failed' ? (
                    <div role="alert" className="flex flex-wrap items-center gap-3">
                      <p className="t-body text-ink-2">Statisticile nu au putut fi încărcate.</p>
                      <QueryRetry fetching={stats$.retrying} failed onRetry={stats$.retry} size="compact" />
                    </div>
                  ) : null}
                  <ParticipantsRoster
                    groups={groups}
                    team={team}
                    stats={stats$}
                    broken={broken}
                    mixed={mixed}
                    standText={standText}
                    sectorOf={sectorName}
                    openId={person.target?.registrationId ?? null}
                    // The popover names the stand «Sector A · Stand 12»; NC as the roster does («A3(12)»).
                    onOpen={popoverOn ? (rid, el, stand) => person.open(rid, el, isNc ? stand : null) : null}
                  />
                  <PersonPopover t={t} competition={competition} signedIn={viewer === undefined ? undefined : !!viewer} target={popoverOn ? person.target : null} onClose={person.close} />
                </div>
              ) : null}
            </div>
          </DetailSection>
        )}
        </ByViewer>
      </Suspense>
    </DetailBody>
  );
}

/**
 * The list's bones — its section header and six cards on the same grid, from 768 the roster's
 * (also the tab's skeleton: CompetitionSkeleton TabBones), so nothing moves when the list lands.
 */
export function ParticipantsBones() {
  return (
    <div aria-hidden className="px-4 py-3 md:p-0">
      <span className="mb-3 flex flex-col gap-0.5 md:mb-4">
        <Bone className="w-48 t-title2" />
        <Bone className="w-32 t-caption" />
      </span>
      <span className="hidden md:block">
        <ParticipantsRosterBones />
      </span>
      <span className={cn(GRID, 'md:hidden')}>
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
 * Who sees what (fish CompetitionParticipants.tsx:90-92): the competition's author gets the
 * organizer's registrations list (competition-page.participanti-organizator), everyone else the
 * approved list. Decided from data present at the first paint — the core's author and the session
 * read the server streams (useViewerState); the statute only for a core without its author. An
 * unknown session, or an author-less core whose statute has not answered, shows the bones (owner
 * rule 4: never a guess).
 */
function ByViewer({ competition, statute, organizer, children }: { competition: CompetitionWithMyStatus; statute: UserStatuteForCompetition | undefined; organizer: ReactNode; children: ReactNode }) {
  const state = useViewerState();
  if (isUnknownViewer(state)) return <ParticipantsBones />;
  if (!state) return children;
  if (competition.author) return competition.author.documentId === state.documentId ? organizer : children;
  if (statute === undefined) return <ParticipantsBones />;
  return statute.userRole === 'author' ? organizer : children;
}

// pr-18: the right 72px are the chevron's column and the corner tag's width («Stand 12»,
// «Nealocat»), so a two-line name never runs under the tag.
const HEADER = 'flex min-h-20 w-full items-center gap-3 py-3 pr-18 pl-4 text-left';
const FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/**
 * The wide list's groups: unallocated first, then each sector by name (standOrder.ts; a stand
 * no sector lists: «Alte standuri», last). One untitled group when grouping says nothing — a single
 * sector, or fewer than two cards per sector on average.
 */
function sectorGroups(registrations: DetailRegistration[], sectors: CompetitionWithMyStatus['sectors']): Group[] {
  const sectorOf = new Map<string, string>();
  for (const sector of sectors) for (const stand of sector.stands) sectorOf.set(stand.documentId, sector.name);
  const unallocated = registrations.filter(r => !r.stand);
  const other = registrations.filter(r => r.stand && !sectorOf.has(r.stand.documentId));
  const bySector = sortedSectors(sectors)
    .map(sector => ({
      key: sector.documentId,
      title: `Sector ${sector.name}`,
      sector: sector.name,
      registrations: registrations.filter(r => r.stand && sectorOf.get(r.stand.documentId) === sector.name),
    }))
    .filter(g => g.registrations.length > 0);
  if (bySector.length <= 1 || registrations.length < bySector.length * 2) {
    return [{ key: 'toti', title: null, sector: null, registrations }];
  }
  return [
    ...(unallocated.length ? [{ key: 'nealocati', title: 'Nealocați', sector: null, registrations: unallocated }] : []),
    ...bySector,
    ...(other.length ? [{ key: 'alte', title: 'Alte standuri', sector: null, registrations: other }] : []),
  ];
}

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
  // The unit apart from the number, smaller and muted (owner rule 10).
  const items: { label: string; value: string; unit?: string; Icon: Icon }[] = [
    { label: 'Capturi', value: String(s?.catches ?? 0), Icon: FishGlyph },
    { label: 'CMMC', value: s?.biggestCatchKg == null ? '–' : formatWeight(s.biggestCatchKg), unit: s?.biggestCatchKg == null ? undefined : 'kg', Icon: ArrowTrendingUpIcon },
    { label: 'Concursuri', value: String(s?.competitions ?? 0), Icon: TrophyIcon },
  ];
  return (
    <ul aria-label="Statistici" className="grid grid-cols-3 gap-1.5">
      {items.map(({ label, value, unit, Icon }) => (
        <li key={label} className={TILE}>
          <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-badge bg-accent-tint text-accent-ink">
            <Icon className="size-3.5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="t-micro text-muted">{label}</span>
            <span className="truncate t-label text-ink tabular-nums">
              {value}
              {unit ? <span className="t-micro text-muted"> {unit}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function FishGlyph(props: SVGProps<SVGSVGElement>) {
  return <FishIcon size={14} {...props} />;
}
