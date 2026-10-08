'use client';

import { useEffect, useId, useMemo, useRef, useState, type Ref } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { ArrowPathIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  competitionRegistrationsListQuery,
  competitionsKeys,
  formatCount,
  type CompetitionWithMyStatus,
  type Registration,
} from '@/core/competitions';
import {
  acceptRegistrationMutation,
  moveRegistrationToWaitingListMutation,
  rejectRegistrationMutation,
} from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { DetailSection, DetailSectionState } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { useSiteToast } from '../../../../_shell/Toast';
import { useBrokenImages } from '../brokenImages';
import { PersonPopover, usePersonPopover } from '../PersonPopover';
import { QueryRetry } from '../QueryRetry';
import { PAGE_RETRY } from '../retry-policy';
import { Bone } from '../tabParts';
import { StatusConfirmDialog } from './StatusConfirmDialog';
import { PhoneRow, TableRow } from './RegistrationRow';
import {
  FILTERS,
  accountParticipantIds,
  confirmOf,
  filterCounts,
  filterFromParam,
  matchesFilter,
  paramOfFilter,
  refreshKeys,
  registrationName,
  sortRegistrations,
  statusErrorMessage,
  toDetailRegistration,
  type FilterKey,
  type StatusAction,
} from './model';

/*
 * Concurs · Participanți for its author (parity competition-page.participanti-organizator, M6; fish
 * CompetitionParticipants.tsx:90-92 → components/competition/RegistrationsList.tsx): every
 * registration, whatever its status, to approve, reject, put back on the waiting list, edit or call.
 *
 *  - The filter (fish FilterBar) is a segmented control (owner rule 20): Toți · În așteptare ·
 *    Aprobați · Respinși, each with its count as a badge, the pending count always in its colour.
 *    It starts from `?filtru=` (in-asteptare | aprobati | respinsi; the NEW_REGISTRATION_ORGANIZER
 *    notification opens in-asteptare) and is kept in the URL (replaceState: no navigation, the page
 *    stays prerendered — `filtru` is read here, on the client).
 *  - Below 1024: fish's cards — faces, name, stand, status icon — opening on the action tiles.
 *  - From 1024 (owner rules 14, 17, 18): a roster table — stand, faces and name(s), status in words,
 *    every action inline (no expand); pressing a person opens the person popover (/pescari/[id]).
 *  - Each status change asks first (fish's Alert copy), flips the row at once (core: optimistic,
 *    list marked stale without a refetch, competition invalidated exact), collapses the row and
 *    toasts fish's message — hook-level (fish useRegistrationsList), so every change reports, even two
 *    in flight or after leaving the tab; a refusal the CMS explains says why (statusErrorMessage).
 *    Focus then goes to what still exists: the row, else the next row's first action, else the
 *    filter. «Actualizează» (fish pull-to-refresh) re-reads the list, the competition,
 *    the viewer's statute and the allocations; coming back to the tab after 30 s re-reads the list.
 */

const REFRESH_ON_RETURN_MS = 30_000;

/** The filter's selected look per key (fish activeBg) — the accent and the status pairs' strong ink. */
const SELECTED: Record<FilterKey, string> = {
  all: 'has-checked:bg-accent',
  pending: 'has-checked:bg-status-pending-fg',
  registered: 'has-checked:bg-status-success-fg',
  rejected: 'has-checked:bg-status-danger-fg',
};
/** The count badge, unselected (fish: only the pending count keeps its colour). */
const COUNT: Record<FilterKey, string> = {
  all: 'bg-surface text-ink-2',
  pending: 'bg-status-pending-fg text-on-accent',
  registered: 'bg-surface text-ink-2',
  rejected: 'bg-surface text-ink-2',
};

