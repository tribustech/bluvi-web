import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { ChartBarIcon, ClipboardDocumentListIcon, ScaleIcon, Squares2X2Icon, TicketIcon, UsersIcon } from '@heroicons/react/24/outline';
// The 20/solid presence set for small inline glyphs (Fundații: outline only at 24).
import { EyeIcon, MapPinIcon } from '@heroicons/react/20/solid';
import { formatInt, plural } from '@/components/cards/format';
import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import { sectorFill } from '@/components/ranking/sector';
import { EmptyState, ErrorState } from '@/components/surfaces/StateCard';
import {
  DetailActionBar,
  DetailAsideCard,
  DetailBackButton,
  DetailBand,
  DetailBody,
  DetailFacts,
  DetailHeader,
  DetailPage,
  DetailRetry,
  DetailSection,
  DetailShareButton,
  DetailTabs,
  PRESENCE_ICON,
  type DetailFact,
} from '@/components/templates/T3';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import type { DetailRegistration } from '@/core/competitions';
import { routes } from '@/lib/routes';
import { competitionDateProse } from '../../../(site)/concursuri/[id]/_components/dates';
import type { LooseCompetitionDetail as CompetitionDetail } from '../../../(site)/concursuri/[id]/_components/load';
import type { Settled } from './data';
import type { DemoViewer } from './DemoTopBar';
import { demoHref, LONG_TITLE, type DemoState } from './states';

/*
 * The route-tabs variant of T3, extracted from the competition page (fish
 * competitions/[competitionId].tsx: CompetitionHeader + ROUTES_LIST), shown on its «Participanți»
 * tab with a real completed Chita competition:
 *  - phone: the app's centred header (back, title, organiser, lake, pills, share), the tab strip,
 *    the content on white, the fixed action bar;
 *  - ≥768: thumbnail + title + one dotted meta line + header actions;
 *  - ≥1280: left = context the header does not show (how full the competition is, the sectors),
 *    centre = the participants table, right = the details; both side columns stick beside the
 *    long list. Below 1280 the fill («20 / 20 locuri») sits in the participants heading.
 *
 * The participants read is Settled: when it fails («Eroare secțiune») everything derived from it —
 * the tab count, the «N înscrieri» line, the fill numbers and meter, the per-sector counts —
 * disappears with it. Cancelled and draft competitions have no badge row on the phone (parity
 * competition-page.shell.c4: the action bar says «Anulat»); from 768, where that bar is gone, the
 * header shows the status pill instead. They have no Clasament CTA and no Clasament tab link
 * (there is no ranking).
 *
 * The session (`viewer`, a promise) is never awaited by the page: only the parts that depend on it
 * — the viewer's own row in the list, the action bar's «Intră» — wait for it, behind Suspense.
 */

/** `?state=mine` without a signed-in viewer: the registration the demo marks as the viewer's. */
const DEMO_ME = 'demo-tu';

/** `viewer`: signed in, null (known signed out), or 'unknown' (the session read timed out). */
type Props = { competition: CompetitionDetail; state: DemoState; viewer: Promise<DemoViewer>; signIn: string };

const STATUS: Record<CompetitionDetail['competitionStatus'], { label: string; tone: StatusTone }> = {
  started: { label: 'Live', tone: 'live' },
  notStarted: { label: 'Viitor', tone: 'info' },
  completed: { label: 'Încheiat', tone: 'neutral' },
  cancelled: { label: 'Anulat', tone: 'cancelled' },
  draft: { label: 'Ciornă', tone: 'neutral' },
};

/** fish helpers/getRankingType.ts (as in the competition page's Preview). */
function rankingTypeLabel(c: CompetitionDetail): string {
  switch (c.rankingType) {
    case 'quality':
      return 'Calitate';
    case 'quantity':
      return 'Cantitate';
    case 'quantityQuality':
      return 'Cantitate/Calitate';
    case 'qualityQuantity':
      return 'Calitate/Cantitate';
    case 'bestOf':
      return `Best of ${c.bestOfFishCount || ''}`;
    case 'nationalChampionship':
      return 'Campionat Național';
    case 'fipsed':
      return 'Campionat Mondial FIPSed';
    case 'calitateCalitate':
      return 'Calitate/Calitate';
    case 'calitateCantitateCMMC':
      return 'Cal/Cant/CMMC';
    case 'feederRounds':
      return 'Feeder';
    case 'bestOfTiers':
      return c.bestOfTierSizes?.length ? `Best of ${c.bestOfTierSizes.join(', ')}` : 'Best of x, y, z...';
    default:
      return '';
  }
}

