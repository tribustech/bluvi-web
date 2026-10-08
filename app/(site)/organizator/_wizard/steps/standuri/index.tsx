'use client';

import { useMemo, useState } from 'react';
import { MapPinIcon } from '@heroicons/react/24/outline';
import { useQueryClient } from '@tanstack/react-query';
import { lakesKeys } from '@/core/lakes';
import { T4Notice, T4Section } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { useSiteToast } from '../../../../_shell/Toast';
import { useWizard } from '../../context';
import { emptyReason, EMPTY_COPY, refusedMessage, sortStands, toggleStand } from './model';
import { PerformanceExplanation } from './PerformanceExplanation';
import { StandAllocator } from './StandAllocator';

/**
 * Step «Alocă standuri» (parity organizer.step-stand-allocation; fish
 * app/(app)/create-competition/step-stand-allocation.tsx). One card «Alocare standuri»: the
 * allocator (sector tabs + stand grid) or, without a lake / sectors / stands, an empty card that
 * sends back to «Lac și sectoare». The frame (../../WizardScreen.tsx) owns the footer
 * («Următorul pas» → revizuire, c9). Allocations are not auto-saved here (fish neither): the frame
 * flushes them when the step changes or the organizer saves.
 */
export function StepStanduri() {
  const w = useWizard();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const { values } = w;

  const sectorNames = useMemo(() => (values.sectors ?? []).map((s) => s.name), [values.sectors]);
  const allocations = useMemo(() => values.standAllocations ?? {}, [values.standAllocations]);
  // c3: the first sector on entry (fish useState(sectors[0]?.name)).
  const [selected, setSelected] = useState<string | null>(sectorNames[0] ?? null);
  const selectedSector = selected && sectorNames.includes(selected) ? selected : null;
  const [explainOpen, setExplainOpen] = useState(false);

  const detail = w.lake.data && w.lake.data.documentId === values.lake ? w.lake.data : null;
  const stands = useMemo(() => sortStands(detail?.stands ?? []), [detail]);
  const hasLake = Boolean(values.lake);
  const pending = hasLake && !detail;

  const toggle = (standId: string) => {
    const r = toggleStand(allocations, selectedSector, standId);
    if (r.kind === 'refused') toast(refusedMessage(r.sector), 'danger');
    else if (r.kind === 'changed') w.setValue('standAllocations', r.allocations);
  };

  const reason = pending ? null : emptyReason(hasLake, sectorNames.length, stands.length);

  return (
    <div data-testid="step-stand-allocation" className="flex flex-col gap-4 md:gap-5">
      <T4Section
        title="Alocare standuri"
        description="Selectează un sector, apoi apasă pe standuri pentru a le aloca."
        icon={<MapPinIcon />}
      >
        {pending && w.lake.error ? (
          <T4Notice
            tone="danger"
            role="alert"
            title="Nu am putut încărca lacul."
            actions={
              <Button
                variant="secondary"
                size="compact"
                onClick={() => void qc.refetchQueries({ queryKey: lakesKeys.byId(values.lake as string) })}
              >
                Încearcă din nou
              </Button>
            }
          >
            Nu am putut încărca standurile lacului.
          </T4Notice>
        ) : pending ? (
          <AllocatorSkeleton />
        ) : reason ? (
          <div
            className="flex flex-col items-center gap-3 rounded-control bg-soft-fill px-4 py-8 text-center"
            data-testid="stand-allocation-empty"
          >
            <p className="t-body-strong text-muted">{EMPTY_COPY[reason]}</p>
            <Button variant="secondary" size="compact" onClick={() => w.goTo('lac-si-sectoare')} disabled={w.busy}>
              Înapoi la lac și sectoare
            </Button>
          </div>
        ) : (
          <StandAllocator
            stands={stands}
            sectorNames={sectorNames}
            allocations={allocations}
            selectedSector={selectedSector}
            onSelectSector={setSelected}
            onToggleStand={toggle}
            onExplain={() => setExplainOpen(true)}
            disabled={w.busy}
          />
        )}
      </T4Section>
      <PerformanceExplanation open={explainOpen} onClose={() => setExplainOpen(false)} />
    </div>
  );
}

/** The lake's detail is on its way (rule 4: a neutral skeleton, never a guess). */
function AllocatorSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-4" data-testid="stand-allocation-skeleton">
      <div className="h-14 animate-shimmer rounded-card bg-soft-fill" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(5.25rem,1fr))] gap-2">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="h-16 animate-shimmer rounded-control bg-soft-fill" />
        ))}
      </div>
    </div>
  );
}
