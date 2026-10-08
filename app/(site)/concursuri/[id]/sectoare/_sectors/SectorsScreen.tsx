'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Squares2X2Icon } from '@heroicons/react/24/outline';
import { competitionQuery, competitionsKeys, type CompetitionWithMyStatus } from '@/core/competitions';
import { allocateStandsToSectorsMutation } from '@/core/organizer';
import { formatCount } from '@/core/realtime/chat/format';
import { useLeaveGuard } from '@/components/account/profile-form/useLeaveGuard';
import { sectorFill } from '@/components/ranking/sector';
import { T4Spinner } from '@/components/templates/T4';
import { FlowActions, FlowAsideCard, FlowAsideSkeleton } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../../_shell/Toast';
import { ManagementFrame, useManagementTransport, type ManagementViewer } from '../../_organizer/ManagementFrame';
import {
  allocationsBody,
  applyEdits,
  initialSlots,
  isDirty,
  isEditable,
  placedStands,
  SAVED_MESSAGE,
  saveErrorMessage,
  sectorPalette,
  standNames,
  standOptions,
  standsPerSector,
  withEdit,
  type SlotEdits,
  type Slots,
} from './model';
import { SectorsBodySkeleton, SECTORS_TITLE, SECTORS_TITLE_ID } from './SectorsSkeleton';
import { SlotGrid } from './SlotGrid';
import { StandPickerDialog } from './StandPickerDialog';

/*
 * «Alocarea standurilor pe sectoare» (parity organizer.sectors c1–c8; fish
 * app/(app)/configure/sectors/[competitionId].tsx). The competition's author only (fish reaches it
 * from the author's menu; the frame's `author` gate shows a neutral page to anyone else).
 * - c1: the frame's loading (SectorsBodySkeleton) and error («Încearcă din nou» refetches the competition);
 * - c2: the title; unsaved changes are never dropped silently — the site's one leave dialog
 *   («Renunți la modificări?», as participant.register c20) holds the back link, in-app links,
 *   browser Back and unload;
 * - c3: not notStarted → the red dashed banner, inert slots, no «Salvează»;
 * - c4: «Nr. sectoare» / «Nr. max standuri per sector» (ceil(limit / sectors), 1 when unknown);
 * - c5–c7: SlotGrid + StandPickerDialog;
 * - c8: «Salvează» POSTs { allocations } (core allocateStandsToSectorsMutation), a spinner while it
 *   runs (the slots inert), then the toast, the competition refetched and back to its page — the
 *   editor's entry replaced, as fish's router.back(): browser Back never returns to it; an error
 *   toasts the server's message and keeps the edits.
 * The edits are a real diff over the competition (model SlotEdits, `${sectorId}:${index}` → stand),
 * applied over the latest data on every render: a refetch while dirty (the header's refresh, a
 * focus refetch, a co-editor) keeps the edits and shows everything else as the server has it — a
 * new sector with its stands, a new limit's slot count; an edit whose slot is gone is dropped.
 */

type Picking = { sectorId: string; index: number };

export function SectorsScreen({ competitionId, viewer }: { competitionId: string; viewer: ManagementViewer }) {
  const t = useManagementTransport();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useSiteToast();
  // The frame reads the same key: one request, shared.
  const competition = useQuery(competitionQuery(t, competitionId, { isAuthenticated: true }));
  const [edits, setEdits] = useState<SlotEdits>({});
  const [picking, setPicking] = useState<Picking | null>(null);
  const [saved, setSaved] = useState(false);
  const save = useMutation(allocateStandsToSectorsMutation(t));

  const data = competition.data;
  const initial = useMemo(() => (data ? initialSlots(data) : null), [data]);
  const slots = useMemo(() => (initial ? applyEdits(initial, edits) : null), [initial, edits]);
  const dirty = Boolean(initial && slots && isDirty(initial, slots));
  const { dialog: leaveDialog } = useLeaveGuard(dirty && !saved && Boolean(data && isEditable(data)));

  const back = routes.competition(competitionId);

  const onSave = () => {
    if (!data || !slots || save.isPending) return;
    save.mutate(
      { competitionId, body: allocationsBody(data, slots) },
      {
        onSuccess: () => {
          setSaved(true);
          toast(SAVED_MESSAGE, 'success');
          void qc.invalidateQueries({ queryKey: competitionsKeys.byId(competitionId) });
          router.replace(back);
        },
        onError: (error) => toast(saveErrorMessage(error), 'danger'),
      },
    );
  };

  const placed = slots ? placedStands(slots).size : 0;
  const total = slots ? Object.values(slots).reduce((n, s) => n + s.length, 0) : 0;
  const filledLine = `${placed} din ${formatCount(total, 'loc ocupat', 'locuri ocupate')}`;

  return (
    <>
      <ManagementFrame
        competitionId={competitionId}
        viewer={viewer}
        title={SECTORS_TITLE}
        titleId={SECTORS_TITLE_ID}
        requires="author"
        back={{ href: back, label: 'Înapoi la concurs' }}
        onRefresh={() => undefined}
        skeleton={<SectorsBodySkeleton />}
        asideSkeleton={<FlowAsideSkeleton />}
        hint={({ competition: c }) => (c?.lake ? <span>{c.lake.name}</span> : null)}
        aside={({ competition: c }) => (c && slots && c.sectors.length > 0 ? <SummaryCard competition={c} slots={slots} /> : null)}
        actions={({ competition: c }) =>
          c && isEditable(c) && c.sectors.length > 0 ? (
            <FlowActions
              hint={<span data-testid="sectors-filled">{filledLine}</span>}
              primary={
                <Button
                  onClick={onSave}
                  disabled={save.isPending || saved}
                  aria-busy={save.isPending || undefined}
                  icon={save.isPending ? <T4Spinner /> : undefined}
                  data-testid="sectors-save"
                >
                  Salvează
                </Button>
              }
            />
          ) : null
        }
      >
        {({ competition: c }) =>
          c && slots ? (
            <Editor
              competition={c}
              slots={slots}
              busy={save.isPending || saved}
              onOpen={(sectorId, index) => setPicking({ sectorId, index })}
              onClear={(sectorId, index) => initial && setEdits((e) => withEdit(initial, e, sectorId, index, null))}
            />
          ) : null
        }
      </ManagementFrame>
      {data && slots ? (
        <StandPickerDialog
          open={picking !== null}
          sectorName={picking ? (data.sectors.find((s) => s.documentId === picking.sectorId)?.name ?? null) : null}
          slotNumber={picking ? picking.index + 1 : null}
          options={standOptions(data, slots)}
          onClose={() => setPicking(null)}
          onPick={(standId) => {
            if (picking && initial) setEdits((e) => withEdit(initial, e, picking.sectorId, picking.index, standId));
            setPicking(null);
          }}
        />
      ) : null}
      {leaveDialog}
    </>
  );
}

