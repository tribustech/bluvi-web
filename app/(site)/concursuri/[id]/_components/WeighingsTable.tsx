'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useQueries, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import type { CompetitionWithMyStatus, DetailRegistration } from '@/core/competitions';
import { weighingsQuery, type AllocatedParticipantsResponse, type WeighingByStand } from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { sectorFill } from '@/components/ranking/sector';
import { RANKING_HEAD } from '@/components/ranking/tableHead';
import { Avatar, FaceStack } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import { shortDateTime } from './dates';
import { echoes } from './names';
import { isOfflineEmpty } from './offline';
import { QueryRetry } from './QueryRetry';
import { formatKg } from './ranking';
import { PAGE_RETRY } from './retry-policy';
import { nationalStandLabel } from './stand';
import { sortedSectors } from './standOrder';
import { Bone } from './tabParts';
import { photo, useBrokenImages } from './brokenImages';
import type { WeighingPersonHook } from './WeighingDetail';

/*
 * Cântare from 1280 (owner rule 14, ROADMAP §4b): not the phone's stand cards stretched, but every
 * weighing in one table — Stand, Pescar (with the face), Cântar, Interval, Capturi, Kg, Stare — and
 * the weighing's detail in the docked side panel beside it (WeighingDetail, the same surface the
 * phone opens as a sheet). Two orders: «Pe standuri» (fish's order: sector by sector, a stand's
 * weighings under it, its stand and angler cells spanning them, a «Total stand» line under a stand
 * weighed more than once) and «Cronologic» (the newest first, each weighing numbered in the
 * competition's order: «#14»).
 *
 * The table is a fixed layout (every column its width, the angler's name cut short), so it never
 * outgrows its box. Its widths follow the box it is given (measured), not whether a panel is open:
 * under NARROW_BELOW the narrow widths and the interval on two lines (day, then the hours); wider,
 * the one-line interval, and the angler's column stops at PESCAR_MAX_PX so the numbers stay near
 * the names (the rest is shared by every column) — never the phone list stretched across 1900px.
 * Stands in the wide views' order (standOrder.ts: sectors by name, stands naturally), as
 * Participanți lists them; a team competition's angler column is «Echipă», as there.
 * Sector rows only when a sector holds two stands or more on average (a 24-sector individual is one
 * table, the sector in each stand's stripe). The stands without a weighing are one compact row per
 * sector («Niciun cântar încă» and their stand chips), never a full row each.
 *
 * Which stands are read: signed in, the summary names the stands that have weighings (the others
 * have none, with no request); signed out (no summary grant) or when the summary failed, every stand
 * — a few at a time (MAX_READS in flight), never a burst of one request per stand. Until that is
 * known (session or summary still loading) nothing is read (parity cantare.c2) and the rows are
 * bones. A stand whose read fails says so in its row, with its retry; the others stay.
 *
 * Feeder: the weighings are one leg's (`round`); the caption names it and, with more than one leg,
 * a «Manșa N» switch sits next to the order switch.
 */

export type StandReads = ReadonlySet<string> | 'all' | null;

type StandEntry = {
  sectorName: string;
  standId: string;
  /** «1», NC «A3(12)». */
  label: string;
  /** The stand as the person popover names it: NC its own label («A3(12)»), else null (the registration's «Sector A · Stand 12»). */
  personLabel: string | null;
  alloc: AllocatedParticipantsResponse[string] | null;
  registration: DetailRegistration | null;
};

/** Stand weighing reads in flight at once (signed out every stand is read). */
const MAX_READS = 4;

const COLUMNS = ['Stand', 'Pescar', 'Cântar', 'Interval', 'Capturi', 'Kg', 'Stare'] as const;
type Column = (typeof COLUMNS)[number];
const RIGHT = new Set<Column>(['Capturi', 'Kg']);
/** The table's box under which the narrow widths (NARROW) and the two-line interval are used. */
const NARROW_BELOW = 1000;
/** The wide widths' fixed columns, in px (WIDTH without Pescar: 22+26+44+20+28+28 spacing steps). */
const WIDE_FIXED_PX = 672;
/** The angler's column at most (w-md, 28rem): past it the numbers would drift away from the names. */
const PESCAR_MAX_PX = 448;
/** The fixed widths (Pescar takes the rest, up to PESCAR_MAX_PX); in a narrow box, NARROW. */
const WIDTH: Record<Column, string> = {
  Stand: 'w-22',
  Pescar: '',
  Cântar: 'w-26',
  Interval: 'w-44',
  Capturi: 'w-20',
  Kg: 'w-28',
  Stare: 'w-28',
};
const NARROW: Partial<Record<Column, string>> = { Cântar: 'w-24', Interval: 'w-28', Kg: 'w-24', Stare: 'w-24' };

