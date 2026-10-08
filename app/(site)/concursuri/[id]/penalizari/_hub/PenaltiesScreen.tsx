'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { competitionKeys, competitionQuery, rankingsKeys, rankingsQuery } from '@/core/competitions';
import {
  deletePenaltyMutation,
  emptyPenaltiesLine,
  gatherPenalties,
  penaltyPermissions,
  type GatheredPenalty,
} from '@/core/organizer';
import { formatDecimal } from '@/components/cards/format';
import { FlowActions, FlowAsideCard, FlowAsideSkeleton } from '@/components/templates/T6';
import { ButtonLink } from '@/components/ui/Button';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { cn } from '@/components/ui/cn';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { isAuthorOrReferee } from '../../_organizer/access';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../_organizer/ManagementFrame';
import { useNavigationGuard } from '../../_organizer/useNavigationGuard';
import { PENALTIES_TITLE, PENALTIES_TITLE_ID, PENALTY_GRID, PenaltiesBodySkeleton } from './PenaltiesSkeleton';
import { PenaltyCard } from './PenaltyCard';
import { RevokeDialog } from './RevokeDialog';

/*
 * «Penalizări» — the competition's penalties hub (parity organizer.penalties; fish
 * app/(app)/penalties/[competitionId]/index.tsx). T6 in the ManagementFrame, `signedIn`: every
 * signed-in viewer reads it (a PENALTY push lands the penalised team here); the actions follow the
 * statute.
 *  - c1: the title; loading joins the competition and the ranking (the frame's skeleton), an error on
 *    either is the frame's gate whose retry refetches both (onRefresh: the ranking);
 *  - c2: the penalties of every ranking row and of every team inside a row, labelled, newest first
 *    (core gatherPenalties). Not started: the ranking is not read (rankingsQuery is disabled) → none;
 *  - c3: none → «Nu există penalizări aplicate», one of three lines, «Aplică penalizare» when allowed;
 *  - c4: «Penalizări aplicate · n» and a card per penalty (PenaltyCard);
 *  - c5: author / referee + started + Cantitate | Cantitate/Calitate → «Aplică penalizare» (the
 *    action bar; from 1280 docked under the summary) → «Alege standul»;
 *  - c6: author / referee + started → «Revocă» → confirm → DELETE /penalties/:id, which re-reads the
 *    ranking and the Best-N ranking (core deletePenaltyMutation). The revoked card leaves the list at
 *    once (a local `revoked` set): the CMS only enqueues the edge purge, so the refetch may still carry
 *    it. A 404 means it is already gone → treated as revoked, never a second error.
 * ≥1280 the aside sums the list up and explains the three kinds (fish apply.tsx's copy).
 */

