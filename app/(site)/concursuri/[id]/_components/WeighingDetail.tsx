'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import {
  weighingByIdQuery,
  weighingRevisionsQuery,
  weighingsQuery,
  type AllocatedParticipantsResponse,
  type WeighingByStand,
  type WeighingDetailCatch,
  type WeighingRevision,
} from '@/core/organizer';
import { isApiError, type Transport } from '@/core/transport';
import { ErrorState } from '@/components/surfaces/StateCard';
import { Button } from '@/components/ui/Button';
import { InlineNumber } from '@/components/ui/SignatureNumber';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { ContextSurface, Spinner } from './ContextSurface';
import { QueryRetry } from './QueryRetry';
import { echoes } from './names';
import { formatKg } from './ranking';
import { PAGE_RETRY } from './retry-policy';
import { nationalStandLabel } from './stand';

/*
 * fish components/WeighingDetailSheet.tsx (parity competition-page.cantar-detaliu): one stand's
 * weighings, one at a time — who is on the stand, Anterior / «Cântar i / n» / Următor, the total and
 * its state, the catches; a weighing in progress refreshes itself every minute (and on
 * «Actualizează»), catches that arrive in a refresh are marked for 5 s; a weighing that was edited
 * opens its history («Istoric modificări», read only when that view opens).
 *
 * The surface is the kit `context` one (ContextSurface): a sheet on the phone, a dialog to 1279,
 * the docked side panel from 1280 beside the stands. Each opening starts on the pressed weighing
 * and on the weighing view (the parent remounts it with a new `key`).
 *
 * Emphasis: the stand block is a plain ground (no dashed outline: that reads as a placeholder), the
 * total is the one hero value in ink, catch weights are ink too; the accent is left to the controls.
 * A weighing that no longer exists (404, e.g. a notification's old link) says so with no retry; a
 * refresh that fails keeps the last total and says it may be out of date until a re-read succeeds.
 */

export type WeighingDetailTarget = {
  competitionId: string;
  standId: string;
  sectorName: string;
  standName: string;
  /** The weighing pressed (or named by the link). */
  weighingId: string;
  /** Feeder: the current leg (the stand's weighings are that leg's). */
  round?: number;
  /** Opened by the page's link on arrival (not a press): an overlay from 1280 (ContextSurface). */
  fromLink?: boolean;
};

const REFRESH_SECONDS = 60;
const NEW_CATCH_MS = 5000;

/**
 * Who is on the stand opens the person popover (owner rule 17, ≥1024): the parent's
 * usePersonPopover; left out below 1024 (the phone keeps the plain names).
 */
export type WeighingPersonHook = {
  open: (registrationId: string, anchor: HTMLElement, standLabel?: string | null) => void;
  openId: string | null;
  /** The registration exists on the competition (the popover can show it). */
  has: (registrationId: string) => boolean;
};

export function WeighingDetail({
  t,
  target,
  allocated,
  isNc,
  decimals,
  onClose,
  person,
}: {
  person?: WeighingPersonHook;
  t: Transport;
  target: WeighingDetailTarget | null;
  allocated: AllocatedParticipantsResponse | undefined;
  isNc: boolean;
  /** The competition's weight precision (weightDecimals). */
  decimals: number;
  onClose: () => void;
}) {
  return (
    <ContextSurface open={!!target} onClose={onClose} title="Detaliu cântar" overlay={!!target?.fromLink}>
      {target ? <Body t={t} target={target} allocated={allocated} isNc={isNc} decimals={decimals} person={person} /> : null}
    </ContextSurface>
  );
}

