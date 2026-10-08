'use client';

import { useId, useMemo, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { getGeneralRankingHelpText, getSectorPriorityOptions } from '@/core/organizer';
import { isSectorMode, sectorModeIcon } from './model';
import { HowItWorks, ModeRadioRow } from './parts';

/**
 * fish GeneralRankingModeSheet (c6): «📊 Alege modul de departajare în clasamentul general».
 * The tinted «Cum funcționează departajarea» box (type help + full explanation), the expandable
 * «După poziția în sector» group with the type's sector-priority rows (two — standard and
 * reversed — only for Cantitate/Calitate and Calitate/Cantitate), «După punctaj», and «Confirmă»:
 * the choice is local until confirmed. A sheet on a phone, a dialog from 768 (Fundații §07 `info`).
 * Mounted only while open, so it always starts from the saved value.
 */
export function GeneralModeDialog({
  rankingType,
  value,
  onConfirm,
  onClose,
  onMore,
}: {
  rankingType: string;
  value: string;
  onConfirm: (mode: string) => void;
  onClose: () => void;
  onMore: () => void;
}) {
  const [local, setLocal] = useState(value);
  const [sectorOpen, setSectorOpen] = useState(isSectorMode(value));
  const options = useMemo(() => getSectorPriorityOptions(rankingType), [rankingType]);
  const groupId = useId();
  const name = `mod-general-${groupId}`;

  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="info"
      title="📊 Alege modul de departajare în clasamentul general"
      sheetSnap="fit"
      pinnedActions
      actions={
        <Button block onClick={() => (local ? onConfirm(local) : undefined)} disabled={!local} data-testid="mod-general-confirma">
          Confirmă
        </Button>
      }
    >
      <div className="flex flex-col gap-3 pt-1" data-testid="mod-general-dialog">
        <HowItWorks text={getGeneralRankingHelpText(rankingType)} onMore={onMore} />

        <button
          type="button"
          aria-expanded={sectorOpen}
          aria-controls={groupId}
          onClick={() => setSectorOpen(o => !o)}
          className={cn(
            'flex min-w-0 cursor-pointer items-center gap-3 rounded-card bg-surface p-3.5 text-left shadow-e0 hover:bg-soft-fill active:opacity-70',
            'transition-[background-color,opacity] duration-(--duration-fast) ease-fast',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
        >
          <span aria-hidden className="w-8 shrink-0 text-center t-title1 leading-none">
            📊
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="t-body-strong text-ink">După poziția în sector</span>
            <span className="t-caption text-muted">Locurile 1 concurează între ele, locurile 2 între ele, etc.</span>
          </span>
          <ChevronDownIcon aria-hidden className={cn('size-5 shrink-0 text-ink-2 transition-transform duration-(--duration-fast)', sectorOpen && 'rotate-180')} />
        </button>

        <div id={groupId} role="radiogroup" aria-label="După poziția în sector" hidden={!sectorOpen} className="flex flex-col gap-2">
          {sectorOpen
            ? options.map(o => (
                <ModeRadioRow
                  key={o.value}
                  name={name}
                  value={o.value}
                  icon={sectorModeIcon(rankingType, o.value)}
                  title={o.label}
                  description={o.description}
                  checked={local === o.value}
                  onSelect={() => setLocal(o.value)}
                  indent
                />
              ))
            : null}
        </div>

        <ModeRadioRow
          name={name}
          value="byPoints"
          icon="🔢"
          title="După punctaj"
          description="Toate echipele ordonate direct după punctaj total."
          checked={local === 'byPoints'}
          onSelect={() => setLocal('byPoints')}
        />
      </div>
    </ResponsiveSurface>
  );
}
