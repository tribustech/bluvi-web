'use client';

import Link from 'next/link';
import { registrationDisplayName, registrationTeamSubtitle, soloParticipant, type CompetitionWithMyStatus, type DetailRegistration } from '@/core/competitions';
import { Pill } from '@/components/cards';
import { formatWeight } from '@/components/ranking';
import { sectorFill } from '@/components/ranking/sector';
import { RANKING_HEAD } from '@/components/ranking/tableHead';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { PageViewer } from './Follow';
import { echoes } from './names';
import { isGuest, profileHref, type Group, type StatsAccess } from './participantParts';
import { Bone } from './tabParts';
import { photo } from './brokenImages';

/*
 * Participanți from 1280 (owner rule 14): not cards on a grid but rows, one per registration, the
 * stats inline in their own right-aligned columns — Stand | Pescar (face, name) | Capturi | CMMC |
 * Concursuri — under the ranking tables' coloured header (rule 12). A team of Bluvi users is its row
 * (the faces, the team name) and one row per member under it with that member's stats. The stats
 * columns are there only when stats can be shown (signed in, read, and someone has an account);
 * otherwise the list says why once above (ParticipantsTab). A registration typed in by the organizer
 * carries the «Adăugat manual» chip instead of stats. Sector rows as the Cântare table: only when a
 * sector holds two registrations or more on average (sectorGroups); the stand cell carries the
 * sector's stripe either way.
 *
 * Without the stats columns (signed out, the stats failed, or nobody has an account — every feeder
 * or NC test list of guests) a two-column table would be the phone list stretched across the page:
 * the registrations are then compact rows on a grid (ParticipantsGrid — stand chip, face, name, the
 * members), several per line, under the same sector headings as the 768 cards.
 *
 * Stand labels: `standText` (ParticipantsTab) — on a national championship «A3(12)», as Cântare and
 * the ranking name them, so a stand reads the same in every wide view.
 */

const CELL = 'border-t border-hairline px-3';

/** A registration's stand as the page names it («12», NC «A3(12)»); null: not allocated. */
export type StandText = (r: DetailRegistration) => string | null;
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent';