function Editor({
  competition,
  slots,
  busy,
  onOpen,
  onClear,
}: {
  competition: CompetitionWithMyStatus;
  slots: Slots;
  busy: boolean;
  onOpen: (sectorId: string, index: number) => void;
  onClear: (sectorId: string, index: number) => void;
}) {
  const editable = isEditable(competition);
  const names = useMemo(() => standNames(competition), [competition]);
  const palette = useMemo(() => sectorPalette(competition), [competition]);
  return (
    <>
      {editable ? null : (
        <p
          data-testid="sectors-locked"
          className="t-heading rounded-control border border-dashed border-status-danger-fg bg-status-danger-bg px-3 py-2.5 text-status-danger-fg"
        >
          Competiția a început deja! Alocarea standurilor nu mai poate fi modificată!
        </p>
      )}
      <dl className="flex flex-col gap-1 md:flex-row md:flex-wrap md:gap-x-6" data-testid="sectors-info">
        <Fact label="Nr. sectoare:" value={competition.sectors.length} />
        <Fact label="Nr. max standuri per sector:" value={standsPerSector(competition)} />
      </dl>
      {competition.sectors.length === 0 ? (
        <div className="flex items-start gap-3" data-testid="sectors-empty">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-fill text-ink-2">
            <Squares2X2Icon className="size-6" />
          </span>
          <p className="t-body min-w-0 flex-1 pt-2 text-ink-2">
            Concursul nu are sectoare. Sectoarele se aleg în pasul «Lac și sectoare» al concursului.
          </p>
        </div>
      ) : (
        <SlotGrid
          sectors={competition.sectors}
          slots={slots}
          names={names}
          palette={palette}
          editable={editable}
          busy={busy}
          onOpen={onOpen}
          onClear={onClear}
        />
      )}
    </>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="t-heading text-muted">{label}</dt>
      <dd className="t-heading text-accent-ink tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * ≥1280: each sector's «ocupate / locuri» with its colour (the total is the action bar's line under
 * it; on a locked page the card says it, as there is no bar).
 */
function SummaryCard({ competition, slots }: { competition: CompetitionWithMyStatus; slots: Slots }) {
  const palette = sectorPalette(competition);
  const placed = placedStands(slots).size;
  const total = Object.values(slots).reduce((n, s) => n + s.length, 0);
  return (
    <FlowAsideCard title="Sectoare" id="sectoare-rezumat">
      {isEditable(competition) ? null : (
        <p className="t-caption text-muted" data-testid="sectors-filled-locked">
          {placed} din {formatCount(total, 'loc ocupat', 'locuri ocupate')}
        </p>
      )}
      <ul className={cn('flex flex-col', competition.sectors.length > 8 && 'grid grid-cols-2 gap-x-4')}>
        {competition.sectors.map((s) => {
          const tone = palette.get(s.documentId);
          const fill = sectorFill(tone?.letter ?? '', tone?.color ?? 'var(--color-muted)');
          const list = slots[s.documentId] ?? [];
          return (
            <li key={s.documentId} className="flex min-h-9 items-center gap-2">
              <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />
              <span className="t-body text-ink">Sector {s.name}</span>
              <span className="t-caption ml-auto text-muted tabular-nums">
                {list.filter(Boolean).length}/{list.length}
                <span className="sr-only"> locuri ocupate</span>
              </span>
            </li>
          );
        })}
      </ul>
    </FlowAsideCard>
  );
}