/**
 * `?state=mine`: the viewer joins the confirmed registration that leads the list (the list's first
 * row), so the «mine» row shows. Signed out (or session unknown), a demo person stands in.
 */
function withMe(rows: DetailRegistration[], me: { documentId: string; username: string } | null): DetailRegistration[] {
  if (!rows.length) return rows;
  const you = { id: 0, documentId: me?.documentId ?? DEMO_ME, username: me?.username ?? 'Tu', avatar: null };
  const [first, ...rest] = rows;
  return first.participants.some(p => p.documentId === you.documentId) ? rows : [{ ...first, participants: [...first.participants, you] }, ...rest];
}

function shape(c: CompetitionDetail, state: DemoState): CompetitionDetail {
  switch (state) {
    case 'draft':
      return { ...c, competitionStatus: 'draft' };
    case 'empty':
      return { ...c, registrations: [], viewers: 0 };
    case 'long-title':
      return { ...c, name: LONG_TITLE };
    case 'live':
      return { ...c, competitionStatus: 'started', viewers: Math.max(c.viewers, 12) };
    case 'upcoming':
      return { ...c, competitionStatus: 'notStarted' };
    case 'cancelled':
      return { ...c, competitionStatus: 'cancelled' };
    case 'viewers-1':
      return { ...c, viewers: 1 };
    default:
      return c;
  }
}

/** fish: a team is its team name, else its club, else «–» (the members are its subtitle); an angler is their name. */
const registrationName = (r: DetailRegistration, team: boolean) =>
  team
    ? r.teamName || r.club?.name || '–'
    : r.teamName || r.guestName || r.participants.map(p => p.username).join(', ') || r.author?.username || 'Participant';

/** Stand order, unallocated first (fish: a registration with no stand leads the list). */
const standOrder = (r: DetailRegistration) => (r.stand ? Number(r.stand.name) : -1);