function Body({
  t,
  target,
  allocated,
  isNc,
  decimals,
  person,
}: {
  person?: WeighingPersonHook;
  t: Transport;
  target: WeighingDetailTarget;
  allocated: AllocatedParticipantsResponse | undefined;
  isNc: boolean;
  decimals: number;
}) {
  const [view, setView] = useState<'weighing' | 'revisions'>('weighing');
  // Which control opened the history: focus goes back to it when the reader returns.
  const [returnTo, setReturnTo] = useState<RevisionsTrigger | null>(null);
  const [currentId, setCurrentId] = useState(target.weighingId);
  // The stand's weighings (the same read as the open stand card): the pages to step through. A link
  // to a weighing the list does not hold (yet) shows that weighing alone, as fish's notification does.
  const listQ = useQuery({
    ...weighingsQuery(t, target.competitionId, target.standId, { round: target.round }),
    ...PAGE_RETRY,
  });
  const ids = useMemo(() => {
    const list = listQ.data?.map(w => w.documentId) ?? [];
    return list.includes(target.weighingId) ? list : [target.weighingId];
  }, [listQ.data, target.weighingId]);
  const index = Math.max(0, ids.indexOf(currentId));
  // The list is still being read (a notification link): the pager's row at its final height, never
  // a false «1 / 1»; a failed list keeps the one weighing and says the others did not load.
  const listPending = listQ.isPending && listQ.fetchStatus !== 'idle';
  const listFailed = listQ.isError && !listQ.data;
  const listItem = listQ.data?.find(w => w.documentId === currentId);

  // The neighbours are read ahead, so Anterior / Următor paint at once.
  const qc = useQueryClient();
  const prev = ids[index - 1];
  const next = ids[index + 1];
  useEffect(() => {
    for (const id of [prev, next]) if (id) void qc.prefetchQuery(weighingByIdQuery(t, id));
  }, [qc, t, prev, next]);

  const alloc = allocated?.[target.standId] ?? null;
  const people = alloc ? alloc.guestName || alloc.participants.map(p => p.name).join(', ') : '';
  // A guest team whose members line only echoes its name (names.ts): the team name alone.
  const echo = !!alloc?.teamName && !!people && echoes(people, alloc.teamName);
  const label = isNc
    ? `Stand ${nationalStandLabel(target.sectorName, alloc?.sectorDrawPosition, target.standName)}`
    : `Sector ${target.sectorName}, Stand ${target.standName}`;

  // A new weighing in the pager starts on the weighing view (fish resets on every id change).
  const go = (next: number) => {
    setCurrentId(ids[next]);
    setView('weighing');
  };

  if (view === 'revisions') return <Revisions t={t} weighingId={currentId} decimals={decimals} onBack={() => setView('weighing')} />;
  const openRevisions = (from: RevisionsTrigger) => {
    setReturnTo(from);
    setView('revisions');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-card bg-page p-4">
        <p className="t-title2 text-ink">{label}</p>
        {alloc && person?.has(alloc.registrationId) ? (
          // ≥1024: who is on the stand opens their popover (faces, club, stats, profile).
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={person.openId === alloc.registrationId}
            onClick={e => person.open(alloc.registrationId, e.currentTarget, isNc ? label.replace(/^Stand /, '') : null)}
            className="-mx-2 flex cursor-pointer flex-col items-start gap-0.5 rounded-control px-2 py-1 text-left hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
          >
            {echo ? (
              <span className="t-heading text-accent-ink underline decoration-accent-tint-3 underline-offset-4">Echipa {alloc.teamName}</span>
            ) : (
              <>
                {alloc.teamName ? <span className="t-heading text-ink">Echipa {alloc.teamName}</span> : null}
                <span className="t-body text-accent-ink underline decoration-accent-tint-3 underline-offset-4">{people}</span>
              </>
            )}
          </button>
        ) : (
          <>
            {alloc?.teamName ? <p className="t-heading">Echipa {alloc.teamName}</p> : null}
            {alloc && !echo ? (
              <ul className="flex list-disc flex-col gap-0.5 pl-5 t-body text-ink-2">
                {alloc.guestName ? <li>{alloc.guestName}</li> : alloc.participants.map(p => <li key={p.documentId}>{p.name}</li>)}
              </ul>
            ) : null}
          </>
        )}
      </div>

      {listPending ? (
        <div role="status" aria-label="Se încarcă cântarele standului" className="flex items-center justify-between gap-3">
          <span aria-hidden className="h-9 w-24 animate-shimmer rounded-control" />
          <span aria-hidden className="h-4 w-20 animate-shimmer rounded-full" />
          <span aria-hidden className="h-9 w-24 animate-shimmer rounded-control" />
        </div>
      ) : listFailed ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="t-caption text-muted">Celelalte cântare nu au putut fi încărcate.</p>
          <QueryRetry fetching={listQ.isFetching} failed onRetry={() => void listQ.refetch()} size="compact" />
        </div>
      ) : ids.length > 1 ? (
        <nav aria-label="Cântarele standului" className="flex items-center justify-between gap-3">
          <PagerButton disabled={index === 0} onPress={() => go(index - 1)} icon={<ChevronLeftIcon />}>
            Anterior
          </PagerButton>
          <p className="t-body-strong text-ink-2 tabular-nums" aria-live="polite">
            Cântar {index + 1} / {ids.length}
          </p>
          <PagerButton disabled={index >= ids.length - 1} onPress={() => go(index + 1)} iconRight={<ChevronRightIcon />}>
            Următor
          </PagerButton>
        </nav>
      ) : (
        <p className="t-caption text-muted">Cântar 1 / 1</p>
      )}

      <Weighing
        key={currentId}
        t={t}
        weighingId={currentId}
        listItem={listItem}
        decimals={decimals}
        refocus={returnTo}
        onRefocused={() => setReturnTo(null)}
        onRevisions={openRevisions}
      />
    </div>
  );
}