export function RegistrationsList({ t, competition }: { t: Transport; competition: CompetitionWithMyStatus }) {
  const id = competition.documentId;
  const qc = useQueryClient();
  const toast = useSiteToast();
  const q = useQuery({ ...competitionRegistrationsListQuery(t, id), ...PAGE_RETRY });
  const team = competition.competitionType === 'team';
  const type = team ? 'team' : 'single';

  // The filter lives in the URL (?filtru=): read it, write it with replaceState (useSearchParams follows).
  const params = useSearchParams();
  const filter = filterFromParam(params?.get('filtru'));
  const setFilter = (key: FilterKey) => {
    const url = new URL(window.location.href);
    const p = paramOfFilter(key);
    if (p) url.searchParams.set('filtru', p);
    else url.searchParams.delete('filtru');
    // state null: Next syncs useSearchParams only for a replaceState it does not own.
    window.history.replaceState(null, '', url);
  };

  const sorted = useMemo(() => sortRegistrations(q.data ?? []), [q.data]);
  const statsIds = useMemo(() => accountParticipantIds(q.data ?? []), [q.data]);
  const counts = useMemo(() => filterCounts(q.data ?? []), [q.data]);
  const visible = useMemo(() => sorted.filter(r => matchesFilter(r, filter)), [sorted, filter]);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ registration: Registration; action: StatusAction } | null>(null);
  const accept = useMutation(withToasts(acceptRegistrationMutation(t, qc, id), 'approve', toast));
  const reject = useMutation(withToasts(rejectRegistrationMutation(t, qc, id), 'reject', toast));
  const waiting = useMutation(withToasts(moveRegistrationToWaitingListMutation(t, qc, id), 'pending', toast));
  const confirm = ask ? confirmOf(ask.action, ask.registration.registrationStatus) : null;

  // Where focus goes once the confirmed row has flipped (the dialog's trigger is gone by then).
  const refocusRef = useRef<{ id: string; from: string; index: number; visibleIds: string[] } | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const run = () => {
    if (!ask || !confirm) return;
    const m = ask.action === 'approve' ? accept : ask.action === 'reject' ? reject : waiting;
    const rid = ask.registration.documentId;
    refocusRef.current = { id: rid, from: ask.registration.registrationStatus, index: visible.findIndex(r => r.documentId === rid), visibleIds: visible.map(r => r.documentId) };
    m.mutate(rid);
    // fish: setIsExpanded(false) right after mutate.
    setExpanded(null);
    setAsk(null);
  };

  const refreshing = q.isFetching && !q.isLoading;
  const refresh = () => {
    // fish RegistrationsList onRefresh: the list + refreshActionSheetQueries.
    for (const queryKey of refreshKeys(id)) void qc.invalidateQueries({ queryKey });
  };
  // The tab coming back after a while re-reads the list (CompetitionScreen re-reads the rest).
  const last = useRef(0);
  useEffect(() => {
    last.current = Date.now();
    const onBack = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last.current < REFRESH_ON_RETURN_MS) return;
      last.current = Date.now();
      void qc.invalidateQueries({ queryKey: competitionsKeys.registrationsListById(id) });
    };
    document.addEventListener('visibilitychange', onBack);
    window.addEventListener('focus', onBack);
    return () => {
      document.removeEventListener('visibilitychange', onBack);
      window.removeEventListener('focus', onBack);
    };
  }, [id, qc]);

  useEffect(() => {
    const refocus = refocusRef.current;
    if (!refocus || !q.data) return;
    const now = q.data.find(r => r.documentId === refocus.id);
    // Not flipped yet (core awaits cancelQueries before its optimistic write).
    if (now && now.registrationStatus === refocus.from) return;
    refocusRef.current = null;
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    const scope = boxRef.current?.querySelector<HTMLElement>(`[data-registrations="${desktop ? 'table' : 'cards'}"]`);
    const rowEl = (rid: string) => scope?.querySelector<HTMLElement>(`[data-registration="${CSS.escape(rid)}"]`) ?? null;
    const still = rowEl(refocus.id);
    let target: HTMLElement | null = null;
    if (still) {
      // The row stays: its toggle (phone) or its person / name cell (table).
      target = still.querySelector<HTMLElement>(desktop ? '[data-row-focus]' : 'button[aria-expanded]');
    } else {
      // The row left the filter: the next one (the one now in its place), else the one before.
      const left = visible.map(r => r.documentId);
      const next = refocus.visibleIds.slice(refocus.index + 1).find(x => left.includes(x)) ?? [...refocus.visibleIds.slice(0, Math.max(0, refocus.index))].reverse().find(x => left.includes(x));
      const el = next ? rowEl(next) : null;
      target = el ? el.querySelector<HTMLElement>(desktop ? '[role="group"] a[href], [role="group"] button' : 'button[aria-expanded]') : null;
    }
    target ??= filterRef.current?.querySelector<HTMLElement>('input:checked') ?? null;
    target?.focus();
  }, [q.data, visible]);

  // The person popover (≥1024) reads the competition's registrations: this list's, in its shape.
  const person = usePersonPopover();
  const popoverCompetition = useMemo(() => ({ ...competition, registrations: (q.data ?? []).map(toDetailRegistration) }), [competition, q.data]);
  const [listRef, broken] = useBrokenImages<HTMLDivElement>();

  if (q.isLoading || (!q.data && !q.isError)) return <RegistrationsBones />;
  if (!q.data) {
    return (
      <DetailSection tone="plain" title="Înscrieri">
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="t-body text-ink-2">Înscrierile nu au putut fi încărcate.</p>
          <QueryRetry fetching={q.isFetching} failed onRetry={() => void q.refetch()} size="compact" />
        </div>
      </DetailSection>
    );
  }

  const rowProps = {
    competitionId: id,
    competitionName: competition.name,
    competitionStatus: competition.competitionStatus,
    team,
    broken,
    onStatus: (registration: Registration, action: StatusAction) => setAsk({ registration, action }),
  };

  return (
    <DetailSection
      id="inscrieri"
      tone="plain"
      title="Înscrieri"
      description={team ? formatCount(counts.all, 'echipă înscrisă', 'echipe înscrise') : formatCount(counts.all, 'înscriere', 'înscrieri')}
      action={
        <button
          type="button"
          onClick={refresh}
          aria-busy={refreshing || undefined}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-control px-3 t-button-compact text-ink-2 hover:bg-soft-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          <ArrowPathIcon aria-hidden className={cn('size-4', refreshing && 'animate-spin motion-reduce:animate-none')} />
          Actualizează
        </button>
      }
    >
      <div ref={boxRef} className="flex flex-col gap-3 md:gap-4">
        <FilterBar ref={filterRef} value={filter} counts={counts} onChange={setFilter} />
        <div ref={listRef}>
          {sorted.length === 0 ? (
            <DetailSectionState
              icon={
                <span className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">
                  <UserGroupIcon aria-hidden />
                </span>
              }
              heading="Nu există înregistrări pentru această competiție."
            />
          ) : visible.length === 0 ? (
            <p data-testid="registrations-filter-empty" className="py-6 t-body text-ink-2 max-md:px-0">
              Nu există înregistrări cu acest status.
            </p>
          ) : (
            <>
              {/* Below 1024: fish's cards, edge to edge on the phone. */}
              <ul aria-label="Înscrieri" data-registrations="cards" className="flex flex-col gap-2 max-md:-mx-4 lg:hidden">
                {visible.map(r => (
                  <li key={r.documentId}>
                    <PhoneRow {...rowProps} registration={r} expanded={expanded === r.documentId} onToggle={() => setExpanded(e => (e === r.documentId ? null : r.documentId))} />
                  </li>
                ))}
              </ul>
              {/* From 1024: the roster table, every action inline. */}
              <div data-registrations="table" className="hidden overflow-hidden rounded-card bg-surface shadow-e0 lg:block">
                <table className="w-full table-fixed border-collapse">
                  <caption className="sr-only">Înscrieri — {FILTERS.find(f => f.key === filter)!.label}</caption>
                  <colgroup>
                    <col className="w-28" />
                    <col />
                    <col className="w-40" />
                    {/* The actions' fixed slots (RowActions INLINE_SLOTS) + the cell's right padding. */}
                    <col className={competition.competitionStatus === 'notStarted' ? 'w-[31.25rem]' : 'w-28'} />
                  </colgroup>
                  <thead className="bg-rank-plain-head text-rank-plain-head-ink">
                    <tr className="text-left">
                      <th scope="col" className="py-2.5 pr-2 pl-5 t-label">
                        Stand
                      </th>
                      <th scope="col" className="py-2.5 pr-4 t-label">
                        {team ? 'Echipă' : 'Participant'}
                      </th>
                      <th scope="col" className="py-2.5 pr-4 t-label">
                        Status
                      </th>
                      <th scope="col" className="py-2.5 pr-5 text-right t-label">
                        Acțiuni
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(r => (
                      <TableRow
                        key={r.documentId}
                        {...rowProps}
                        registration={r}
                        personOpen={person.target?.registrationId === r.documentId}
                        onPerson={el => person.open(r.documentId, el)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
      <PersonPopover t={t} competition={popoverCompetition} signedIn target={person.target} onClose={person.close} statsIds={statsIds} />
      <StatusConfirmDialog
        confirm={confirm}
        subject={ask ? registrationName(ask.registration, type).name : null}
        onCancel={() => setAsk(null)}
        onConfirm={run}
      />
    </DetailSection>
  );
}

/**
 * fish FilterBar as a segmented control (owner rule 20): one track, native radios (arrow keys move
 * the selection), the selected segment filled in its status colour, counts as badges. Wider than
 * the phone it scrolls sideways on one line.
 */
function FilterBar({ ref, value, counts, onChange }: { ref?: Ref<HTMLDivElement>; value: FilterKey; counts: Record<FilterKey, number>; onChange: (key: FilterKey) => void }) {
  const name = useId();
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label="Filtrează înscrierile"
      className="flex max-w-full gap-1 self-start overflow-x-auto rounded-full bg-soft-fill p-1 ring-1 ring-hairline ring-inset [scrollbar-width:none] max-md:-mx-1 [&::-webkit-scrollbar]:hidden"
    >
      {FILTERS.map(f => (
        <label
          key={f.key}
          data-filter={f.key}
          className={cn(
            'group/seg flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full pr-1.5 pl-3.5 t-label whitespace-nowrap text-ink-2',
            'transition-[background-color,color,box-shadow] duration-(--duration-fast) ease-select',
            'hover:bg-surface hover:text-ink',
            'has-checked:text-on-accent has-checked:shadow-e1 has-checked:transition-none has-checked:hover:text-on-accent',
            SELECTED[f.key],
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-solid has-focus-visible:outline-accent',
          )}
        >
          <input type="radio" name={name} value={f.key} checked={value === f.key} onChange={() => onChange(f.key)} className="sr-only" />
          <span>{f.label}</span>
          <span
            data-count
            className={cn(
              'flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 t-label tabular-nums',
              COUNT[f.key],
              'group-has-checked/seg:bg-surface group-has-checked/seg:text-ink',
            )}
          >
            {counts[f.key]}
          </span>
        </label>
      ))}
    </div>
  );
}

/** The list's skeleton (fish CompetitionParticipantsSkeleton): the filter track and six rows. */
export function RegistrationsBones() {
  return (
    <div aria-busy="true" className="px-4 py-3 md:p-0">
      <span className="sr-only" role="status">
        Se încarcă înscrierile…
      </span>
      <span aria-hidden className="mb-3 flex flex-col gap-0.5 md:mb-4">
        <Bone className="w-32 t-title2" />
        <Bone className="w-24 t-caption" />
      </span>
      <span aria-hidden className="mb-4 flex h-12 w-full max-w-md animate-shimmer rounded-full" />
      <span aria-hidden className="flex flex-col gap-2 max-md:-mx-4">
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} data-bone="registration" className="flex min-h-18 items-center gap-3 bg-surface py-3 pr-4 pl-4 shadow-e0 md:rounded-card">
            <span className="size-10 shrink-0 animate-shimmer rounded-full" />
            <span className="flex min-w-0 flex-1 flex-col">
              <Bone className="w-40 t-body-strong" />
              <Bone className="w-24 t-caption" />
            </span>
            <Bone className="w-14 t-label" />
          </span>
        ))}
      </span>
    </div>
  );
}

/**
 * fish useRegistrationsList: the toasts in the mutation's own callbacks (core's rollback first), so
 * each change reports — two in flight, or the organizer already on another tab.
 */
function withToasts<TData, TError, TContext>(
  base: UseMutationOptions<TData, TError, string, TContext>,
  action: StatusAction,
  toast: ReturnType<typeof useSiteToast>,
): UseMutationOptions<TData, TError, string, TContext> {
  const success = confirmOf(action, '').success;
  return {
    ...base,
    onSuccess: (...args) => {
      toast(success, 'success');
      return base.onSuccess?.(...args);
    },
    onError: (...args) => {
      toast(statusErrorMessage(args[0]), 'danger');
      return base.onError?.(...args);
    },
  };
}