export function PenaltiesScreen({ competitionId, viewer }: { competitionId: string; viewer: ManagementViewer }) {
  const t = useManagementTransport();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const guard = useNavigationGuard();
  // The frame reads the competition too (same key, one request): its status enables the ranking read.
  const competition = useQuery(competitionQuery(t, competitionId, { isAuthenticated: true }));
  const status = competition.data?.competitionStatus;
  // Only once the status is known: core's `enabled` lets an unknown status through, which would read
  // a not-started competition's ranking while the competition loads (fish does, and then shows it).
  const mayReadRanking = competition.data !== undefined && status !== 'notStarted';
  const rankings = useQuery({ ...rankingsQuery(t, competitionId, status), enabled: mayReadRanking });
  // A disabled read is never «loading» (fish useQuery isLoading is false then): it only joins the
  // frame once it may run.
  const rankingsRead = mayReadRanking ? [rankings] : [];

  const revoke = useMutation(deletePenaltyMutation(t, qc, competitionId));
  const [asking, setAsking] = useState<GatheredPenalty | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  // Revoked in this visit: hidden even while a stale (edge-cached) ranking still carries them.
  const [revoked, setRevoked] = useState<ReadonlySet<string>>(() => new Set());
  const listHeading = useRef<HTMLHeadingElement>(null);
  // cacheComponents keeps the page under <Activity> after navigating away: close the confirm when
  // it is hidden, so Back never returns to an open dialog.
  useLayoutEffect(
    () => () => {
      setAsking(null);
      setRevokeError(null);
    },
    [],
  );

  const closeAsk = () => {
    if (revoke.isPending) return;
    setAsking(null);
    setRevokeError(null);
  };
  const confirmRevoke = async () => {
    if (!asking || revoke.isPending) return;
    setRevokeError(null);
    const id = asking.documentId;
    try {
      await revoke.mutateAsync(id);
    } catch (err) {
      // 404: someone (or an earlier tap whose answer was lost) already revoked it — the goal is met.
      if (!(isApiError(err) && err.status === 404)) {
        setRevokeError((err instanceof Error && err.message) || 'Penalizarea nu a putut fi revocată.');
        return;
      }
      // The mutation's onSuccess did not run: re-read what it would have.
      void qc.invalidateQueries({ queryKey: rankingsKeys.byCompetitionId(competitionId) });
      void qc.invalidateQueries({ queryKey: competitionKeys.rankingBestN(competitionId) });
    }
    setRevoked((prev) => new Set(prev).add(id));
    setAsking(null);
    toast('Penalizarea a fost revocată.', 'success');
    // The revoked card is gone: focus the list's heading (no visible ring, rule 8).
    requestAnimationFrame(() => listHeading.current?.focus({ preventScroll: true }));
  };

  const penalties = gatherPenalties(mayReadRanking ? rankings.data : undefined).filter((p) => !revoked.has(p.documentId));
  const applyHref = routes.competitionPenaltiesStand(competitionId);
  const onApply = (event: { preventDefault: () => void }) => void guard(event);
  const applyLink = (testId: string) => (
    <ButtonLink href={applyHref} onClick={onApply} icon={<PlusIcon />} data-testid={testId}>
      Aplică penalizare
    </ButtonLink>
  );

  return (
    <ManagementFrame
      competitionId={competitionId}
      viewer={viewer}
      title={PENALTIES_TITLE}
      titleId={PENALTIES_TITLE_ID}
      requires="signedIn"
      back={{ href: routes.competition(competitionId), label: 'Înapoi la concurs' }}
      reads={rankingsRead}
      onRefresh={() => (mayReadRanking ? rankings.refetch() : undefined)}
      skeleton={<PenaltiesBodySkeleton />}
      asideSkeleton={<FlowAsideSkeleton />}
      aside={({ competition: c, role }) => {
        const { rankingSupportsPenalties } = penaltyPermissions(isAuthorOrReferee(role), c);
        if (!penalties.length && !rankingSupportsPenalties) return null;
        return (
          <>
            {penalties.length ? <Summary penalties={penalties} /> : null}
            {rankingSupportsPenalties ? <Kinds /> : null}
          </>
        );
      }}
      actions={({ competition: c, role }) =>
        penalties.length > 0 && penaltyPermissions(isAuthorOrReferee(role), c).canApply ? <FlowActions primary={applyLink('apply-penalty')} /> : null
      }
    >
      {({ competition: c, role }) => {
        const rights = penaltyPermissions(isAuthorOrReferee(role), c);
        if (penalties.length === 0) {
          return (
            <div className="flex flex-col items-center gap-3 px-2 py-10 text-center md:py-14" data-testid="penalties-empty">
              <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-soft-fill text-ink-2 [&>svg]:size-6">
                <ShieldCheckIcon />
              </span>
              <h2 className="t-title2 text-ink">Nu există penalizări aplicate</h2>
              <p className="t-body-strong max-w-prose text-muted" data-testid="penalties-empty-line">
                {emptyPenaltiesLine(rights)}
              </p>
              {rights.canApply ? <div className="mt-2">{applyLink('apply-penalty-empty')}</div> : null}
            </div>
          );
        }
        return (
          <>
            <h2
              ref={listHeading}
              id="penalizari-aplicate"
              tabIndex={-1}
              className="t-title2 text-ink outline-none"
              data-testid="penalties-heading"
            >
              Penalizări aplicate · <span className="tabular-nums">{penalties.length}</span>
            </h2>
            <ul aria-labelledby="penalizari-aplicate" className={PENALTY_GRID}>
              {penalties.map((p) => (
                <PenaltyCard
                  key={p.documentId}
                  penalty={p}
                  canRevoke={rights.canRevoke}
                  revoking={revoke.isPending && revoke.variables === p.documentId}
                  onRevoke={() => {
                    if (revoke.isPending) return;
                    setRevokeError(null);
                    setAsking(p);
                  }}
                />
              ))}
            </ul>
            <RevokeDialog
              open={asking !== null}
              pending={revoke.isPending}
              error={revokeError}
              onCancel={closeAsk}
              onConfirm={() => void confirmRevoke()}
            />
          </>
        );
      }}
    </ManagementFrame>
  );
}