export function ParticipantsTable({
  groups,
  sectors,
  team,
  stats,
  withStats,
  viewer,
  broken,
  standText,
}: {
  groups: Group[];
  sectors: CompetitionWithMyStatus['sectors'];
  team: boolean;
  stats: StatsAccess;
  /** The stats columns (signed in, not failed, someone with an account). */
  withStats: boolean;
  viewer: PageViewer;
  broken: ReadonlySet<string>;
  standText: StandText;
}) {
  const sectorOf = new Map<string, string>();
  for (const sector of sectors) for (const stand of sector.stands) sectorOf.set(stand.documentId, sector.name);
  const mixed = groups.some(g => g.registrations.some(isGuest)) && groups.some(g => g.registrations.some(r => !isGuest(r)));
  if (!withStats) return <ParticipantsGrid groups={groups} sectorOf={sectorOf} team={team} mixed={mixed} viewer={viewer} broken={broken} standText={standText} />;
  const columns = 5;
  return (
    <div data-participants className="overflow-x-auto rounded-card bg-surface shadow-e0 [scrollbar-width:thin]">
      <table className="w-full table-fixed border-separate border-spacing-0 text-left tabular-nums">
        <caption className="sr-only">{team ? 'Echipele înscrise, pe standuri' : 'Participanții înscriși, pe standuri'}</caption>
        <colgroup>
          <col className="w-28" />
          <col />
          <col className="w-28" />
          <col className="w-36" />
          <col className="w-32" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className={cn('h-10 rounded-tl-card px-3 pl-[18px] t-label whitespace-nowrap', RANKING_HEAD)}>
              Stand
            </th>
            <th scope="col" className={cn('h-10 px-3 t-label whitespace-nowrap', RANKING_HEAD)}>
              {team ? 'Echipă' : 'Pescar'}
            </th>
            {['Capturi', 'CMMC', 'Concursuri'].map((label, i) => (
              <th key={label} scope="col" className={cn('h-10 px-3 text-right t-label whitespace-nowrap', RANKING_HEAD, i === 2 && 'rounded-tr-card pr-4')}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map(group => (
          <tbody key={group.key}>
            {group.title ? (
              <tr>
                <th colSpan={columns} scope="colgroup" className="h-9 border-t border-hairline bg-soft-fill px-4 text-left">
                  <span className="flex items-center gap-2 t-label text-ink">
                    {group.sector ? <SectorDot name={group.sector} /> : null}
                    {group.title}
                    <span className="font-normal text-muted">· {group.registrations.length}</span>
                  </span>
                </th>
              </tr>
            ) : null}
            {group.registrations.map(r => (
              <RegistrationRows key={r.documentId} registration={r} sector={r.stand ? (sectorOf.get(r.stand.documentId) ?? null) : null} team={team} stats={stats} mixed={mixed} viewer={viewer} broken={broken} standText={standText} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function SectorDot({ name }: { name: string }) {
  const fill = sectorFill(name, 'var(--color-accent)');
  return <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />;
}

function RegistrationRows({
  registration: r,
  sector,
  team,
  stats,
  mixed,
  viewer,
  broken,
  standText,
}: {
  registration: DetailRegistration;
  sector: string | null;
  team: boolean;
  stats: StatsAccess;
  mixed: boolean;
  viewer: PageViewer;
  broken: ReadonlySet<string>;
  standText: StandText;
}) {
  const type = team ? 'team' : 'single';
  const name = registrationDisplayName(r, type);
  const rawSubtitle = registrationTeamSubtitle(r, type);
  const subtitle = rawSubtitle && !echoes(rawSubtitle, name) ? rawSubtitle : null;
  const guest = isGuest(r);
  const solo = soloParticipant(r);
  // A team of several accounts: its row, then one row per member with their stats.
  const members = r.participants.length > 1 ? r.participants : [];
  const chip = mixed && guest ? <Pill tone="neutral">Adăugat manual</Pill> : null;
  const profile = solo ? profileHref(solo.documentId, viewer) : null;

  const avatar = <RegistrationAvatar registration={r} team={team} name={name} broken={broken} />;

  return (
    <>
      <tr data-registration={r.documentId}>
        <StandCell label={standText(r)} sector={sector} rowSpan={members.length ? members.length + 1 : undefined} />
        <td colSpan={members.length || guest ? 4 : undefined} className={cn(CELL, 'h-16 py-2 align-middle')}>
          <span className="flex min-w-0 items-center gap-3">
            {avatar}
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-2">
                {profile ? (
                  <Link href={profile} className={cn('truncate rounded-control t-body-strong text-ink hover:underline', FOCUS)}>
                    {name}
                  </Link>
                ) : (
                  <span title={name} className="truncate t-body-strong text-ink">
                    {name}
                  </span>
                )}
                {chip}
              </span>
              {/* With the members' rows under it, the team's members line would say them twice. */}
              {subtitle && !members.length ? (
                <span title={subtitle} className="truncate t-caption text-muted">
                  {subtitle}
                </span>
              ) : null}
            </span>
          </span>
        </td>
        {!members.length && !guest ? <StatCells stats={stats} documentId={r.participants[0]?.documentId ?? ''} /> : null}
      </tr>
      {members.map(p => {
        const href = profileHref(p.documentId, viewer);
        return (
          <tr key={p.documentId}>
            <td className={cn(CELL, 'h-12 py-1.5 pl-8 align-middle')}>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={p.username} src={photo(p.avatar?.url, broken)} size={24} />
                {href ? (
                  <Link href={href} className={cn('truncate rounded-control t-body text-ink hover:underline', FOCUS)}>
                    {p.username}
                  </Link>
                ) : (
                  <span className="truncate t-body text-ink">{p.username}</span>
                )}
              </span>
            </td>
            <StatCells stats={stats} documentId={p.documentId} />
          </tr>
        );
      })}
    </>
  );
}

/** The face(s): a guest's initials on the neutral tone, an account's photo, a team's stack (up to 3). */
function RegistrationAvatar({ registration: r, team, name, broken }: { registration: DetailRegistration; team: boolean; name: string; broken: ReadonlySet<string> }) {
  if (team && r.participants.length > 0) {
    return <FaceStack size={32} people={r.participants.slice(0, 3).map(p => ({ name: p.username, src: photo(p.avatar?.url, broken) }))} overflow={Math.max(0, r.participants.length - 3)} />;
  }
  if (r.participants.length === 0) return <Avatar name={r.guestName || name} size={40} tone="neutral" />;
  return <Avatar name={r.participants[0]?.username ?? name} src={photo(r.participants[0]?.avatar?.url, broken)} size={40} />;
}

/** «12» (NC «A3(12)»), the sector's stripe on the edge; «Nealocat» in red. */
function StandCell({ label, sector, rowSpan }: { label: string | null; sector: string | null; rowSpan?: number }) {
  const fill = sector ? sectorFill(sector, 'var(--color-accent)') : null;
  return (
    <th scope="row" rowSpan={rowSpan} className={cn(CELL, 'relative pl-[18px] text-left align-top whitespace-nowrap')}>
      {fill ? <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} /> : null}
      <span className="flex h-16 items-center">
        {label ? (
          <span className="t-num-18 text-ink">
            {sector ? <span className="sr-only">Sector {sector}, </span> : null}
            <span className="sr-only">Stand </span>
            {label}
          </span>
        ) : (
          <Pill tone="danger">Nealocat</Pill>
        )}
      </span>
    </th>
  );
}

/** fish statsSection, as columns: Capturi, CMMC («x kg», the unit apart — rule 10; «–» when unknown), Concursuri. */
function StatCells({ stats, documentId }: { stats: StatsAccess; documentId: string }) {
  const cell = cn(CELL, 'py-2 text-right align-middle whitespace-nowrap');
  if (stats.kind !== 'ok') {
    return [0, 1, 2].map(i => (
      <td key={i} className={cn(cell, i === 2 && 'pr-4')}>
        <Bone className="ms-auto w-10 t-body" />
      </td>
    ));
  }
  const s = stats.map[documentId];
  const cmmc = s?.biggestCatchKg == null ? null : formatWeight(s.biggestCatchKg);
  return (
    <>
      <td className={cell}>
        <span className="t-body-strong text-ink">{s?.catches ?? 0}</span>
      </td>
      <td className={cell}>
        {cmmc ? (
          <span className="inline-flex items-baseline gap-1">
            <span className="t-body-strong text-ink">{cmmc}</span>
            <span className="t-caption text-muted">kg</span>
          </span>
        ) : (
          <span className="t-body text-muted">–</span>
        )}
      </td>
      <td className={cn(cell, 'pr-4')}>
        <span className="t-body-strong text-ink">{s?.competitions ?? 0}</span>
      </td>
    </>
  );
}

/** The table's bones (the tab's skeleton from 1280): the header band and six rows. */
export function ParticipantsTableBones() {
  return (
    <span className="flex flex-col overflow-hidden rounded-card bg-surface shadow-e0">
      <span className={cn('h-10', RANKING_HEAD)} />
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} data-bone="row" className="flex h-16 items-center gap-6 border-t border-hairline px-4">
          <Bone className="w-10 t-num-18" />
          <span className="size-10 shrink-0 animate-shimmer rounded-full" />
          <Bone className="w-48 t-body-strong" />
        </span>
      ))}
    </span>
  );
}

/**
 * The list without stats columns (owner rule 14: not the phone list stretched): compact rows on an
 * auto-fill grid — several per line, more as the screen grows — under the sector headings. Each row:
 * the stand chip (the sector's stripe), the face(s), the name (a profile link once the web has one)
 * and a team's members; «Adăugat manual» on a guest in a mixed list.
 */
function ParticipantsGrid({
  groups,
  sectorOf,
  team,
  mixed,
  viewer,
  broken,
  standText,
}: {
  groups: Group[];
  sectorOf: Map<string, string>;
  team: boolean;
  mixed: boolean;
  viewer: PageViewer;
  broken: ReadonlySet<string>;
  standText: StandText;
}) {
  const list = (registrations: DetailRegistration[], label: string) => (
    <ul aria-label={label} className="grid grid-cols-[repeat(auto-fill,minmax(--spacing(88),1fr))] gap-2">
      {registrations.map(r => (
        <li key={r.documentId} data-registration={r.documentId} className="min-w-0">
          <GridRow registration={r} sector={r.stand ? (sectorOf.get(r.stand.documentId) ?? null) : null} team={team} mixed={mixed} viewer={viewer} broken={broken} label={standText(r)} />
        </li>
      ))}
    </ul>
  );
  const all = team ? 'Echipele înscrise, pe standuri' : 'Participanții înscriși, pe standuri';
  return (
    <div data-participants className="flex flex-col gap-6">
      {groups.map(group =>
        group.title ? (
          <section key={group.key} aria-labelledby={`participanti-grila-${group.key}`} className="flex flex-col gap-3">
            <h3 id={`participanti-grila-${group.key}`} className="flex items-center gap-2 t-heading">
              {group.sector ? <SectorDot name={group.sector} /> : null}
              {group.title}
              <span className="t-caption text-muted">· {group.registrations.length}</span>
            </h3>
            {list(group.registrations, group.title)}
          </section>
        ) : (
          <div key={group.key}>{list(group.registrations, all)}</div>
        ),
      )}
    </div>
  );
}

function GridRow({
  registration: r,
  sector,
  team,
  mixed,
  viewer,
  broken,
  label,
}: {
  registration: DetailRegistration;
  sector: string | null;
  team: boolean;
  mixed: boolean;
  viewer: PageViewer;
  broken: ReadonlySet<string>;
  label: string | null;
}) {
  const type = team ? 'team' : 'single';
  const name = registrationDisplayName(r, type);
  const rawSubtitle = registrationTeamSubtitle(r, type);
  const subtitle = rawSubtitle && !echoes(rawSubtitle, name) ? rawSubtitle : null;
  const solo = soloParticipant(r);
  const profile = solo ? profileHref(solo.documentId, viewer) : null;
  const fill = sector ? sectorFill(sector, 'var(--color-accent)') : null;
  return (
    <div className="relative flex h-full min-h-16 items-center gap-3 overflow-hidden rounded-card bg-surface py-2.5 pr-3 pl-4 shadow-e0">
      {fill ? <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} /> : null}
      {label ? (
        <span className="flex h-9 min-w-11 shrink-0 items-center justify-center rounded-control bg-soft-fill px-2 t-num-18 text-ink">
          {sector ? <span className="sr-only">Sector {sector}, </span> : null}
          <span className="sr-only">Stand </span>
          {label}
        </span>
      ) : (
        <Pill tone="danger" className="shrink-0">
          Nealocat
        </Pill>
      )}
      <RegistrationAvatar registration={r} team={team} name={name} broken={broken} />
      <span className="flex min-w-0 flex-1 flex-col">
        {profile ? (
          <Link href={profile} className={cn('truncate rounded-control t-body-strong text-ink hover:underline', FOCUS)}>
            {name}
          </Link>
        ) : (
          <span title={name} className="truncate t-body-strong text-ink">
            {name}
          </span>
        )}
        {subtitle ? (
          <span title={subtitle} className="truncate t-caption text-muted">
            {subtitle}
          </span>
        ) : null}
        {mixed && isGuest(r) ? (
          <Pill tone="neutral" className="mt-0.5 self-start">
            Adăugat manual
          </Pill>
        ) : null}
      </span>
    </div>
  );
}
