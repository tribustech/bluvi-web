'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ArrowPathIcon, ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { competitionQuery, type CompetitionWithMyStatus } from '@/core/competitions';
import type { Transport } from '@/core/transport';
import { describeError } from '@/components/templates/T1/describeError';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { T4Gate } from '@/components/templates/T4';
import { FlowHeader, FlowHeaderSkeleton, FlowLayout, FlowSkeleton } from '@/components/templates/T6';
import { Button, ButtonLink } from '@/components/ui/Button';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { useSiteToast } from '../../../_shell/Toast';
import { COMPETITIONS_CRUMB } from '../_components/crumbs';
import { deniedCopy, managementAccess, type CompetitionRole, type ManagementRequirement } from './access';
import { useCompetitionRole } from './useCompetitionRole';

/*
 * ManagementFrame — THE frame of every competition management page (M6: scale, penalties, sectors,
 * participant allocation, stand timeline…). Shared and read-only for later batches; extend it
 * additively. Built on T6 (FlowLayout / FlowHeader).
 *
 *   <ManagementFrame
 *     competitionId={id}                    // the competition the page manages (omit for /organizator)
 *     viewer={{ documentId, isOrganizer }}  // from requireViewer on the server
 *     title="Alege standul"
 *     hint={({ competition, role }) => …}   // the header's meta line; only for known states (rule 4)
 *     back={{ href: routes.competition(id), label: 'Înapoi la concurs' }}
 *     requires="signedIn" | "author" | "authorOrReferee" | "role"
 *     reads={[allocations]}                 // the page's own queries: their loading / error join the frame's
 *     onRefresh={() => allocations.refetch()}
 *     skeleton={<…/>} aside={(ctx) => …} actions={(ctx) => …}
 *   >
 *     {({ competition, role, t }) => <the task/>}
 *   </ManagementFrame>
 *
 * What it does:
 * - reads the competition (core competitionQuery, the same key the page's own reads share) and the
 *   viewer's statute (userStatuteForCompetitionQuery, 1 h) — through /api/cms with the httpOnly JWT;
 * - loading: the header with the real title + the page's `skeleton` (default FlowSkeleton), busy,
 *   announced once; nothing is printed for a state not known yet (owner rule 4);
 * - error (no data): T4Gate danger with fish ErrorScreen's copy (describeError) and «Încearcă din
 *   nou», which refetches the competition, the statute and calls `onRefresh` (the page's reads);
 *   while it runs the button is disabled + aria-busy with a spinner (no repeat rounds), and a status
 *   line says it started and, if the gate stays, that it failed again;
 * - the gate: `requires` vs the statute (access.ts). Unknown statute → still loading; a known role
 *   without the right → a neutral gate with the way back (organizer.b.role-gate). The CMS stays the
 *   authority on every write;
 * - the refresh action in the header (fish pull-to-refresh, organizer.b.no-polling): refetches the
 *   competition, the statute and `onRefresh`; a failure keeps the data and toasts;
 * - the breadcrumb «Competiții › <concurs> › <title>», back to the competition page.
 * The page itself exports `managementMetadata(title)` (./metadata.ts: noindex) and gates the session
 * on the server (proxy.ts matcher + requireViewer), so the frame always runs signed in.
 */

export type ManagementViewer = { documentId: string; isOrganizer: boolean };

export type ManagementContext = {
  /** null only for a frame without `competitionId`. */
  competition: CompetitionWithMyStatus | null;
  /** undefined: the statute is not known (no competition, or its read failed on a `signedIn` page). */
  role: CompetitionRole | undefined;
  t: Transport;
};

type Read = Pick<UseQueryResult, 'isPending' | 'isError' | 'error' | 'data'>;

type Props = {
  competitionId?: string;
  viewer: ManagementViewer;
  title: string;
  /** The h1's id (the task region's label). */
  titleId?: string;
  hint?: (ctx: ManagementContext) => ReactNode;
  back: { href: string; label?: string };
  requires: ManagementRequirement;
  /** The page's own queries: pending → the skeleton, failed without data → the error gate. */
  reads?: Read[];
  /** The page's part of a refresh / retry (refetch its own reads). */
  onRefresh: () => Promise<unknown> | void;
  /** The task's loading body (default FlowSkeleton). */
  skeleton?: ReactNode;
  aside?: (ctx: ManagementContext) => ReactNode;
  asideSkeleton?: ReactNode;
  asideMobile?: 'after' | 'hidden';
  actions?: (ctx: ManagementContext) => ReactNode;
  children: (ctx: ManagementContext) => ReactNode;
};