/** ≥1280: the list at a glance — how many of each kind, and the weight taken off (rule 10). */
function Summary({ penalties }: { penalties: GatheredPenalty[] }) {
  const of = (action: string) => penalties.filter((p) => p.action === action);
  const deducted = of('DEDUCT_TOTAL_WEIGHT').reduce((kg, p) => kg + (p.value ?? 0), 0);
  const rows: { label: string; count: number; tone: 'warning' | 'danger'; extra?: ReactNode }[] = [
    { label: 'Avertismente', count: of('WARNING').length, tone: 'warning' },
    {
      label: 'Penalizări greutate',
      count: of('DEDUCT_TOTAL_WEIGHT').length,
      tone: 'warning',
      extra: deducted > 0 ? (
        <>
          în total <InlineNumber value={`−${formatDecimal(deducted, 0, 3)}`} unit="kg" />
        </>
      ) : null,
    },
    { label: 'Eliminări', count: of('ELIMINATE').length, tone: 'danger' },
  ];
  return (
    <FlowAsideCard title="Pe scurt" id="penalizari-rezumat" className="xl:shrink-0">
      <dl className="flex flex-col" data-testid="penalties-summary">
        {rows.map((r, i) => (
          <div key={r.label} className={cn('flex items-center gap-3 py-2.5', i > 0 && 'border-t border-hairline')}>
            <span aria-hidden className={cn('h-3.5 w-2.5 shrink-0 rounded-badge', r.tone === 'danger' ? 'bg-status-danger-fg' : 'bg-badge-yellow-fg')} />
            <dt className="flex min-w-0 flex-1 flex-col">
              <span className="t-body text-ink-2">{r.label}</span>
              {r.extra ? <span className="t-caption text-muted">{r.extra}</span> : null}
            </dt>
            <dd className="t-stat text-ink tabular-nums">{r.count}</dd>
          </div>
        ))}
      </dl>
    </FlowAsideCard>
  );
}

/** fish apply.tsx:28-52 — what each kind does to the ranking. */
const KINDS = [
  { label: 'Avertisment', text: 'Doar pentru istoric. Nu modifică clasamentul.', tone: 'warning' },
  { label: 'Penalizare greutate', text: 'Scade o cantitate (kg) din greutatea totală a echipei. Capturile rămân intacte.', tone: 'warning' },
  { label: 'Eliminare', text: 'Echipa este forțată pe ultimul loc în clasament.', tone: 'danger' },
] as const;

function Kinds() {
  return (
    <FlowAsideCard title="Tipuri de penalizări" id="penalizari-tipuri" className="xl:shrink-0">
      <ul className="flex flex-col gap-3" data-testid="penalties-kinds">
        {KINDS.map((k) => (
          <li key={k.label} className="flex gap-3">
            <span aria-hidden className={cn('mt-1.5 h-3.5 w-2.5 shrink-0 rounded-badge', k.tone === 'danger' ? 'bg-status-danger-fg' : 'bg-badge-yellow-fg')} />
            <span className="flex min-w-0 flex-col">
              <span className="t-body-strong text-ink">{k.label}</span>
              <span className="t-caption text-muted">{k.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </FlowAsideCard>
  );
}
