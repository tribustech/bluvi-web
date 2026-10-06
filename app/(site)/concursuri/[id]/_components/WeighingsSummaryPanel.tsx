'use client';

import { useId, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { ChevronRightIcon, CursorArrowRaysIcon } from '@heroicons/react/24/outline';
import type { CompetitionWithMyStatus } from '@/core/competitions';
import { weighingsQuery, type AllocatedParticipantsResponse, type WeighingByStand } from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { sectorFill } from '@/components/ranking/sector';
import { InlineNumber, SignatureNumber } from '@/components/ui/SignatureNumber';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { DOCKED_PANEL } from './ContextSurface';
import { shortDateTime } from './dates';
import { formatKg } from './ranking';
import { nationalStandLabel } from './stand';
import { sortedSectors } from './standOrder';
import type { StandReads } from './WeighingsTable';
import { Bone } from './tabParts';

/*
 * Cântare from 1440 (owner rule 14: a table plus a detail side panel): the panel's column is part of
 * the layout at rest, not only after a press. Until a weighing is pressed it holds the
 * competition's weighings at a glance — how many, their catches and kg (the leg's, on a feeder), the
 * weighings still in progress and the latest one (each opens its detail, which then takes this
 * column) — and says the table's rows open a weighing. Same width and place as the docked detail
 * (SidePanel, 420px), so nothing moves when one replaces the other. 1280–1439 keeps the detail
 * docked on a press only (the table needs the width).
 *
 * It reads nothing itself: it observes the table's per-stand reads in the query cache (enabled:
 * false), so its numbers are the table's, as they arrive. While the table's reads run, bones.
 */

type Entry = { standId: string; sectorName: string; label: string; who: string };
type Row = { entry: Entry; w: WeighingByStand };

export function WeighingsSummaryPanel({
  t,
  competition,
  allocated,
  reads,
  round,
  isNc,
  decimals,
  onWeighing,
}: {
  t: Transport;
  competition: CompetitionWithMyStatus;
  allocated: AllocatedParticipantsResponse | undefined;
  reads: StandReads;
  /** Feeder: the leg the table shows. */
  round?: number;
  isNc: boolean;
  decimals: number;
  onWeighing: (standId: string, weighingId: string) => void;
}) {
  const titleId = useId();
  const entries = useMemo<Entry[]>(
    () =>
      sortedSectors(competition.sectors).flatMap(sector =>
        sector.stands.map(stand => {
          const alloc = allocated?.[stand.documentId] ?? null;
          const names = alloc ? alloc.guestName || alloc.participants.map(p => p.name).join(', ') || '-' : '-';
          return {
            standId: stand.documentId,
            sectorName: sector.name,
            label: isNc ? nationalStandLabel(sector.name, alloc?.sectorDrawPosition, stand.name) : stand.name,
            who: alloc?.teamName || names,
          };
        }),
      ),
    [competition.sectors, allocated, isNc],
  );
  const queries = useQueries({
    queries: entries.map(e => weighingsQuery(t, competition.documentId, e.standId, { enabled: false, round })),
  });
  const isRead = (standId: string) => reads === 'all' || (reads !== null && reads.has(standId));
  const pending = reads === null || entries.some((e, i) => isRead(e.standId) && queries[i].status === 'pending');
  const rows: Row[] = entries.flatMap((entry, i) => (queries[i].data ?? []).map(w => ({ entry, w })));
  const kg = rows.reduce((acc, r) => acc + r.w.catches.reduce((a, c) => a + c.weight, 0), 0);
  const catches = rows.reduce((acc, r) => acc + r.w.catches.length, 0);
  const byStart = [...rows].sort((a, b) => time(b.w) - time(a.w));
  const open = byStart.filter(r => r.w.weighingStatus !== 'finished');
  const latest = byStart.find(r => r.w.weighingStatus === 'finished') ?? null;
  const leg = round != null && (competition.roundsCount ?? 0) > 1 ? `Manșa ${round}` : null;

  return (
    <aside aria-labelledby={titleId} className={cn(DOCKED_PANEL, 'hidden w-105 max-w-full flex-col gap-5 overflow-y-auto bg-surface p-5 text-ink shadow-panel 2xl:flex')}>
      <header className="flex flex-col">
        <h2 id={titleId} className="t-title2">
          Rezumat cântare
        </h2>
        {leg ? <p className="t-caption text-muted">{leg}</p> : null}
      </header>
      {pending ? (
        <div role="status" aria-label="Se încarcă rezumatul cântarelor" className="flex flex-col gap-4">
          <span aria-hidden className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map(i => (
              <span key={i} className="flex flex-col rounded-control bg-page p-3">
                <Bone className="w-12 t-num-26" />
                <Bone className="w-16 t-caption" />
              </span>
            ))}
          </span>
          <span aria-hidden className="h-16 animate-shimmer rounded-control" />
        </div>
      ) : rows.length === 0 ? (
        <p className="t-body text-muted">Niciun cântar încă.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <Fact label="Cântare" value={String(rows.length)} />
            <Fact label="Capturi" value={String(catches)} />
            <Fact label="Total" value={formatKg(kg, decimals)} unit="kg" />
          </dl>
          {open.length ? (
            <section aria-label="Cântare în curs" className="flex flex-col gap-2">
              <h3 className="t-label text-ink-2">{open.length === 1 ? '1 cântar în curs' : `${open.length} cântare în curs`}</h3>
              <ul className="flex flex-col gap-2">
                {open.slice(0, 4).map(r => (
                  <li key={r.w.documentId}>
                    <WeighingLink row={r} decimals={decimals} onPress={() => onWeighing(r.entry.standId, r.w.documentId)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {latest ? (
            <section aria-label="Ultimul cântar încheiat" className="flex flex-col gap-2">
              <h3 className="t-label text-ink-2">Ultimul cântar încheiat</h3>
              <WeighingLink row={latest} decimals={decimals} onPress={() => onWeighing(latest.entry.standId, latest.w.documentId)} />
            </section>
          ) : null}
        </>
      )}
      <p className="mt-auto flex items-start gap-2 border-t border-hairline pt-4 t-caption text-muted">
        <CursorArrowRaysIcon aria-hidden className="size-4 shrink-0" />
        Alege un cântar din tabel ca să-i vezi capturile și istoricul.
      </p>
    </aside>
  );
}

const time = (w: WeighingByStand) => (w.startDate ? Date.parse(w.startDate) : 0);

function Fact({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex flex-col-reverse rounded-control bg-page p-3">
      <dt className="t-caption text-muted">{label}</dt>
      <dd className="min-w-0">
        <SignatureNumber value={value} unit={unit} size="fact" className="tabular-nums" />
      </dd>
    </div>
  );
}

/** A weighing at a glance: the stand (sector stripe), who is on it, its kg and state; pressed, its detail. */
function WeighingLink({ row: { entry, w }, decimals, onPress }: { row: Row; decimals: number; onPress: () => void }) {
  const fill = sectorFill(entry.sectorName, 'var(--color-accent)');
  const finished = w.weighingStatus === 'finished';
  const kg = w.catches.reduce((a, c) => a + c.weight, 0);
  return (
    <button
      type="button"
      onClick={onPress}
      aria-haspopup="dialog"
      className="relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-control bg-page py-2.5 pr-3 pl-4 text-left transition-colors duration-(--duration-fast) hover:bg-soft-fill"
    >
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate t-body-strong text-ink">
          <span className="sr-only">Sector {entry.sectorName}, </span>Stand {entry.label} · {entry.who}
        </span>
        <span className="t-caption text-muted">
          {w.startDate ? shortDateTime(w.startDate) : '–'} · {w.catches.length === 1 ? '1 captură' : `${w.catches.length} capturi`}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <InlineNumber value={formatKg(kg, decimals)} unit="kg" valueClassName="t-body-strong text-ink" />
        {finished ? null : <StatusPill tone="live">În curs</StatusPill>}
      </span>
      <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted" />
    </button>
  );
}