export function CompetitionScreen({ competition: raw, state, viewer, signIn }: Props) {
  const c = shape(raw, state);
  const status = STATUS[c.competitionStatus];
  const registered = c.registrations
    .filter(r => r.registrationStatus === 'registered')
    .sort((a, b) => standOrder(a) - standOrder(b));
  const participants: Settled<DetailRegistration[]> = state === 'section-error' ? { ok: false } : { ok: true, value: registered };
  const count = participants.ok ? participants.value.length : null;
  // No ranking for a cancelled or draft competition: no Clasament CTA, no badge row (parity shell.c4).
  const ranked = c.competitionStatus !== 'cancelled' && c.competitionStatus !== 'draft';
  // Stand → sector letter, for the sector stripe on each participant row.
  const sectorOf = new Map(c.sectors.flatMap(s => s.stands.map(st => [st.documentId, s.name] as const)));
  // One sentence-case date everywhere on the page (header meta, action bar): «6–8 octombrie 2026».
  // An end before the start (seeded / edited data: the local completed ones start 5 Oct, end 4 Oct)
  // would print a backwards range: then the start day alone.
  const endIso = Date.parse(c.endDate) < Date.parse(c.startDate) ? c.startDate : c.endDate;
  const datesProse = competitionDateProse(c.startDate, endIso);
  const thumb = c.banner?.formats.small?.url ?? c.banner?.formats.medium?.url ?? c.banner?.url ?? '/images/competition-placeholder.jpg';
  const shareText = `Intră în Bluvi să vezi competiția de pescuit ${c.name}${c.lake?.name ? ` de pe balta ${c.lake.name}` : ''}`;
  const lakeLink = c.lake ? (
    <Link key="lake" href={routes.lake(c.lake.documentId)} className="inline-flex items-center gap-1 font-bold text-accent-ink hover:underline">
      <MapPinIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'shrink-0 text-accent')} />
      {c.lake.name}
    </Link>
  ) : (
    <span key="lake">Nedefinit</span>
  );

  const facts: DetailFact[] = [
    { key: 'type', icon: <UsersIcon />, label: 'Participare', value: c.competitionType === 'single' ? 'Individual' : 'Echipe' },
    { key: 'ranking', icon: <ChartBarIcon />, label: 'Clasament', value: rankingTypeLabel(c) || '—' },
    { key: 'fee', icon: <TicketIcon />, label: 'Taxă', value: c.registerFee ? `${c.registerFee} lei` : 'Fără taxă' },
    { key: 'limit', icon: <ClipboardDocumentListIcon />, label: 'Locuri', value: c.participantsLimit ? formatInt(c.participantsLimit) : 'Nelimitat' },
    { key: 'sectors', icon: <Squares2X2Icon />, label: 'Sectoare', value: c.sectors.length ? formatInt(c.sectors.length) : '—' },
    { key: 'referees', icon: <ScaleIcon />, label: 'Arbitri', value: c.referees.length ? c.referees.map(r => r.username).join(', ') : '—' },
  ];

  return (
    <>
      <BreadcrumbBand trail={[{ label: 'Competiții', href: routes.competitions() }, { label: c.name }]} />
      <DetailPage phoneGround="surface">
        <DetailBand>
          <DetailHeader
            phoneAlign="center"
            title={c.name}
            titleId="concurs-titlu"
            media={
              // Remote CMS banner at thumbnail size: the image optimizer buys nothing here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt="" className="size-24 rounded-card bg-soft-fill object-cover" decoding="async" />
            }
            meta={[
              <span key="org">Organizat de {c.author?.username || 'Necunoscut'}</span>,
              lakeLink,
              datesProse ? (
                <span key="dates" className="max-md:hidden">
                  {datesProse}
                </span>
              ) : null,
            ]}
            badges={
              ranked ? (
                <>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                  {/* An attribute (how many follow it), not a state: a kit Badge, and nothing at 0. */}
                  {c.viewers > 0 ? (
                    <span className="flex">
                      <Badge color="gray" icon={<EyeIcon aria-hidden />}>
                        {plural(c.viewers, 'urmăritor', 'urmăritori')}
                      </Badge>
                    </span>
                  ) : null}
                </>
              ) : (
                <StatusPill tone={status.tone}>{status.label}</StatusPill>
              )
            }
            badgesFromMd={!ranked}
            actions={
              <>
                {/* The primary, as on the phone's action bar. 768–1279: the short label, so the cluster fits beside the title. */}
                {ranked ? (
                  <ButtonLink href={routes.competition(c.documentId)} icon={<ChartBarIcon />}>
                    <span className="xl:hidden">Clasament</span>
                    <span className="max-xl:hidden">Vezi clasamentul</span>
                  </ButtonLink>
                ) : null}
                <DetailShareButton look="button" title={c.name} text={shareText} />
              </>
            }
            phoneStart={<DetailBackButton fallbackHref={routes.competitions()} />}
            phoneEnd={<DetailShareButton title={c.name} text={shareText} label="Distribuie competiția" />}
          />
          {/* fish ROUTES_LIST. Clasament is the live web page; the others are not on the web yet. */}
          <DetailTabs
            label="Secțiunile concursului"
            tabs={[
              // No ranking for a cancelled or draft competition: the tab is not a link.
              ranked ? { label: 'Clasament', href: routes.competition(c.documentId) } : { label: 'Clasament', absent: 'fără clasament' },
              { label: 'Informații' },
              { label: 'Participanți', href: demoHref('competition', state), current: true, count: count ?? undefined },
              { label: 'Extra Cântare' },
              { label: 'Regulament' },
            ]}
          />
        </DetailBand>

        <DetailBody
          left={<CompetitionContext c={c} participants={participants} />}
          leftLabel="Înscrieri și sectoare"
          aside={
            <DetailAsideCard title="Detalii">
              <DetailFacts facts={facts} layout="list" />
            </DetailAsideCard>
          }
          asideLabel="Detaliile concursului"
          asideSticky
        >
          <DetailSection
            id="participanti"
            title="Participanți"
            description={count ? plural(count, 'înscriere confirmată', 'înscrieri confirmate') : undefined}
            action={count !== null && c.participantsLimit ? <FillCompact taken={count} limit={c.participantsLimit} /> : undefined}
          >
            {!participants.ok ? (
              <ErrorState title="Participanții nu au putut fi încărcați." action={<DetailRetry />} />
            ) : participants.value.length === 0 ? (
              // Parity competition-page.participanti.c4.
              <EmptyState title="Încă nu s-au înregistrat participanți pentru această competiție." />
            ) : (
              <>
                <SectorLegend sectors={c.sectors.map(s => s.name)} />
                {/* Until the session is known the list shows without the viewer's row marked (same rows, no shift). */}
                <Suspense
                  fallback={<Participants rows={state === 'mine' ? withMe(participants.value, null) : participants.value} team={c.competitionType === 'team'} myId={null} sectorOf={sectorOf} />}
                >
                  <ParticipantsForViewer
                    viewer={viewer}
                    mine={state === 'mine'}
                    rows={participants.value}
                    team={c.competitionType === 'team'}
                    sectorOf={sectorOf}
                  />
                </Suspense>
              </>
            )}
          </DetailSection>
        </DetailBody>

        <DetailActionBar
          label="Acțiuni concurs"
          summary={
            <span className="flex flex-col">
              <span className="truncate t-body-strong">{status.label}</span>
              <span className="truncate t-caption text-muted">{datesProse}</span>
            </span>
          }
        >
          {/* Sign-in only for a viewer known to be signed out (not when the session read timed out). */}
          <Suspense fallback={null}>
            <WhenSignedOut viewer={viewer}>
              <ButtonLink href={signIn} variant="secondary">
                Intră
              </ButtonLink>
            </WhenSignedOut>
          </Suspense>
          {ranked ? (
            <ButtonLink href={routes.competition(c.documentId)} icon={<ChartBarIcon />}>
              Clasament
            </ButtonLink>
          ) : null}
        </DetailActionBar>
      </DetailPage>
    </>
  );
}

