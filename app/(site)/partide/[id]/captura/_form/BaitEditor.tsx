'use client';

import { useId, useState } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import {
  BAIT_FLAVOR_LABELS,
  BAIT_FLAVORS,
  BAIT_SIZES,
  BAIT_TYPE_LABELS,
  BAIT_TYPES,
  composeBait,
  type BaitFlavor,
  type BaitSize,
  type BaitType,
  type BaitValue,
} from '@/core/partide';
import { controlShell } from '@/components/forms/Field';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * «Momeală» editor (parity partide.captura.c5; fish components/BaitEditorSheet.tsx + BaitEditor.tsx +
 * timer/BaitTaxonomyPickers): the recently used baits as chips (picking one applies the FULL bait,
 * name + taxonomy, so statistics keep grouping under one entry), a free-text name, and the
 * «Tip» / «Dimensiune (mm)» / «Aromă» chips that compose the name. Text ↔ chips stay consistent:
 * a chip recomposes the name; typing a name by hand clears the structured fields. «Salvează» hands
 * the value back — an empty bait is a valid save («clear momeală»); «Închide» discards the draft.
 */

const EMPTY: BaitValue = { bait: '', baitType: null, baitSize: null, baitFlavor: null };

export function BaitEditor({ open, initial, history, onSave, onClose }: { open: boolean; initial: BaitValue | null; history: BaitValue[]; onSave: (v: BaitValue) => void; onClose: () => void }) {
  return open ? <Body initial={initial} history={history} onSave={onSave} onClose={onClose} /> : null;
}

function Body({ initial, history, onSave, onClose }: { initial: BaitValue | null; history: BaitValue[]; onSave: (v: BaitValue) => void; onClose: () => void }) {
  const [value, setValue] = useState<BaitValue>(initial ?? EMPTY);
  const inputId = useId();
  const type = value.baitType as BaitType | null;
  const size = value.baitSize as BaitSize | null;
  const flavor = value.baitFlavor as BaitFlavor | null;
  const apply = (t: BaitType | null, s: BaitSize | null, f: BaitFlavor | null) => setValue({ baitType: t, baitSize: s, baitFlavor: f, bait: composeBait(t, s, f) });

  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="info"
      title="Momeală"
      sheetSnap={0.9}
      pinnedActions
      actions={
        <div className="flex w-full gap-2.5 md:w-auto">
          <Button type="button" variant="outline" className="flex-1 md:flex-none" onClick={onClose}>
            Închide
          </Button>
          <Button
            type="button"
            className="flex-[1.4] md:flex-none"
            data-testid="bait-save"
            onClick={() => {
              onSave(value);
              onClose();
            }}
          >
            Salvează
          </Button>
        </div>
      }
    >
      <div data-testid="bait-editor" className="flex flex-col gap-4.5">
        {history.length ? (
          <ChipRow label="Folosite recent">
            {history.map(h => {
              const active = value.bait.trim().toLowerCase() === h.bait.toLowerCase();
              return (
                <Chip key={h.bait.toLowerCase()} active={active} onClick={() => setValue({ ...value, ...h })}>
                  <ClockIcon aria-hidden className="size-3" />
                  {h.bait}
                </Chip>
              );
            })}
          </ChipRow>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="t-label text-ink-2">
            Numele momelii
          </label>
          <div className={controlShell(false)}>
            <input
              id={inputId}
              value={value.bait}
              placeholder="Scrie momeala"
              autoComplete="off"
              enterKeyHint="done"
              onChange={e => setValue({ bait: e.target.value, baitType: null, baitSize: null, baitFlavor: null })}
              className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-muted"
            />
          </div>
        </div>
        <ChipRow label="Tip">
          {BAIT_TYPES.map(t => (
            <Chip key={t} active={type === t} onClick={() => apply(type === t ? null : t, size, flavor)}>
              {BAIT_TYPE_LABELS[t]}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Dimensiune (mm)">
          {BAIT_SIZES.map(s => (
            <Chip key={s} active={size === s} onClick={() => apply(type, size === s ? null : s, flavor)}>
              {s}
            </Chip>
          ))}
        </ChipRow>
        <ChipRow label="Aromă">
          {BAIT_FLAVORS.map(f => (
            <Chip key={f} active={flavor === f} onClick={() => apply(type, size, flavor === f ? null : f)}>
              {BAIT_FLAVOR_LABELS[f]}
            </Chip>
          ))}
        </ChipRow>
      </div>
    </ResponsiveSurface>
  );
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-2">
      <p id={id} className="t-label text-muted">
        {label}
      </p>
      {/* Phone: one row that scrolls sideways; from 768 the chips wrap. */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3.5 t-label whitespace-nowrap transition-colors duration-(--duration-fast)',
        active ? 'bg-accent text-on-accent' : 'bg-soft-fill text-ink-2 hover:brightness-95',
      )}
    >
      {children}
    </button>
  );
}
