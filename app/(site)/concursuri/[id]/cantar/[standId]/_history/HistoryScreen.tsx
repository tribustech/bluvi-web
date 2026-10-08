'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPinIcon, ScaleIcon } from '@heroicons/react/24/outline';
import { competitionQuery, currentLegOf, type CompetitionWithMyStatus } from '@/core/competitions';
import {
  allocatedParticipantsQuery,
  competitionManagementKeys,
  deleteCantarMutation,
  weighingKeys,
  weighingsQuery,
  weighingsTotalQuery,
} from '@/core/organizer';
import { FlowActions, FlowAsideCard, FlowAsideSkeleton, FlowSubjectCard } from '@/components/templates/T6';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/surfaces/Dialog';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../../_shell/Toast';
import { canWeighCompetition } from '../../../_organizer/access';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../../_organizer/ManagementFrame';
import { useNavigationGuard } from '../../../_organizer/useNavigationGuard';
import { HISTORY_TITLE, HISTORY_TITLE_ID, HistoryBodySkeleton } from './HistorySkeleton';
import {
  canDeleteWeighing,
  defaultSelection,
  formatWeighingKg,
  historyHint,
  parseTotal,
  standHeader,
  standTotals,
  weighingRows,
  type StandHeader,
  type WeighingRow,
} from './model';
import { StartWeighingDialog } from './StartWeighingDialog';
import { WeighingCard } from './WeighingCard';
import { WeighingPanel } from './WeighingPanel';
import { WeighingTable } from './WeighingTable';

/*
 * «Istoric cântăriri» — one stand's weighings (parity organizer.scale-history; fish
 * app/(app)/scale/[competitionId]/history.tsx). T6 in the ManagementFrame, `signedIn`: anyone
 * signed in reads it; the actions follow the statute.
 *  - c1: the title (fish's «Istoric cântariri» typo fixed); loading and error — the frame's retry
 *    refetches the competition and the statute, and onRefresh the weighings and the allocations;
 *  - c2: the dashed stand card «Sector X, Stand N (T kg)» (NC label + club, «Echipa …», bullets);
 *  - c3: feeder — the weighings and the total are the current leg's (currentLegOf in the keys);
 *  - c4/c5: a card per weighing (below 1280) that opens it; from 1280 a table with every column and
 *    the selected weighing in the side panel (owner rule 14);
 *  - c6: actions only for the author or a referee while the competition runs (canWeighCompetition:
 *    also not on a closed feeder leg);
 *  - c7: an empty unfinished weighing's ✕ → confirm → delete → toast → weighings + active weighing;
 *  - c8: «Nu s-a efectuat nicio cântărire.»;
 *  - c9/c10: «Start cântar nou» → StartWeighingDialog;
 *  - c11: the header's refresh (fish pull-to-refresh).
 * The sector and stand names come from the competition (fish passes them in the route's query).
 */

