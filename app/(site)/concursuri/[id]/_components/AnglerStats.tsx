'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRightIcon, InformationCircleIcon, LockClosedIcon, UserGroupIcon, UserIcon } from '@heroicons/react/24/outline';
import {
  getRosterDocumentIds,
  participantStatisticsBatchQuery,
  participantStatisticsState,
  type CompetitionWithMyStatus,
  type DetailRegistration,
} from '@/core/competitions';
import type { ParticipantStats } from '@/core/social';
import type { Transport } from '@/core/transport';
import { ErrorState } from '@/components/surfaces/StateCard';
import { SignInGate } from '@/components/templates/SignInGate';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { anglerHref } from '@/lib/routes';
import { ContextSurface } from './ContextSurface';
import { isOfflineEmpty, OfflineState } from './offline';
import { QueryRetry } from './QueryRetry';
import { formatKg } from './ranking';
import { PAGE_RETRY } from './retry-policy';

/*
 * fish components/competition/angler-stats/AnglerStatsSheet.tsx (parity
 * competition-page.statistici-pescar): a ranking row pressed opens who is on that stand — one
 * angler (big face, name, «Sector X · Standul Y», Capturi / C.M.M.C / Competiții, «Vezi profilul»),
 * a guest (no Bluvi account: no stats), or a team (every member's stats; a member without an
 * account is «Invitat · statistici indisponibile»; a team added without accounts says so). Signed
 * out, or when the stats batch refuses the session: the kit SignInGate (the page's one signed-out
 * look) with «Continuă ca vizitator». One batch for the whole roster, fresh 5 minutes (core).
 * Values: the C.M.M.C at the competition's precision, every value in ink, «-» when unknown.
 *
 * «Vezi profilul» needs the angler profile (/pescari/[id], M2): it shows the moment that page ships
 * (anglerHref), until then the block has no link.
 */

export function AnglerStats({
  t,
  competition,
  registration,
  isAuthenticated,
  signIn,
  decimals,
  onClose,
  fromLink = false,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  registration: DetailRegistration | null;
  isAuthenticated: boolean;
  signIn: string;
  /** The competition's weight precision (weightDecimals), as the ranking row behind the surface. */
  decimals: number;
  onClose: () => void;
  /** Opened by `?pescar=` on arrival: an overlay from 1280, so the ranking never narrows by itself. */
  fromLink?: boolean;
}) {
  return (
    <ContextSurface open={!!registration} onClose={onClose} title="Statistici pescar" overlay={fromLink}>
      {registration ? (
        <Body
          t={t}
          competition={competition}
          registration={registration}
          isAuthenticated={isAuthenticated}
          signIn={signIn}
          decimals={decimals}
          onClose={onClose}
        />
      ) : null}
    </ContextSurface>
  );
}

const teamTitle = (r: DetailRegistration) => r.teamName?.trim() || r.club?.name?.trim() || 'Echipă';

