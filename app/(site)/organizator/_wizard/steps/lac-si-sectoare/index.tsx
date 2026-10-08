'use client';

import { useMemo, useState } from 'react';
import { MapIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import { ExclamationCircleIcon } from '@heroicons/react/24/solid';
import { useQueryClient } from '@tanstack/react-query';
import { lakesKeys, type LakeCard } from '@/core/lakes';
import { formatCount } from '@/core/realtime/chat/format';
import { getMaxSectors, isThreeSectorRankingType, requiresMinFishNumber } from '@/core/organizer';
import { createBrowserTransport } from '@/lib/client/transport';
import { T4Notice, T4Section } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { useWizard } from '../../context';
import { LakePicker } from './LakePicker';
import { exceedsStands, keepAllocations, lakePhoto, type SectorConfig } from './model';
import { SectorBuilder } from './SectorBuilder';
import { SelectedLakeCard } from './SelectedLakeCard';

/**
 * Step «Lac și sectoare» (parity organizer.step-lake-sectors; fish
 * app/(app)/create-competition/step-lake-sectors.tsx). Two cards: «Selectare lac» (the picker, the
 * selected lake, the stands warning) and «Configurare sectoare» (the builder and its errors) — one
 * above the other in the form column, side by side once that column is ~670px wide (1440+).
 * The frame (../../WizardScreen.tsx) owns the footer: «Următorul pas» → standuri (c15).
 */
export function StepLacSiSectoare() {
  const w = useWizard();
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const { values } = w;

  // c5: the picked row shows at once; the detail (with its stands) replaces it when it lands.
  const [picked, setPicked] = useState<LakeCard | null>(null);
  const pickedNow = picked && picked.documentId === values.lake ? picked : null;
  const detail = w.lake.data && w.lake.data.documentId === values.lake ? w.lake.data : null;
  const shown = detail ?? pickedNow;
  const standCount = detail ? detail.stands.length : null;

  const sectors: SectorConfig[] = values.sectors ?? [];
  const rankingType = values.rankingType;
  const showMinFish = requiresMinFishNumber(rankingType);
  const maxSectors = getMaxSectors(rankingType);
  const isTeam = values.competitionType === 'team';
  const limit = values.participantsLimit;
  const over = exceedsStands(limit, standCount);

  const pick = (lake: LakeCard) => {
    setPicked(lake);
    // Old allocations name the previous lake's stands.
    if (values.lake && values.lake !== lake.documentId) w.setValue('standAllocations', {});
    w.setValue('lake', lake.documentId, { autoSave: 'debounced' });
  };

  const changeSectors = (next: SectorConfig[]) => {
    w.setValue('sectors', next);
    w.setValue('standAllocations', keepAllocations(values.standAllocations, next));
  };

  const minFishError = showMinFish && sectors.some(s => s.minFishNumber < 1);
  const sectorCountError = isThreeSectorRankingType(rankingType) && sectors.length !== 3;

  return (
    <div className="@container" data-testid="step-lake-sectors">
      <div className="grid items-start gap-4 md:gap-5 @2xl:grid-cols-2">
        <T4Section title="Selectare lac" description="Alege lacul pe care vrei să configurezi competiția." icon={<MapIcon />}>
          <LakePicker
            t={t}
            currentId={values.lake}
            currentName={shown?.name ?? null}
            nameLoading={Boolean(values.lake) && !shown && w.lake.loading}
            savedUnnamed={Boolean(values.lake) && !shown && w.lake.error}
            onPick={pick}
            disabled={w.busy}
          />

          {shown ? (
            <SelectedLakeCard name={shown.name} photo={lakePhoto(shown)} standCount={standCount} standsError={w.lake.error && !detail} />
          ) : values.lake && w.lake.loading ? (
            <div aria-hidden className="h-24 animate-shimmer rounded-card bg-soft-fill" data-testid="selected-lake-skeleton" />
          ) : null}

          {values.lake && w.lake.error && !detail ? (
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
          ) : null}

          {over && standCount != null ? (
            <div className="flex flex-col gap-3 rounded-card bg-status-danger-bg p-4" role="alert" data-testid="stands-warning">
              <p className="flex items-start gap-2 t-body-strong text-status-danger-fg">
                <ExclamationCircleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span>
                  Lacul are doar {formatCount(standCount, 'stand', 'standuri')}, dar competiția are{' '}
                  {formatCount(Number(limit), isTeam ? 'echipă' : 'participant', isTeam ? 'echipe' : 'participanți')}.
                </span>
              </p>
              <div className="pl-7">
                <Button variant="outline" size="compact" onClick={() => w.goTo('configurare')}>
                  Modifică limita
                </Button>
              </div>
            </div>
          ) : null}
        </T4Section>

        <T4Section
          title="Configurare sectoare"
          description={
            showMinFish
              ? 'Împarte lacul în sectoare și setează numărul minim de pești pentru fiecare.'
              : 'Împarte lacul în sectoare pentru alocarea standurilor.'
          }
          icon={<Squares2X2Icon />}
          invalid={minFishError || sectorCountError}
        >
          <SectorBuilder
            sectors={sectors}
            onChange={changeSectors}
            maxSectors={maxSectors}
            showMinFishNumber={showMinFish}
            disabled={w.busy}
          />
          {minFishError ? (
            <p role="alert" className="t-caption text-status-danger-fg" data-testid="min-fish-error">
              Nr. minim pești trebuie să fie cel puțin 1 pentru fiecare sector.
            </p>
          ) : null}
          {sectorCountError ? (
            <p role="alert" className="t-caption text-status-danger-fg" data-testid="sector-count-error">
              Campionatul Național și FIPSed necesită exact 3 sectoare.
            </p>
          ) : null}
        </T4Section>
      </div>
    </div>
  );
}