/**
 * Anterior / Următor: at its end the arrow is off (aria-disabled, not the native `disabled`, so the
 * keyboard focus that just pressed it stays on it).
 */
function PagerButton({
  disabled,
  onPress,
  icon,
  iconRight,
  children,
}: {
  disabled: boolean;
  onPress: () => void;
  icon?: ReactNode;
  iconRight?: ReactNode;
  children: string;
}) {
  return (
    <Button
      variant="secondary"
      size="compact"
      icon={icon}
      iconRight={iconRight}
      aria-disabled={disabled || undefined}
      className={cn('min-w-22', disabled && 'cursor-not-allowed opacity-50')}
      onClick={() => {
        if (!disabled) onPress();
      }}
    >
      {children}
    </Button>
  );
}

type RevisionsTrigger = 'warning' | 'history';

function Weighing({
  t,
  weighingId,
  listItem,
  decimals,
  refocus,
  onRefocused,
  onRevisions,
}: {
  t: Transport;
  weighingId: string;
  /** The stand list's row for this weighing: its shape while the detail is read. */
  listItem: WeighingByStand | undefined;
  decimals: number;
  /** Back from the history: the control that opened it takes the focus again. */
  refocus: RevisionsTrigger | null;
  onRefocused: () => void;
  onRevisions: (from: RevisionsTrigger) => void;
}) {
  const q = useQuery({ ...weighingByIdQuery(t, weighingId), ...PAGE_RETRY });
  const weighing = q.data;
  const inProgress = weighing?.weighingStatus === 'started';
  const refetch = q.refetch;

  // «Se actualizează în m:ss»: from 1:00 down, a refetch at 0, then again (fish's countdown).
  const [seconds, setSeconds] = useState(REFRESH_SECONDS);
  useEffect(() => {
    if (!inProgress) return;
    const tick = setInterval(() => {
      setSeconds(s => {
        if (s <= 1) {
          void refetch();
          return REFRESH_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [inProgress, refetch]);

  // Catches a refresh brings in: marked (and animated in) for 5 s.
  const known = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    const catches = weighing?.catches;
    if (!catches) return;
    const ids = new Set(catches.map(c => c.documentId));
    if (known.current === null) {
      known.current = ids;
      return;
    }
    const added = catches.filter(c => !known.current!.has(c.documentId)).map(c => c.documentId);
    known.current = ids;
    if (!added.length) return;
    setFresh(new Set(added));
    const clear = setTimeout(() => setFresh(new Set()), NEW_CATCH_MS);
    return () => clearTimeout(clear);
  }, [weighing?.catches]);

  const warningRef = useRef<HTMLButtonElement>(null);
  const historyRef = useRef<HTMLButtonElement>(null);
  const loaded = !!weighing;
  useEffect(() => {
    if (!refocus || !loaded) return;
    (refocus === 'history' ? (historyRef.current ?? warningRef.current) : (warningRef.current ?? historyRef.current))?.focus();
    onRefocused();
  }, [refocus, loaded, onRefocused]);

  if (q.isPending) {
    // The list's row already knows the total, the state and how many catches: the detail's shape.
    return listItem ? (
      <WeighingSkeleton total={formatKg(listItem.catches.reduce((a, c) => a + c.weight, 0), decimals)} finished={listItem.weighingStatus === 'finished'} catches={listItem.catches.length} />
    ) : (
      <Spinner label="Se încarcă cântarul" />
    );
  }
  if (!weighing) {
    // Gone (deleted, or a link to an id that never was): a retry could never succeed (PAGE_RETRY
    // does not retry a 4xx either). The pager above still offers the stand's other weighings.
    if (isApiError(q.error) && q.error.status === 404) {
      return <ErrorState title="Cântarul nu mai există." description="Poate fi deschis un alt cântar al standului sau închis detaliul." />;
    }
    return (
      <ErrorState
        title="Cântarul nu a putut fi încărcat."
        action={<QueryRetry fetching={q.isFetching} failed onRetry={() => void refetch()} size="compact" />}
      />
    );
  }

  const total = formatKg(
    weighing.catches.reduce((a, c) => a + c.weight, 0),
    decimals,
  );
  const finished = weighing.weighingStatus === 'finished';
  const revisions = weighing.numberOfRevisions;
  const countdown = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="flex flex-col gap-4">
      {/* A re-read that failed keeps the last weighing: say it may be out of date until one succeeds. */}
      {q.isError ? (
        <p role="status" className="flex flex-wrap items-center gap-2 t-caption text-muted">
          Date posibil neactualizate ·
          <button
            type="button"
            onClick={() => {
              if (q.isFetching) return;
              void refetch();
              setSeconds(REFRESH_SECONDS);
            }}
            className="cursor-pointer rounded-control t-label text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
          >
            {q.isFetching ? 'Se reîncearcă…' : 'Reîncearcă'}
          </button>
        </p>
      ) : null}
      <TotalLine total={total} finished={finished} />

      {inProgress ? (
        <div className="flex items-center justify-between gap-3">
          <p className="t-caption text-muted tabular-nums">Se actualizează în {countdown}</p>
          <Button
            variant="secondary"
            size="compact"
            icon={q.isFetching ? <ArrowPathIcon className="animate-spin" /> : undefined}
            aria-busy={q.isFetching || undefined}
            aria-disabled={q.isFetching || undefined}
            onClick={() => {
              if (q.isFetching) return;
              void refetch();
              setSeconds(REFRESH_SECONDS);
            }}
          >
            {q.isFetching ? 'Se actualizează…' : 'Actualizează'}
          </Button>
        </div>
      ) : null}

      {revisions > 0 ? (
        <button
          ref={warningRef}
          type="button"
          onClick={() => onRevisions('warning')}
          className="flex cursor-pointer items-center gap-1.5 self-start rounded-control text-left t-body text-ink hover:underline focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          <ExclamationTriangleIcon aria-hidden className="size-4 shrink-0 text-status-danger-fg" />
          Acest cântar a avut {revisions === 1 ? 'o modificare' : `${revisions} modificări`}.
        </button>
      ) : null}
      {finished && revisions > 0 ? (
        <Button ref={historyRef} variant="outline" block onClick={() => onRevisions('history')}>
          Vezi istoric
        </Button>
      ) : null}

      <section aria-labelledby={`capturi-${weighing.documentId}`} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 id={`capturi-${weighing.documentId}`} className="t-body-strong text-muted">
            Capturi
          </h3>
          {weighing.weighingType === 'extra' ? <span className="t-body-strong text-muted">Extra-cântar</span> : null}
        </div>
        {weighing.catches.length ? (
          <ol className="flex flex-col gap-2">
            {weighing.catches.map((c, i) => (
              <CatchRow key={c.documentId} item={c} index={i} decimals={decimals} fresh={fresh.has(c.documentId)} />
            ))}
          </ol>
        ) : (
          <p className="t-caption text-muted">Acest cântar nu conține nicio captură.</p>
        )}
      </section>
    </div>
  );
}

/** The weighing while its detail is read, from the list's row: the total line and the catch rows. */
function WeighingSkeleton({ total, finished, catches }: { total: string; finished: boolean; catches: number }) {
  return (
    <div role="status" aria-label="Se încarcă cântarul" className="flex flex-col gap-4">
      <div aria-hidden>
        <TotalLine total={total} finished={finished} />
      </div>
      <div aria-hidden className="flex flex-col gap-2">
        <p className="t-body-strong text-muted">Capturi</p>
        {Array.from({ length: Math.max(1, catches) }, (_, i) => (
          <span key={i} className="relative block rounded-control bg-page px-3 py-1.5 t-heading">
            &nbsp;
            <span className="absolute inset-x-3 top-1/2 h-[0.62em] w-2/5 -translate-y-1/2 animate-shimmer rounded-full" />
          </span>
        ))}
      </div>
    </div>
  );
}

/** The weighing's one hero value: «Total:» then the kg in ink at title size, its state beside it. */
function TotalLine({ total, finished }: { total: string; finished: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="flex items-baseline gap-2">
        <span className="t-heading text-muted">Total:</span>{' '}
        <span className="t-title1 text-ink tabular-nums">
          {total} <span className="t-heading text-muted">kg</span>
        </span>
      </p>
      <StatusPill tone={finished ? 'success' : 'live'}>{finished ? 'Terminat' : 'În curs'}</StatusPill>
    </div>
  );
}

function CatchRow({ item, index, decimals, fresh }: { item: WeighingDetailCatch; index: number; decimals: number; fresh: boolean }) {
  return (
    <li
      data-new={fresh || undefined}
      className={cn(
        'flex items-baseline gap-1.5 rounded-control px-3 py-1.5 transition-[background-color,opacity,translate] duration-(--duration-slow) ease-slow',
        fresh ? 'bg-accent-tint-2 starting:translate-y-2 starting:opacity-0' : 'bg-page',
      )}
    >
      <span className="t-body text-muted tabular-nums">{index + 1}.</span>
      <span className="t-heading">
        {item.fishType?.Name ?? '-'}: <InlineNumber value={formatKg(item.weight, decimals)} unit="kg" valueClassName="t-heading text-ink" />
      </span>
      {fresh ? <span className="sr-only">(nouă)</span> : null}
    </li>
  );
}

/** fish WeighingDetailSheet `revisionsContent` + components/scale/RevisionCard.tsx. */
function Revisions({ t, weighingId, decimals, onBack }: { t: Transport; weighingId: string; decimals: number; onBack: () => void }) {
  const q = useQuery({ ...weighingRevisionsQuery(t, weighingId), retry: false });
  const sessions = useMemo(() => Object.entries(q.data ?? {}), [q.data]);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button ref={back} variant="secondary" size="compact" icon={<ChevronLeftIcon />} onClick={onBack}>
          Înapoi la cântar
        </Button>
        <h3 className="flex-1 t-title2">Istoric modificări</h3>
      </div>
      {q.isPending ? (
        <Spinner label="Se încarcă modificările" />
      ) : q.isError && !q.data ? (
        <ErrorState
          title="Eroare la încărcarea modificărilor."
          action={<QueryRetry fetching={q.isFetching} failed onRetry={() => void q.refetch()} size="compact" />}
        />
      ) : sessions.length === 0 ? (
        <p className="t-body-strong text-muted">Nu există modificări pentru acest cântar.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {sessions.map(([sessionId, revisions]) => (
            <li key={sessionId}>
              <RevisionCard sessionId={sessionId} revisions={revisions} decimals={decimals} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A revised catch: «• Crap 5,200 kg» — the competition's precision, the unit apart (owner rule 10). */
function RevisedCatch({ type, weight, decimals }: { type: string; weight: number; decimals: number }) {
  return (
    <span>
      • {type} <InlineNumber value={formatKg(weight, decimals)} unit="kg" valueClassName="t-body-strong" />
    </span>
  );
}

function RevisionCard({ sessionId, revisions, decimals }: { sessionId: string; revisions: WeighingRevision[]; decimals: number }) {
  return (
    <article className="flex flex-col gap-2 rounded-card bg-page p-4">
      <h4 className="t-heading text-ink">
        Modificarea {sessionId} [de {revisions[0]?.author?.username ?? '-'}]
      </h4>
      {revisions.map(r => {
        const added = r.state.added ?? [];
        const removed = r.state.removed ?? [];
        return (
          <div key={r.documentId ?? r.id} className="flex flex-col gap-1">
            {r.action === 'reopen' ? <p className="t-body-strong">Motiv: {r.state.reason ?? '-'}</p> : null}
            <p className="t-body-strong text-muted">
              {r.action === 'reopen' ? 'Redeschis' : 'Închis'} la {new Date(r.createdAt).toLocaleString('ro-RO')}
            </p>
            {r.action === 'closed' && (added.length > 0 || removed.length > 0) ? (
              <div className="flex justify-between gap-4">
                {added.length > 0 ? (
                  <div className="flex flex-col gap-0.5 t-body-strong text-status-success-fg">
                    <span>Adăugat:</span>
                    {added.map((c, i) => (
                      <RevisedCatch key={i} type={c.type} weight={c.weight} decimals={decimals} />
                    ))}
                  </div>
                ) : null}
                {removed.length > 0 ? (
                  <div className="flex flex-col gap-0.5 t-body-strong text-status-danger-fg">
                    <span>Șters:</span>
                    {removed.map((c, i) => (
                      <RevisedCatch key={i} type={c.type} weight={c.weight} decimals={decimals} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </article>
  );
}
