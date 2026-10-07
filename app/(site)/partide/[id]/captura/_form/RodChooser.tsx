'use client';

import { CheckIcon, SparklesIcon } from '@heroicons/react/24/outline';
import type { LocalRod } from '@/core/partide';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { cn } from '@/components/ui/cn';

/*
 * «Lansetă» chooser (parity partide.captura.c5/c6; fish captura.tsx rod chooser sheet): «Fără
 * lansetă» then the partidă's rods (their colour dot), the current one checked; picking closes it.
 * The helper says where the list comes from — the rods set up for this partidă — so a short list
 * never reads as a bug. A bottom sheet on the phone, a dialog from 768.
 */
export function RodChooser({ open, rods, selected, onChoose, onClose }: { open: boolean; rods: LocalRod[]; selected: number | null; onChoose: (index: number | null) => void; onClose: () => void }) {
  return (
    <ResponsiveSurface open={open} onClose={onClose} intent="info" title="Lansetă" subtitle="Aici îți apar lansetele pe care le-ai configurat în cadrul partidei" sheetSnap="fit">
      <div role="radiogroup" aria-label="Lansetă" data-testid="rod-chooser" className="-mx-2 flex flex-col divide-y divide-hairline">
        <ChooserRow label="Fără lansetă" active={selected == null} onClick={() => onChoose(null)} />
        {rods.map(r => (
          <ChooserRow key={r.index} label={r.label || `Lanseta ${r.index}`} dotColor={r.color || null} active={r.index === selected} onClick={() => onChoose(r.index)} />
        ))}
      </div>
    </ResponsiveSurface>
  );
}

function ChooserRow({ label, dotColor, active, onClick }: { label: string; dotColor?: string | null; active: boolean; onClick: () => void }) {
  return (
    <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={onClick}
        className="flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-control px-3 text-left transition-colors duration-(--duration-fast) hover:bg-soft-fill"
      >
        {dotColor !== undefined ? (
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-accent" style={dotColor ? { backgroundColor: dotColor } : undefined} />
        ) : (
          <SparklesIcon aria-hidden className="size-3.5 shrink-0 text-muted" />
        )}
        <span className={cn('min-w-0 flex-1 truncate t-body-strong', active ? 'text-accent-ink' : 'text-ink')}>{label}</span>
        {active ? <CheckIcon aria-hidden className="size-4 shrink-0 stroke-[3] text-accent" /> : null}
      </button>
  );
}