/** fish getSubtitle: «Sector A · Standul 12». */
function subtitleOf(competition: CompetitionWithMyStatus, r: DetailRegistration): string | null {
  const standId = r.stand?.documentId;
  const sector = standId ? competition.sectors.find(s => s.stands.some(st => st.documentId === standId)) : undefined;
  const parts = [sector ? `Sector ${sector.name}` : null, r.stand?.name ? `Standul ${r.stand.name}` : null].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

function Body({
  t,
  competition,
  registration,
  isAuthenticated,
  signIn,
  decimals,
  onClose,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  registration: DetailRegistration;
  isAuthenticated: boolean;
  signIn: string;
  decimals: number;
  onClose: () => void;
}) {
  const ids = getRosterDocumentIds(registration);
  // PAGE_RETRY already skips 401 / 403 (the sign-in prompt below); a 5xx is retried once.
  const q = useQuery({ ...participantStatisticsBatchQuery(t, competition.documentId, ids, { isAuthenticated }), ...PAGE_RETRY });
  const { statsMap, isStatsUnauthorized, isLoading } = participantStatisticsState(q, ids, { isAuthenticated });
  const subtitle = subtitleOf(competition, registration);

  if (isStatsUnauthorized) {
    // fish's prompt (parity c2), on the kit's one signed-out gate, without its card inside the surface.
    return (
      <SignInGate
        title="Statistici pentru pescari"
        description="Intră în cont ca să vezi capturile și recordurile fiecărui pescar din concurs."
        icon={<LockClosedIcon />}
        href={signIn}
        headingLevel={3}
        secondaryAction={
          <Button variant="ghost" onClick={onClose}>
            Continuă ca vizitator
          </Button>
        }
        className="bg-transparent! px-0! py-2! shadow-none!"
      />
    );
  }

  const participants = registration.participants;
  // Offline with nothing cached (the batch paused) is a failure too: «-» and the retry, never a
  // shimmer that never ends.
  const offline = isOfflineEmpty(q);
  const failed = (q.isError && !q.data) || offline;
  const loading = isLoading && !failed;
  const failure = offline ? (
    <OfflineState className="mt-4" fetching={q.isFetching} onRetry={() => void q.refetch()} />
  ) : failed ? (
    <ErrorState
      className="mt-4"
      title="Statisticile nu au putut fi încărcate."
      action={<QueryRetry fetching={q.isFetching} failed onRetry={() => void q.refetch()} size="compact" />}
    />
  ) : null;

  if (competition.competitionType === 'team') {
    if (participants.length === 0) {
      return (
        <div className="flex flex-col gap-5">
          <Header face={<GuestFace size={56} team />} title={teamTitle(registration)} subtitle={subtitle} />
          <Note title="Statistici indisponibile" text="Participanții au fost adăugați fără cont Bluvi." />
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        <Header
          face={
            <span className="flex items-center *:not-first:-ml-2.5">
              {participants.slice(0, 4).map((p, i) =>
                p.documentId ? (
                  <Avatar key={p.documentId} name={p.username} src={p.avatar?.url} size={40} ring />
                ) : (
                  <GuestFace key={`g-${i}`} size={40} ring />
                ),
              )}
            </span>
          }
          title={teamTitle(registration)}
          subtitle={subtitle}
        />
        <ul className="mt-4 flex flex-col divide-y divide-hairline border-t border-hairline">
          {participants.map((p, i) =>
            p.documentId ? (
              <li key={p.documentId} className="flex items-center gap-3.5 py-3.5">
                <Avatar name={p.username} src={p.avatar?.url} size={48} />
                <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                  <p className="truncate t-heading text-ink">{p.username}</p>
                  <StatTrio stats={statsMap[p.documentId]} loading={loading && !statsMap[p.documentId]} failed={failed} decimals={decimals} />
                  <ProfileLink documentId={p.documentId} />
                </div>
              </li>
            ) : (
              // A member without a Bluvi account (fish isGuest): no stats to read, no profile.
              <li key={`g-${i}`} className="flex items-center gap-3.5 py-3.5">
                <GuestFace size={48} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate t-heading text-ink">{p.username || 'Invitat'}</p>
                  <p className="flex items-center gap-1.5 t-caption text-muted">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-faint" />
                    Invitat · statistici indisponibile
                  </p>
                </div>
              </li>
            ),
          )}
        </ul>
        {failure}
      </div>
    );
  }

  const p = participants[0];
  if (!p?.documentId) {
    // An individual guest (no participant, or one without an account): no Bluvi account, no stats.
    return (
      <div className="flex flex-col gap-5">
        <Header face={<GuestFace size={56} />} title={p?.username || registration.guestName || 'Invitat'} subtitle={subtitle} />
        <Note title="Invitat · statistici indisponibile" text="Pescarul nu are cont Bluvi." />
      </div>
    );
  }
  // One angler: the face, the name and the stand stacked and centred, the three stats on a full row.
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Avatar name={p.username} src={p.avatar?.url} size={64} />
      <div className="flex min-w-0 max-w-full flex-col gap-0.5">
        <p className="truncate t-title2 text-ink">{p.username}</p>
        {subtitle ? <p className="t-caption text-muted">{subtitle}</p> : null}
      </div>
      <div className="w-full border-y border-hairline py-3">
        <StatTrio stats={statsMap[p.documentId]} loading={loading && !statsMap[p.documentId]} failed={failed} decimals={decimals} />
      </div>
      <ProfileLink documentId={p.documentId} centered />
      {failure ? <div className="w-full text-left">{failure}</div> : null}
    </div>
  );
}

function Header({ face, title, subtitle }: { face: ReactNode; title: string; subtitle: string | null }) {
  return (
    <div className="flex items-center gap-3">
      {face}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 t-title2 text-ink">{title}</p>
        {subtitle ? <p className="t-caption text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
}

function GuestFace({ size, team = false, ring = false }: { size: number; team?: boolean; ring?: boolean }) {
  const Icon = team ? UserGroupIcon : UserIcon;
  return (
    <span
      aria-hidden
      className={cn('flex shrink-0 items-center justify-center rounded-full bg-soft-fill text-muted', ring && 'box-border border-2 border-surface')}
      style={{ width: size, height: size }}
    >
      <Icon className="size-1/2" />
    </span>
  );
}

function Note({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-dashed border-faint bg-page p-4">
      <span aria-hidden className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-soft-fill text-muted">
        <InformationCircleIcon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="t-body-strong text-ink">{title}</p>
        <p className="t-caption text-ink-2">{text}</p>
      </div>
    </div>
  );
}

/**
 * fish StatTrio: Capturi · C.M.M.C · Competiții, three equal columns split by thin dividers, every
 * value in ink (a status colour would read as a warning). A member with no entry in the batch reads
 * «-» (fish), never a made-up «0»; when the batch failed the dashes are hidden from assistive tech
 * (the error under them says it).
 */
function StatTrio({
  stats,
  loading,
  failed,
  decimals,
}: {
  stats: ParticipantStats | undefined;
  loading: boolean;
  failed: boolean;
  decimals: number;
}) {
  return (
    <dl aria-hidden={failed || undefined} className="grid w-full grid-cols-3 items-stretch">
      <Stat label="Capturi" loading={loading} value={stats ? String(stats.catches) : '-'} />
      <Stat
        label="C.M.M.C"
        loading={loading}
        value={stats?.biggestCatchKg != null ? formatKg(stats.biggestCatchKg, decimals) : '-'}
        unit={stats?.biggestCatchKg != null ? 'kg' : undefined}
        className="border-x border-hairline"
      />
      <Stat label="Competiții" loading={loading} value={stats ? String(stats.competitions) : '-'} />
    </dl>
  );
}

function Stat({
  label,
  value,
  unit,
  loading,
  className,
}: {
  label: string;
  value: string;
  unit?: string;
  loading: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col-reverse items-center gap-1 px-1', className)}>
      <dt className="t-caption text-muted">{label}</dt>
      <dd className="flex items-baseline gap-0.5 t-title2 text-ink tabular-nums">
        {loading ? (
          <>
            <span aria-hidden className="my-1.5 block h-4 w-10 animate-shimmer rounded-full" />
            <span className="sr-only">Se încarcă</span>
          </>
        ) : (
          <>
            {value}
            {unit ? <span className="t-caption text-muted">{unit}</span> : null}
          </>
        )}
      </dd>
    </div>
  );
}

function ProfileLink({ documentId, centered = false }: { documentId: string; centered?: boolean }) {
  const href = anglerHref(documentId);
  if (!href) return null;
  return (
    <Link
      href={href}
      className={cn('inline-flex items-center gap-1 rounded-control t-label text-accent-ink hover:underline', centered ? 'self-center' : 'self-start')}
    >
      Vezi profilul
      <ChevronRightIcon aria-hidden className="size-3.5" />
    </Link>
  );
}