/** `children` only for a viewer known to be signed out, once the session read answers. */
async function WhenSignedOut({ viewer, children }: { viewer: Promise<DemoViewer>; children: ReactNode }) {
  return (await viewer) === null ? children : null;
}

/** The participants with the viewer's own registration marked, once the session is known. */
async function ParticipantsForViewer({
  viewer: read,
  mine,
  rows,
  team,
  sectorOf,
}: {
  viewer: Promise<DemoViewer>;
  mine: boolean;
  rows: DetailRegistration[];
  team: boolean;
  sectorOf: Map<string, string>;
}) {
  const viewer = await read;
  const me = viewer && viewer !== 'unknown' ? viewer : null;
  const shown = mine ? withMe(rows, me) : rows;
  const myId = me?.documentId ?? (mine ? DEMO_ME : null);
  return <Participants rows={shown} team={team} myId={myId} sectorOf={sectorOf} />;
}

/**
 * Below 1280 (where the left column's «Sectoare» card is not rendered): what the rows' colour
 * stripes mean — one line of sector dots and letters above the list.
 */
function SectorLegend({ sectors }: { sectors: string[] }) {
  if (!sectors.length) return null;
  const sorted = [...sectors].sort((a, b) => a.localeCompare(b, 'ro', { numeric: true }));
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 t-label text-muted xl:hidden">
      <span>Sectoare</span>
      <ul aria-label="Culorile sectoarelor" className="flex flex-wrap items-center gap-3">
        {sorted.map(name => (
          <li key={name} className="flex items-center gap-1.5 text-ink">
            <SectorDot name={name} />
            <span>
              <span className="sr-only">Sector </span>
              {name}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * ≥1280 left column: what the header does not say — how full the competition is (fish
 * RegistrationProgress: «20/20 locuri») and how the anglers spread over the sectors.
 */
function CompetitionContext({ c, participants }: { c: CompetitionDetail; participants: Settled<DetailRegistration[]> }) {
  const limit = c.participantsLimit ?? 0;
  const registered = participants.ok ? participants.value : [];
  const full = limit > 0 && registered.length >= limit;
  const sectorOf = new Map(c.sectors.flatMap(s => s.stands.map(st => [st.documentId, s.name] as const)));
  const perSector = [...c.sectors]
    .sort((a, b) => a.name.localeCompare(b.name, 'ro', { numeric: true }))
    .map(s => ({
      name: s.name,
      stands: s.stands.length,
      taken: registered.filter(r => r.stand && sectorOf.get(r.stand.documentId) === s.name).length,
    }));
  return (
    <>
      <DetailAsideCard title="Înscrieri" as="h2">
        {!participants.ok ? (
          <p className="t-body text-muted">Indisponibil</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="flex items-baseline gap-1">
              <span className="t-stat">{formatInt(registered.length)}</span>
              <span className="t-body text-muted">{limit ? `/ ${plural(limit, 'loc', 'locuri')}` : plural(registered.length, 'înscriere', 'înscrieri')}</span>
            </p>
            {limit ? (
              <span
                role="meter"
                aria-label="Locuri ocupate"
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-valuenow={Math.min(registered.length, limit)}
                className="block h-1.5 overflow-hidden rounded-full bg-accent-tint"
              >
                <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (registered.length / limit) * 100)}%` }} />
              </span>
            ) : null}
            <p className="t-caption text-muted">
              {limit
                ? full
                  ? 'Toate locurile sunt ocupate.'
                  : `${plural(limit - registered.length, 'loc liber', 'locuri libere')}.`
                : 'Fără limită de locuri.'}
            </p>
          </div>
        )}
      </DetailAsideCard>
      {perSector.length ? (
        <DetailAsideCard title="Sectoare" as="h2">
          <ul className="flex flex-col">
            {perSector.map(s => (
              <li key={s.name} className="flex items-center gap-3 border-b border-hairline py-2.5 first:pt-0 last:border-b-0 last:pb-0">
                {/* The sector colour as Fundații allows it (as the ranking): a dot beside the letter, never under it. */}
                <span className="flex h-8 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-control bg-soft-fill px-2 t-body-strong">
                  <SectorDot name={s.name} />
                  {s.name}
                </span>
                <span className="min-w-0 flex-1 t-body text-ink-2">{plural(s.stands, 'stand', 'standuri')}</span>
                {participants.ok ? <span className="t-label text-muted tabular-nums">{plural(s.taken, 'înscris', 'înscriși')}</span> : null}
              </li>
            ))}
          </ul>
        </DetailAsideCard>
      ) : null}
    </>
  );
}

/**
 * Below 1280 (where the left column's Înscrieri card is not rendered): the fill in the participants
 * heading — the number on the stat step, «/ 20 locuri» in grey.
 */
function FillCompact({ taken, limit }: { taken: number; limit: number }) {
  return (
    <p className="flex items-baseline gap-1 xl:hidden">
      <span className="t-stat tabular-nums">{formatInt(taken)}</span>
      <span className="t-caption text-muted">/ {plural(limit, 'loc', 'locuri')}</span>
    </p>
  );
}

/** Phone: rows (stand, name, faces); from 768: a table that takes the centre's full width. */
function Participants({
  rows,
  team,
  myId,
  sectorOf,
}: {
  rows: DetailRegistration[];
  team: boolean;
  myId: string | null;
  /** Stand documentId → sector letter: the row's 4px sector stripe (RankingRow's). */
  sectorOf: Map<string, string>;
}) {
  const sector = (r: DetailRegistration) => (r.stand ? sectorOf.get(r.stand.documentId) : undefined);
  // Phone subtitle: a team's members (its name is the title), an angler's club.
  const subtitle = (r: DetailRegistration) => (team ? r.participants.map(p => p.username).join(', ') : r.club?.name) || null;
  // Columns with nothing in any row are left out (guests and named teams have no members, most
  // anglers no club): the table keeps only what it can show.
  const clubs = rows.some(r => r.club?.name);
  const members = team && rows.some(r => r.participants.length > 0);
  return (
    <>
      <ul className="-mx-4 flex flex-col md:hidden">
        {rows.map(r => {
          const mine = !!myId && r.participants.some(p => p.documentId === myId);
          return (
            <li
              key={r.documentId}
              className="relative flex items-center gap-3 border-b border-hairline px-4 py-3 last:border-b-0 data-mine:bg-accent-tint"
              data-mine={mine || undefined}
            >
              <SectorStripe name={sector(r)} />
              <StandChip name={r.stand?.name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate t-body-strong">{registrationName(r, team)}</span>
                  {mine ? <MineBadge /> : null}
                </span>
                {subtitle(r) ? <span className="truncate t-caption text-muted">{subtitle(r)}</span> : null}
              </span>
              <People r={r} />
            </li>
          );
        })}
      </ul>
      <div className="overflow-x-auto max-md:hidden">
        <table className="w-full t-table">
          <caption className="sr-only">Participanți înscriși, după stand</caption>
          <thead>
            <tr className="border-b border-hairline text-left t-label text-muted">
              <th scope="col" className="w-16 py-2.5 pr-3 pl-3 font-bold">
                Stand
              </th>
              <th scope="col" className="py-2.5 pr-3 font-bold">
                {team ? 'Echipă' : 'Pescar'}
              </th>
              {clubs ? (
                <th scope="col" className="py-2.5 pr-3 font-bold">
                  Club
                </th>
              ) : null}
              {members ? (
                <th scope="col" className="py-2.5 pr-3 font-bold">
                  Membri
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const mine = !!myId && r.participants.some(p => p.documentId === myId);
              return (
                <tr key={r.documentId} data-mine={mine || undefined} className="border-b border-hairline last:border-b-0 data-mine:bg-accent-tint">
                  <td className="relative py-2.5 pr-3 pl-3">
                    <SectorStripe name={sector(r)} />
                    <StandChip name={r.stand?.name} />
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2.5">
                      {!team ? <Avatar name={registrationName(r, team)} src={r.participants[0]?.avatar?.url} size={32} /> : null}
                      <span className="t-body-strong">{registrationName(r, team)}</span>
                      {mine ? <MineBadge /> : null}
                    </span>
                  </td>
                  {clubs ? <td className="py-2.5 pr-3 text-ink-2">{r.club?.name ?? '—'}</td> : null}
                  {members ? (
                    <td className="py-2.5 pr-3">
                      <People r={r} />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** The viewer's own registration: a visible marker (not the row tint alone — WCAG 1.4.1). */
function MineBadge() {
  return (
    <Badge color="indigo" className="shrink-0">
      Tu
    </Badge>
  );
}

/**
 * The stand number; with no stand yet, the red «Nealocat» state pill (fish), with no «Stand» prefix.
 * TODO(kit): StatusPill has no danger tone — this is its spec (t-label, 26px, radius 999) on the danger pair.
 */
function StandChip({ name }: { name: string | undefined }) {
  if (!name) {
    return (
      <span className="inline-flex h-6.5 shrink-0 items-center rounded-full bg-status-danger-bg px-2.5 align-middle t-label whitespace-nowrap text-status-danger-fg">
        Nealocat
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 min-w-11 shrink-0 items-center justify-center rounded-control bg-soft-fill px-2 align-middle t-num-16 text-ink">
      <span className="sr-only">Stand </span>
      {name}
    </span>
  );
}

/** The sector's 4px stripe on the row's left edge (RankingRow), when the stand's sector is known. */
function SectorStripe({ name }: { name: string | undefined }) {
  if (!name) return null;
  const fill = sectorFill(name, 'var(--color-muted)');
  return <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1 rounded-r-[2px]', fill.className)} style={fill.style} />;
}

/** The sector's dot beside its letter (Fundații: the colour never sits under text). */
function SectorDot({ name }: { name: string }) {
  const fill = sectorFill(name, 'var(--color-muted)');
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-full', fill.className)} style={fill.style} />;
}

function People({ r }: { r: DetailRegistration }) {
  if (!r.participants.length) return null;
  const shown = r.participants.slice(0, 3);
  return (
    <FaceStack
      people={shown.map(p => ({ name: p.username, src: p.avatar?.url }))}
      overflow={r.participants.length - shown.length}
      size={24}
      label={plural(r.participants.length, 'membru', 'membri')}
    />
  );
}