/** One browser transport per page, through the same-origin proxy (/api/cms, the httpOnly JWT). */
export function useManagementTransport(): Transport {
  return useMemo(() => createBrowserTransport({ direct: false }), []);
}

export function ManagementFrame(props: Props) {
  const t = useManagementTransport();
  if (props.competitionId) return <CompetitionFrame {...props} competitionId={props.competitionId} t={t} />;
  return <Frame {...props} t={t} competition={null} competitionRead={null} role={undefined} statuteRead={null} />;
}

function CompetitionFrame(props: Props & { competitionId: string; t: Transport }) {
  const competition = useQuery(competitionQuery(props.t, props.competitionId, { isAuthenticated: true }));
  const { role, statute } = useCompetitionRole(props.t, props.competitionId);
  return (
    <Frame
      {...props}
      competition={competition.data ?? null}
      competitionRead={competition}
      role={role}
      statuteRead={statute}
    />
  );
}

type FrameProps = Props & {
  t: Transport;
  competition: CompetitionWithMyStatus | null;
  competitionRead: (Read & { refetch: () => Promise<unknown> }) | null;
  role: CompetitionRole | undefined;
  statuteRead: (Read & { refetch: () => Promise<unknown> }) | null;
};

function Frame({
  competitionId,
  viewer,
  title,
  titleId = 'management-title',
  hint,
  back,
  requires,
  reads = [],
  onRefresh,
  skeleton,
  aside,
  asideSkeleton,
  asideMobile = 'hidden',
  actions,
  children,
  t,
  competition,
  competitionRead,
  role,
  statuteRead,
}: FrameProps) {
  const pathname = usePathname();
  const toast = useSiteToast();
  const [refreshing, setRefreshing] = useState(false);
  // The error gate's retry: react-query keeps status 'error' while it refetches, so the gate would
  // look the same until it settles — this drives the busy button and the status line instead.
  const [retrying, setRetrying] = useState(false);
  const [retryNote, setRetryNote] = useState('');
  const backLabel = back.label ?? 'Înapoi';
  const ctx: ManagementContext = { competition, role, t };

  // The statute decides the gate on author / referee pages; on the others a failed statute only
  // leaves the role unknown (the page reads as read-only).
  const statuteGates = requires === 'author' || requires === 'authorOrReferee';
  const gating: Read[] = [
    ...(competitionRead ? [competitionRead] : []),
    ...(statuteRead && (statuteGates || !statuteRead.isError) ? [statuteRead] : []),
    ...reads,
  ];
  const failed = gating.find((r) => r.isError && r.data === undefined);
  const pending = !failed && gating.some((r) => r.isPending);
  const access = managementAccess(requires, { role, isOrganizer: viewer.isOrganizer });

  const refetchAll = () =>
    Promise.all([competitionRead?.refetch(), statuteRead?.refetch(), onRefresh()]);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const results = await refetchAll();
      // react-query resolves a failed refetch with { isError } (the data is kept): say so once.
      if (results.some((r) => isFailedResult(r))) toast('Nu am putut actualiza datele. Încearcă din nou.', 'danger');
    } finally {
      setRefreshing(false);
    }
  };

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryNote('Se reîncarcă datele…');
    try {
      const results = await refetchAll();
      // Success unmounts the gate (the page renders); a failure keeps it, said once.
      setRetryNote(results.some((r) => isFailedResult(r)) ? 'Tot nu am putut încărca datele. Încearcă din nou.' : 'Datele au fost încărcate.');
    } finally {
      setRetrying(false);
    }
  };

  const crumbs = competitionId ? (
    <SetBreadcrumb
      trail={[
        COMPETITIONS_CRUMB,
        ...(competition ? [{ label: competition.name, href: routes.competition(competitionId) }] : []),
        { label: title },
      ]}
    />
  ) : null;

  if (failed) {
    const d = describeError(failed.error);
    return (
      <>
        {crumbs}
        <FlowLayout
          header={<FlowHeader title={title} id={titleId} backHref={back.href} backLabel={backLabel} />}
          variant="bare"
          narrow
          labelledBy={titleId}
        >
          <T4Gate
            tone="danger"
            role="alert"
            icon={<ExclamationTriangleIcon />}
            title={d.title}
            description={d.message}
            actions={
              <>
                {d.canRetry ? (
                  <Button
                    onClick={() => void retry()}
                    disabled={retrying}
                    aria-busy={retrying || undefined}
                    icon={retrying ? <ArrowPathIcon className="motion-safe:animate-spin" /> : undefined}
                    data-testid="management-retry"
                  >
                    Încearcă din nou
                  </Button>
                ) : null}
                {d.showSignOut ? <ButtonLink href={routes.signIn(pathname ?? undefined)}>Intră în cont</ButtonLink> : null}
                <ButtonLink variant="secondary" href={back.href}>
                  {backLabel}
                </ButtonLink>
              </>
            }
          />
          <span role="status" className="sr-only" data-testid="management-retry-status">
            {retryNote}
          </span>
        </FlowLayout>
      </>
    );
  }

  if (pending || access === 'pending') {
    return (
      <>
        {crumbs}
        <FlowLayout
          header={<FlowHeaderSkeleton title={title} id={titleId} trailing={false} />}
          busy
          labelledBy={titleId}
          aside={asideSkeleton}
          asideMobile={asideMobile}
        >
          {skeleton ?? <FlowSkeleton />}
        </FlowLayout>
      </>
    );
  }

  if (access === 'denied') {
    const copy = deniedCopy(requires);
    return (
      <>
        {crumbs}
        <FlowLayout
          header={
            <FlowHeader title={title} id={titleId} eyebrow={competition?.name} backHref={back.href} backLabel={backLabel} />
          }
          variant="bare"
          narrow
          labelledBy={titleId}
        >
          <T4Gate
            icon={<LockClosedIcon />}
            title={copy.title}
            description={copy.description}
            actions={
              <ButtonLink variant="secondary" href={back.href}>
                {backLabel}
              </ButtonLink>
            }
          />
        </FlowLayout>
      </>
    );
  }

  return (
    <>
      {crumbs}
      <FlowLayout
        header={
          <FlowHeader
            title={title}
            id={titleId}
            eyebrow={competition?.name}
            meta={hint?.(ctx)}
            backHref={back.href}
            backLabel={backLabel}
            trailing={<RefreshButton refreshing={refreshing} onRefresh={() => void refresh()} />}
          />
        }
        labelledBy={titleId}
        aside={aside?.(ctx)}
        asideMobile={asideMobile}
        actions={actions?.(ctx)}
      >
        {children(ctx)}
      </FlowLayout>
    </>
  );
}

const isFailedResult = (r: unknown) => typeof r === 'object' && r !== null && 'isError' in r && (r as { isError: boolean }).isError;

/**
 * fish pull-to-refresh on the web: the header's refresh chip (T3's header chip, 48 / 40 from 1280).
 * While it runs the glyph spins (still, under reduced motion) and the chip is busy; the status line
 * announces the start and the end once.
 */
function RefreshButton({ refreshing, onRefresh }: { refreshing: boolean; onRefresh: () => void }) {
  const [announced, setAnnounced] = useState('');
  const [prev, setPrev] = useState(refreshing);
  if (prev !== refreshing) {
    setPrev(refreshing);
    setAnnounced(refreshing ? 'Se actualizează…' : 'Datele au fost actualizate.');
  }
  return (
    <>
      <button
        type="button"
        onClick={onRefresh}
        aria-label="Reîmprospătează"
        aria-busy={refreshing || undefined}
        aria-disabled={refreshing || undefined}
        data-testid="management-refresh"
        className={headerChipClass({
          className: 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        })}
      >
        <ArrowPathIcon aria-hidden className={refreshing ? 'motion-safe:animate-spin' : undefined} />
      </button>
      <span role="status" className="sr-only">
        {announced}
      </span>
    </>
  );
}