/** A cell's frame; CELL adds the usual padding and alignment (cn does not merge: one of each). */
const LINE = 'border-t border-hairline px-3';
const CELL = `${LINE} py-2 align-middle`;
/** A weighing row's cells: the hover tint, or the open weighing's mark (on the cells, so it is the whole row). */
const tintOf = (selected: boolean) => (selected ? 'bg-accent-tint' : 'bg-surface group-hover/row:bg-soft-fill');

type Leg = { current: number; count: number; onChange: (leg: number) => void };

export function WeighingsTable({
  t,
  competition,
  allocated,
  reads,
  leg,
  decimals,
  isNc,
  docked,
  selected,
  onWeighing,
  person,
}: {
  /** ≥1024: the angler cell opens the person popover (owner rule 17); the row still opens the weighing. */
  person?: WeighingPersonHook;
  t: Transport;
  competition: CompetitionWithMyStatus;
  allocated: AllocatedParticipantsResponse | undefined;
  /** The stands to read (null: not known yet — the rows stay bones). */
  reads: StandReads;
  /** Feeder: the leg shown (and how many there are). */
  leg?: Leg;
  decimals: number;
  isNc: boolean;
  /** The detail is docked beside the table: the narrow widths until the box is measured. */
  docked: boolean;
  /** The weighing whose detail is open (its row is marked). */
  selected: string | null;
  onWeighing: (standId: string, weighingId: string) => void;
}) {
  const [order, setOrder] = useState<'stands' | 'recent'>('stands');
  const [tableRef, broken] = useBrokenImages<HTMLDivElement>();
  const rootRef = useRef<HTMLDivElement>(null);
  const box = useBoxWidth(rootRef);
  const narrow = box == null ? docked : box < NARROW_BELOW;
  const pescarCapped = !narrow && box != null && box - WIDE_FIXED_PX > PESCAR_MAX_PX;
  const team = competition.competitionType === 'team';
  const qc = useQueryClient();
  const round = leg?.current;
  const registrations = useMemo(() => new Map(competition.registrations.map(r => [r.documentId, r])), [competition.registrations]);
  const sectors = useMemo(
    () =>
      sortedSectors(competition.sectors).map(sector => ({
        sector,
        stands: sector.stands.map<StandEntry>(stand => {
          const alloc = allocated?.[stand.documentId] ?? null;
          const label = isNc ? nationalStandLabel(sector.name, alloc?.sectorDrawPosition, stand.name) : stand.name;
          return {
            sectorName: sector.name,
            standId: stand.documentId,
            label,
            personLabel: isNc ? label : null,
            alloc,
            registration: alloc ? (registrations.get(alloc.registrationId) ?? null) : null,
          };
        }),
      })),
    [competition.sectors, allocated, registrations, isNc],
  );
  const stands = useMemo(() => sectors.flatMap(s => s.stands), [sectors]);
  // Sector rows only when they group something (as Participanți: two stands or more per sector on average).
  const grouped = sectors.length > 1 && stands.length >= sectors.length * 2;
  const isRead = (standId: string) => reads === 'all' || (reads !== null && reads.has(standId));

  // A few reads at a time, in the table's order: a stand's read starts when a slot frees up (the
  // queries are observed, so this render runs again each time one settles).
  const enabled = new Set<string>();
  let inFlight = 0;
  for (const s of stands) {
    if (!isRead(s.standId)) continue;
    const status = qc.getQueryState(weighingsQuery(t, competition.documentId, s.standId, { round }).queryKey)?.status;
    if (status === 'success' || status === 'error') enabled.add(s.standId);
    else if (inFlight < MAX_READS) {
      enabled.add(s.standId);
      inFlight++;
    }
  }
  const queries = useQueries({
    queries: stands.map(s => ({
      ...weighingsQuery(t, competition.documentId, s.standId, { enabled: enabled.has(s.standId), round }),
      ...PAGE_RETRY,
    })),
  });
  const byStand = new Map(stands.map((s, i) => [s.standId, queries[i]]));
  const stateOf = (standId: string): StandState => {
    if (reads === null) return 'loading';
    if (!isRead(standId)) return 'empty';
    const q = byStand.get(standId)!;
    if (q.data?.length) return 'weighed';
    if (isOfflineEmpty(q) || (q.isError && !q.data)) return 'failed';
    if (q.isPending) return 'loading';
    return 'empty';
  };
  const pending = stands.some(s => stateOf(s.standId) === 'loading');
  const loaded = stands.flatMap(s => byStand.get(s.standId)?.data ?? []);

  // Switching the order keeps the open weighing in view (its row moves).
  const firstOrder = useRef(true);
  useEffect(() => {
    if (firstOrder.current) {
      firstOrder.current = false;
      return;
    }
    if (!selected) return;
    rootRef.current?.querySelector(`[data-weighing="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: 'nearest' });
    // The order only: a newly opened weighing is the reader's own press, already in view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const count = pending ? 'Se încarcă cântarele…' : loaded.length === 1 ? '1 cântar' : `${loaded.length} cântare`;
  const groups = grouped
    ? sectors.map(({ sector, stands: sectorStands }) => ({ key: sector.documentId, sector: sector.name, stands: sectorStands }))
    : [{ key: 'toate', sector: null, stands }];

  return (
    <div ref={rootRef} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="t-caption text-muted" aria-live="polite">
          {leg ? `Manșa ${leg.current} · ` : null}
          {count} · {stands.length === 1 ? '1 stand' : `${stands.length} standuri`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {leg && leg.count > 1 ? (
            <Segmented
              label="Manșa cântarelor"
              value={leg.current}
              options={Array.from({ length: leg.count }, (_, i) => [i + 1, `Manșa ${i + 1}`] as const)}
              onChange={leg.onChange}
            />
          ) : null}
          <Segmented
            label="Ordinea cântarelor"
            value={order}
            options={[
              ['stands', 'Pe standuri'],
              ['recent', 'Cronologic'],
            ]}
            onChange={setOrder}
          />
        </div>
      </div>
      <div ref={tableRef} className="overflow-x-auto rounded-card bg-surface shadow-e0 [scrollbar-width:thin]" data-weighings-scroll>
        <table className="w-full min-w-180 table-fixed border-separate border-spacing-0 text-left tabular-nums">
          <caption className="sr-only">
            Cântarele concursului{team ? ', pe echipe' : ''}{leg ? `, manșa ${leg.current},` : ''} {order === 'stands' ? 'pe standuri' : 'în ordine cronologică, cele mai noi întâi'}
          </caption>
          <colgroup>
            {COLUMNS.map(col => (
              <col key={col} className={col === 'Pescar' ? (pescarCapped ? 'w-md' : undefined) : (narrow && NARROW[col]) || WIDTH[col]} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLUMNS.map((col, i) => (
                <th
                  key={col}
                  scope="col"
                  className={cn(
                    'h-10 px-3 t-label whitespace-nowrap',
                    RANKING_HEAD,
                    RIGHT.has(col) && 'text-right',
                    i === 0 && 'rounded-tl-card pl-[18px]',
                    i === COLUMNS.length - 1 && 'rounded-tr-card',
                  )}
                >
                  {col === 'Pescar' && team ? 'Echipă' : col}
                </th>
              ))}
            </tr>
          </thead>
          {order === 'stands' ? (
            groups.map(group => {
              const by = (state: StandState) => group.stands.filter(s => stateOf(s.standId) === state);
              const shown = group.stands.filter(s => {
                const state = stateOf(s.standId);
                return state === 'weighed' || state === 'failed';
              });
              const loading = by('loading');
              const empty = by('empty');
              return (
                <tbody key={group.key}>
                  {group.sector != null ? (
                    <tr>
                      <th colSpan={COLUMNS.length} scope="colgroup" className="h-9 border-t border-hairline bg-soft-fill px-4 text-left">
                        <span className="flex items-center gap-2 t-label text-ink">
                          <SectorDot name={group.sector} />
                          Sector {group.sector}
                          <span className="font-normal text-muted">· {group.stands.length === 1 ? '1 stand' : `${group.stands.length} standuri`}</span>
                        </span>
                      </th>
                    </tr>
                  ) : null}
                  {shown.map(stand => (
                    <StandRows
                      key={stand.standId}
                      stand={stand}
                      query={byStand.get(stand.standId)!}
                      decimals={decimals}
                      narrow={narrow}
                      broken={broken}
                      selected={selected}
                      onWeighing={onWeighing}
                      person={person}
                    />
                  ))}
                  {loading.length ? <BoneRows count={Math.min(3, loading.length)} /> : null}
                  {empty.length ? <EmptyStands stands={empty} withSector={group.sector == null} /> : null}
                </tbody>
              );
            })
          ) : (
            <RecentRows stands={stands} byStand={byStand} pending={pending} decimals={decimals} narrow={narrow} broken={broken} selected={selected} onWeighing={onWeighing} person={person} />
          )}
        </table>
      </div>
    </div>
  );
}

type StandState = 'loading' | 'failed' | 'empty' | 'weighed';

/** The element's width, followed as it changes (null until measured). */
function useBoxWidth(ref: RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-control bg-soft-fill p-0.5">
      {options.map(([v, text]) => (
        <button
          key={String(v)}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            'cursor-pointer rounded-control px-3 py-1.5 t-label whitespace-nowrap transition-colors duration-(--duration-fast)',
            value === v ? 'bg-surface text-ink shadow-e0' : 'text-muted hover:text-ink',
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function SectorDot({ name, small }: { name: string; small?: boolean }) {
  const fill = sectorFill(name, 'var(--color-accent)');
  return <span aria-hidden className={cn('shrink-0 rounded-full', small ? 'size-2' : 'size-2.5', fill.className)} style={fill.style} />;
}

/** Rows not known yet: the table's shape in grey. */
function BoneRows({ count }: { count: number }) {
  return Array.from({ length: count }, (_, i) => (
    <tr key={`bone-${i}`} aria-hidden>
      {COLUMNS.map(col => (
        <td key={col} className={cn(CELL, 'h-13', col === 'Stand' && 'pl-[18px]')}>
          {col === 'Pescar' ? (
            <span className="flex items-center gap-2.5">
              <span className="size-8 shrink-0 animate-shimmer rounded-full" />
              <Bone className="w-32 t-body" />
            </span>
          ) : (
            <Bone className={cn('t-body', RIGHT.has(col) ? 'ms-auto w-10' : 'w-12')} />
          )}
        </td>
      ))}
    </tr>
  ));
}

/**
 * The stands without a weighing (the summary lists none, or their read came back empty): one
 * compact row, their stands as chips — the anchor a `?stand=` link scrolls to is the chip.
 */
function EmptyStands({ stands, withSector }: { stands: StandEntry[]; withSector: boolean }) {
  return (
    <tr>
      <td colSpan={COLUMNS.length} className={cn(LINE, 'py-2.5 pl-[18px] align-middle')}>
        <span className="flex items-start gap-3">
          <span className="shrink-0 py-0.5 t-caption text-muted">Niciun cântar încă</span>
          <ul aria-label={stands.length === 1 ? 'Standul fără cântar' : 'Standurile fără cântar'} className="flex min-w-0 flex-wrap gap-1.5">
            {stands.map(stand => (
              <li
                key={stand.standId}
                id={`stand-${stand.standId}`}
                className="inline-flex scroll-mt-40 items-center gap-1 rounded-badge bg-soft-fill px-2 py-0.5 t-caption text-ink-2"
              >
                {withSector ? <SectorDot name={stand.sectorName} small /> : null}
                <span className="sr-only">Stand </span>
                {stand.label}
              </li>
            ))}
          </ul>
        </span>
      </td>
    </tr>
  );
}

/**
 * One stand weighed at least once (its weighings; the stand and angler cells span them, and a
 * «Total stand» line closes a stand weighed more than once), or one whose read failed (with its retry).
 */
function StandRows({
  stand,
  query,
  decimals,
  narrow,
  broken,
  selected,
  onWeighing,
  person,
}: {
  person?: WeighingPersonHook;
  broken: ReadonlySet<string>;
  stand: StandEntry;
  query: UseQueryResult<WeighingByStand[]>;
  decimals: number;
  narrow: boolean;
  selected: string | null;
  onWeighing: (standId: string, weighingId: string) => void;
}) {
  const weighings = query.data;
  if (!weighings?.length) {
    return (
      <tr id={`stand-${stand.standId}`} className="scroll-mt-40">
        <StandCell stand={stand} tint="bg-surface" />
        <AnglerCell stand={stand} broken={broken} tint="bg-surface" person={person} />
        <td colSpan={COLUMNS.length - 2} className={CELL}>
          <span className="flex items-center gap-3">
            <span className="t-caption text-ink-2">Cântarele standului nu au putut fi încărcate.</span>
            <QueryRetry fetching={query.isFetching} failed onRetry={() => void query.refetch()} size="compact" />
          </span>
        </td>
      </tr>
    );
  }
  const multi = weighings.length > 1;
  const total = sumKg(weighings);
  // Spanning a stand weighed more than once, the stand cells stay white; alone, they take the row's tint.
  const lead = (tint: string) => (
    <>
      <StandCell stand={stand} rowSpan={multi ? weighings.length + 1 : undefined} tint={multi ? 'bg-surface' : tint} />
      <AnglerCell stand={stand} rowSpan={multi ? weighings.length + 1 : undefined} broken={broken} tint={multi ? 'bg-surface' : tint} person={person} />
    </>
  );
  return (
    <>
      {weighings.map((w, i) => (
        <WeighingRow
          key={w.documentId}
          weighing={w}
          label={<>Cântar {i + 1}</>}
          decimals={decimals}
          narrow={narrow}
          selected={selected === w.documentId}
          onPress={() => onWeighing(stand.standId, w.documentId)}
          id={i === 0 ? `stand-${stand.standId}` : undefined}
          lead={i === 0 ? lead : undefined}
          edge={multi}
        />
      ))}
      {multi ? (
        <tr>
          <td colSpan={3} className={cn(LINE, 'py-1.5 text-right align-middle t-caption text-muted')}>
            Total stand
          </td>
          <td className={cn(LINE, 'py-1.5 text-right align-middle whitespace-nowrap')}>
            <Kg value={total} decimals={decimals} />
          </td>
          <td className={cn(LINE, 'py-1.5')} />
        </tr>
      ) : null}
    </>
  );
}

/** The newest weighings first, every stand together (stands not loaded yet: bones at the end). */
function RecentRows({
  stands,
  byStand,
  pending,
  decimals,
  narrow,
  broken,
  selected,
  onWeighing,
  person,
}: {
  person?: WeighingPersonHook;
  broken: ReadonlySet<string>;
  stands: StandEntry[];
  byStand: Map<string, UseQueryResult<WeighingByStand[]>>;
  pending: boolean;
  decimals: number;
  narrow: boolean;
  selected: string | null;
  onWeighing: (standId: string, weighingId: string) => void;
}) {
  // Numbered in the competition's order (#1 the first weighing started), listed newest first.
  const ordered = stands.flatMap(stand => (byStand.get(stand.standId)?.data ?? []).map(w => ({ stand, w }))).sort((a, b) => time(a.w) - time(b.w));
  const rows = ordered.map((row, i) => ({ ...row, n: i + 1 })).reverse();
  return (
    <tbody>
      {rows.map(({ stand, w, n }) => (
        <WeighingRow
          key={w.documentId}
          weighing={w}
          label={
            <>
              <span className="sr-only">Cântarul </span>#{n}
            </>
          }
          decimals={decimals}
          narrow={narrow}
          selected={selected === w.documentId}
          onPress={() => onWeighing(stand.standId, w.documentId)}
          lead={tint => (
            <>
              <StandCell stand={stand} withSector tint={tint} />
              <AnglerCell stand={stand} broken={broken} tint={tint} person={person} />
            </>
          )}
        />
      ))}
      {pending ? <BoneRows count={3} /> : null}
      {!pending && rows.length === 0 ? (
        <tr>
          <td colSpan={COLUMNS.length} className={cn(LINE, 'py-6 text-center align-middle t-body text-muted')}>
            Niciun cântar încă.
          </td>
        </tr>
      ) : null}
    </tbody>
  );
}

/**
 * «08.05» and «17:55 – 18:00» (one line: «08.05, 17:55 – 18:00», the end's day only when it is not
 * the start's); on two lines a second day joins the first line («07.05 – 11.05» / «16:28 – 12:42»).
 */
function Interval({ start, end, twoLines }: { start: string; end: string | null; twoLines: boolean }) {
  const [startDay, startClock] = shortDateTime(start).split(', ');
  const [endDay, endClock] = end ? shortDateTime(end).split(', ') : [startDay, null];
  const sameDay = startDay === endDay;
  const to = (
    <>
      {' '}
      <span aria-hidden>–</span>
      <span className="sr-only">până la</span>{' '}
    </>
  );
  if (twoLines) {
    return (
      <>
        <span className="block whitespace-nowrap">
          {startDay}
          {sameDay ? null : (
            <>
              {to}
              {endDay}
            </>
          )}
        </span>
        <span className="block t-caption whitespace-nowrap">
          {startClock}
          {to}
          {endClock ?? 'în curs'}
        </span>
      </>
    );
  }
  return (
    <>
      {startDay}, {startClock}
      {to}
      {endClock == null ? 'în curs' : sameDay ? endClock : `${endDay}, ${endClock}`}
    </>
  );
}

const time = (w: WeighingByStand) => (w.startDate ? Date.parse(w.startDate) : 0);
const sumKg = (weighings: WeighingByStand[]) => weighings.reduce((acc, w) => acc + w.catches.reduce((a, c) => a + c.weight, 0), 0);

/**
 * A weighing: its label («Cântar N» on a stand, «#N» in the timeline) is the row's button (its hit
 * area covers the row), the detail opens in the side panel. The hover tint and the open weighing's
 * mark sit on the cells, so the row reads as one (under a stand spanning several weighings, whose
 * cells stay white, the label's cell adds a 3px accent edge).
 */
function WeighingRow({
  weighing: w,
  label,
  decimals,
  narrow,
  selected,
  onPress,
  id,
  lead,
  edge,
}: {
  weighing: WeighingByStand;
  label: ReactNode;
  decimals: number;
  /** A narrow table: the interval on two lines. */
  narrow: boolean;
  selected: boolean;
  onPress: () => void;
  id?: string;
  /** The stand and angler cells, given the row's tint. */
  lead?: (tint: string) => ReactNode;
  /** The stand cells span other weighings (they stay white): the open one gets an accent edge. */
  edge?: boolean;
}) {
  const finished = w.weighingStatus === 'finished';
  const tint = tintOf(selected);
  const cell = cn(CELL, tint, 'transition-colors duration-(--duration-fast)');
  return (
    <tr id={id} data-weighing={w.documentId} data-selected={selected || undefined} className="group/row relative scroll-mt-40 t-body">
      {lead?.(tint)}
      <td className={cn(cell, selected && edge && 'shadow-[inset_3px_0_0_var(--color-accent)]')}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <button
            type="button"
            onClick={onPress}
            aria-haspopup="dialog"
            aria-current={selected || undefined}
            className="cursor-pointer rounded-control t-body-strong whitespace-nowrap text-ink after:absolute after:inset-0 after:content-[''] hover:underline"
          >
            {label}
          </button>
          {w.weighingType === 'extra' ? <Badge color="yellow">Extra</Badge> : null}
        </span>
      </td>
      <td className={cn(cell, 'text-ink-2', !narrow && 'whitespace-nowrap')}>
        {w.startDate ? <Interval start={w.startDate} end={w.endDate} twoLines={narrow} /> : '–'}
      </td>
      <td className={cn(cell, 'text-right')}>{w.catches.length}</td>
      <td className={cn(cell, 'text-right whitespace-nowrap')}>
        <Kg value={sumKg([w])} decimals={decimals} />
      </td>
      <td className={cell}>
        <StatusPill tone={finished ? 'success' : 'live'}>{finished ? 'Terminat' : 'În curs'}</StatusPill>
      </td>
    </tr>
  );
}

/** The number, then the unit apart, smaller and muted (owner rule 10). */
function Kg({ value, decimals, className }: { value: number; decimals: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-baseline gap-1', className)}>
      <span className="t-body-strong text-ink">{formatKg(value, decimals)}</span>
      <span className="t-caption text-muted">kg</span>
    </span>
  );
}

function StandCell({ stand, rowSpan, withSector, tint }: { stand: StandEntry; rowSpan?: number; withSector?: boolean; tint: string }) {
  const fill = sectorFill(stand.sectorName, 'var(--color-accent)');
  return (
    <th scope="row" rowSpan={rowSpan} className={cn(LINE, tint, 'relative z-above pl-[18px] text-left whitespace-nowrap transition-colors duration-(--duration-fast)', rowSpan ? 'pt-3 pb-2 align-top' : 'py-2 align-middle')}>
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} />
      <span className="sr-only">Sector {stand.sectorName}, </span>
      <span className="t-num-18 text-ink">
        <span className="sr-only">Stand </span>
        {stand.label}
      </span>
      {withSector ? <span className="block t-caption text-muted">Sector {stand.sectorName}</span> : null}
    </th>
  );
}

/**
 * The angler: the face(s) and one line — the team, or the people. A guest team's members line shows
 * only when it says more than its name (names.ts echoes); then the longer of the two is kept. From
 * 1024 (`person`) the cell's content is its own button: it opens the person popover (owner rule 17)
 * and the press stops there, so it does not also open the row's weighing.
 */
function AnglerCell({
  stand,
  rowSpan,
  broken,
  tint,
  person,
}: {
  stand: StandEntry;
  rowSpan?: number;
  broken: ReadonlySet<string>;
  tint: string;
  person?: WeighingPersonHook;
}) {
  const { alloc, registration } = stand;
  const people = registration?.participants ?? [];
  const names = alloc ? alloc.guestName || alloc.participants.map(p => p.name).join(', ') || '-' : '-';
  const team = alloc?.teamName || null;
  const echo = !!team && echoes(names, team);
  const title = team ? (echo && names.length > team.length ? names : team) : names;
  const subtitle = team && !echo && names !== '-' ? names : null;
  const content = (
    <>
      {!alloc ? null : people.length > 1 ? (
        <FaceStack size={32} people={people.slice(0, 3).map(p => ({ name: p.username, src: photo(p.avatar?.url, broken) }))} overflow={Math.max(0, people.length - 3)} />
      ) : people.length === 1 ? (
        <Avatar name={people[0].username} src={photo(people[0].avatar?.url, broken)} size={32} />
      ) : (
        <Avatar name={title} size={32} tone="neutral" />
      )}
      <span className="flex min-w-0 flex-col">
        <span title={title} className={cn('truncate', alloc ? 't-body-strong text-ink' : 't-body text-muted', person && 'decoration-accent-tint-3 underline-offset-4 group-hover/who:underline')}>
          {title}
        </span>
        {subtitle ? (
          <span title={subtitle} className="truncate t-caption text-muted">
            {subtitle}
          </span>
        ) : null}
      </span>
    </>
  );
  const opens = !!alloc && !!person?.has(alloc.registrationId);
  return (
    <td rowSpan={rowSpan} className={cn(LINE, tint, 'relative z-above py-2 transition-colors duration-(--duration-fast)', rowSpan ? 'align-top' : 'align-middle')}>
      {opens && alloc && person ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={person.openId === alloc.registrationId}
          data-angler={alloc.registrationId}
          onClick={e => {
            e.stopPropagation();
            person.open(alloc.registrationId, e.currentTarget, stand.personLabel);
          }}
          className="group/who -mx-1.5 -my-1 flex max-w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-control px-1.5 py-1 text-left hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
        >
          {content}
        </button>
      ) : (
        <span className="flex min-w-0 items-center gap-2.5">{content}</span>
      )}
    </td>
  );
}