export function HistoryScreen({ competitionId, standId, viewer }: { competitionId: string; standId: string; viewer: ManagementViewer }) {
  const t = useManagementTransport();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const guard = useNavigationGuard();
  // The frame reads the competition too (same key, one request): the leg scopes the stand's reads.
  const competition = useQuery(competitionQuery(t, competitionId, { isAuthenticated: true }));
  const known = competition.data !== undefined;
  const round = currentLegOf(competition.data);
  const weighings = useQuery(weighingsQuery(t, competitionId, standId, { enabled: known, round }));
  const total = useQuery(weighingsTotalQuery(t, competitionId, standId, { enabled: known, round }));
  const allocations = useQuery(allocatedParticipantsQuery(t, competitionId));

  const [picked, setPicked] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<WeighingRow | null>(null);
  // cacheComponents keeps this page under <Activity> after navigating away (state preserved): close
  // both dialogs when it is hidden, so Back never returns to an open start or delete confirmation.
  useLayoutEffect(
    () => () => {
      setStarting(false);
      setConfirmDelete(null);
    },
    [],
  );

  const remove = useMutation({
    ...deleteCantarMutation(t),
    onSuccess: () => toast('Cântarul a fost șters cu succes.', 'success'),
    onError: (error) => toast(error.message || 'Cântarul nu a putut fi șters.', 'danger'),
    onSettled: () => {
      void qc.invalidateQueries({
        queryKey: weighingKeys.byCompetitionId(competitionId),
      });
      void qc.invalidateQueries({
        queryKey: competitionManagementKeys.activeWeighingById(competitionId),
      });
    },
  });
  const deletingId = remove.isPending ? (remove.variables ?? null) : null;
  const askDelete = (row: WeighingRow) => {
    if (!remove.isPending) setConfirmDelete(row);
  };
  const doDelete = () => {
    const row = confirmDelete;
    setConfirmDelete(null);
    if (row && !remove.isPending) remove.mutate(row.id);
  };

  const rows = weighingRows(weighings.data);
  const selected = defaultSelection(rows, picked);
  const selectedRow = rows.find((r) => r.id === selected) ?? null;
  const hrefFor = (weighingId: string) => routes.competitionScaleWeighing(competitionId, standId, weighingId);
  const onNavigate = (event: { preventDefault: () => void }) => void guard(event);
  const startButton = (
    <Button onClick={() => setStarting(true)} data-testid="start-weighing">
      Start cântar nou
    </Button>
  );
  const headerOf = (c: CompetitionWithMyStatus | null) => (c ? standHeader(c, allocations.data, standId) : null);

  return (
    <ManagementFrame
      competitionId={competitionId}
      viewer={viewer}
      title={HISTORY_TITLE}
      titleId={HISTORY_TITLE_ID}
      requires="signedIn"
      back={{
        href: routes.competitionScale(competitionId),
        label: 'Înapoi la standuri',
      }}
      reads={[weighings, allocations]}
      onRefresh={() => Promise.all([weighings.refetch(), allocations.refetch(), total.refetch()]).then((rs) => rs.find((r) => r.isError) ?? rs[0])}
      skeleton={<HistoryBodySkeleton />}
      asideSkeleton={<FlowAsideSkeleton />}
      hint={({ competition: c, role }) => (c ? historyHint(c, role) : null)}
      aside={({ competition: c, role }) => {
        if (!headerOf(c)) return null;
        const allowed = canWeighCompetition(role, c!);
        return (
          <>
            <StandSummary rows={rows} total={parseTotal(total.data)} />
            {/* ≥1280 the CTA sits right under the summary, above the weighing panel: docked at the
                column's foot it fell below the fold on 1280×800 (the header band pushes the column
                down). Below 1280 the same action is the bottom bar (`actions`). */}
            {allowed ? (
              <div className="hidden xl:block xl:shrink-0">
                <FlowActions primary={startButton} />
              </div>
            ) : null}
            {selectedRow ? (
              <WeighingPanel
                key={selectedRow.id}
                t={t}
                row={selectedRow}
                href={hrefFor(selectedRow.id)}
                deletable={canDeleteWeighing(selectedRow, allowed)}
                deleting={deletingId === selectedRow.id}
                onDelete={() => askDelete(selectedRow)}
                onNavigate={onNavigate}
              />
            ) : null}
          </>
        );
      }}
      actions={({ competition: c, role }) =>
        c && headerOf(c) && canWeighCompetition(role, c) ? (
          <div className="xl:hidden">
            <FlowActions primary={startButton} />
          </div>
        ) : null
      }
    >
      {({ competition: c, role }) => {
        const header = headerOf(c);
        if (!c || !header) {
          return (
            <Note icon={<MapPinIcon className="size-6" />} testId="stand-missing">
              Standul nu face parte din acest concurs.{' '}
              <Link href={routes.competitionScale(competitionId)} className="t-body-strong text-accent-ink underline underline-offset-4">
                Alege alt stand
              </Link>
            </Note>
          );
        }
        const allowed = canWeighCompetition(role, c);
        return (
          <>
            <SubjectCard header={header} total={parseTotal(total.data)} />
            {rows.length === 0 ? (
              <Note icon={<ScaleIcon className="size-6" />} testId="weighings-empty">
                Nu s-a efectuat nicio cântărire.
              </Note>
            ) : (
              <>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden" aria-label="Cântările standului">
                  {rows.map((row) => (
                    <WeighingCard
                      key={row.id}
                      row={row}
                      href={hrefFor(row.id)}
                      deletable={canDeleteWeighing(row, allowed)}
                      deleting={deletingId === row.id}
                      onDelete={() => askDelete(row)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </ul>
                <div className="hidden xl:block">
                  <WeighingTable
                    rows={rows}
                    selected={selected}
                    onSelect={setPicked}
                    hrefFor={hrefFor}
                    actionsAllowed={allowed}
                    deletingId={deletingId}
                    onDelete={askDelete}
                    onNavigate={onNavigate}
                  />
                </div>
              </>
            )}
            <StartWeighingDialog
              open={starting}
              onClose={() => setStarting(false)}
              t={t}
              competitionId={competitionId}
              standId={standId}
              sectorName={header.sectorName}
              standName={header.standName}
            />
            <Dialog
              open={confirmDelete !== null}
              onClose={() => setConfirmDelete(null)}
              alert
              title="Ești sigur că vrei să ștergi acest cântar?"
              description={confirmDelete ? `${confirmDelete.title}, fără capturi.` : undefined}
              actions={
                <>
                  <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
                    Renunță
                  </Button>
                  <Button variant="danger" onClick={doDelete} data-testid="delete-confirm">
                    Șterge
                  </Button>
                </>
              }
            />
          </>
        );
      }}
    </ManagementFrame>
  );
}

/** c2 — fish's dashed indigo header card, the total in parentheses with its unit spaced (rule 10). */
function SubjectCard({ header, total }: { header: StandHeader; total: number | null }) {
  return (
    <FlowSubjectCard
      title={
        <span data-testid="stand-title">
          {header.label}
          {total !== null ? (
            <span className="whitespace-nowrap tabular-nums">
              {' '}
              ({formatWeighingKg(total)}
              <span className="t-heading text-accent-ink/80"> kg</span>)
            </span>
          ) : null}
        </span>
      }
      kicker={header.club}
      subtitle={header.team}
      people={header.people}
    />
  );
}

/** ≥1280: the stand at a glance — kg, weighings (extra among them), catches (owner rule 10: units spaced). */
function StandSummary({ rows, total }: { rows: WeighingRow[]; total: number | null }) {
  const n = standTotals(rows);
  return (
    <FlowAsideCard title="Pe acest stand" id="istoric-rezumat" className="xl:shrink-0">
      <div data-testid="stand-summary" className="flex flex-col gap-3">
        {total !== null ? <SignatureNumber size="stat" value={formatWeighingKg(total)} unit="kg" caption="Total cântărit" /> : null}
        <dl className="grid grid-cols-2 gap-3 border-t border-hairline pt-3">
          <div className="flex flex-col">
            <dt className="t-caption text-muted">Cântare</dt>
            <dd className="t-stat text-ink tabular-nums">
              {n.weighings}
              {n.extra > 0 ? <span className="t-caption ml-1.5 text-muted">({n.extra} extra)</span> : null}
            </dd>
          </div>
          <div className="flex flex-col">
            <dt className="t-caption text-muted">Capturi</dt>
            <dd className="t-stat text-ink tabular-nums">{n.catches}</dd>
          </div>
        </dl>
      </div>
    </FlowAsideCard>
  );
}

/** A line inside the task card with the flow's 40px notice disc (as the stand picker's). */
function Note({ icon, children, testId }: { icon: ReactNode; children: ReactNode; testId: string }) {
  return (
    <div className="flex items-start gap-3" data-testid={testId}>
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-fill text-ink-2">
        {icon}
      </span>
      <p className="t-body-strong min-w-0 flex-1 pt-2 text-ink-2">{children}</p>
    </div>
  );
}
