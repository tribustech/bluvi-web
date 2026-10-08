'use client';

import { useId, type ReactNode } from 'react';
import { ChevronDownIcon, ClockIcon, EyeIcon, FlagIcon, MapPinIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { sameSpecies, speciesKey, type TargetSpecies, type VenueSelection } from '@/core/partide';
import type { LakeDetailStand } from '@/core/lakes';
import { SettingsSwitch } from '@/components/account/settings/SwitchRow';
import { FishIcon } from '@/components/icons/brand';
import { Select } from '@/components/forms/Select';
import { TextInput } from '@/components/forms/TextInput';
import { T4Section } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';
import { AnchorPreview } from './AnchorPreview';
import { DURATION_PRESETS, MAX_DURATION_DAYS, durationFromParts, durationLabel, durationParts, type Coord } from './model';
import { VenueGlyph } from './parts';

/*
 * Step 2 — the details (fish app/(app)/partide/start.tsx, the `detail` step; parity partide.incepe
 * c7–c12): the venue card with «Schimbă», the stand (lakes with stands) and the position, «Durată
 * estimată», «Ce pescuiești?», «Partidă publică». Each block a T4 card on the page ground. Below
 * 1280 the position preview sits in its card; from 1280 the frame's right column shows it large
 * (StartFlow), so here it is `xl:hidden`.
 */

/** fish's pill chip: indigo filled when chosen, soft grey at rest. */
const chip = (active: boolean) =>
  cn(
    'inline-flex h-10 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-full px-4 t-label whitespace-nowrap',
    'transition-[background-color,color,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
    'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    active ? 'bg-accent text-on-accent hover:brightness-95' : 'bg-soft-fill text-ink-2 hover:text-ink',
  );

export function VenueCard({ sel, locality, onChange }: { sel: VenueSelection; locality: string | null; onChange: () => void }) {
  return (
    <section aria-label="Locul partidei" data-testid="start-venue-card" className="flex items-center gap-3 rounded-card bg-surface p-3 shadow-e0 md:p-4">
      {sel.kind === 'lake' ? (
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-control bg-accent-tint text-accent-ink">
          <MapPinIcon className="size-5" />
        </span>
      ) : (
        <VenueGlyph kind={sel.kind} />
      )}
      <div className="min-w-0 flex-1">
        <p data-testid="start-venue-name" className="truncate t-heading text-ink">
          {sel.name}
        </p>
        {locality ? (
          <p data-testid="start-venue-locality" className="truncate t-caption text-muted">
            {locality}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onChange}
        data-testid="start-venue-change"
        className="-mr-1 min-h-11 shrink-0 cursor-pointer rounded-control px-3 t-body-strong text-accent-ink hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
      >
        Schimbă
      </button>
    </section>
  );
}

export function PositionSection({
  sel,
  stands,
  stand,
  anchor,
  anchorLoading,
  anchorName,
  onAnchorName,
  onOpenStands,
  onClearStand,
  onAdjust,
}: {
  sel: VenueSelection;
  stands: LakeDetailStand[];
  stand: LakeDetailStand | null;
  anchor: Coord | null;
  anchorLoading: boolean;
  anchorName: string;
  onAnchorName: (v: string) => void;
  onOpenStands: () => void;
  onClearStand: () => void;
  onAdjust: () => void;
}) {
  const hint = 'Alege standul, apoi poți ajusta poziția pe hartă.';
  if (stands.length > 0) {
    return (
      <T4Section title="Stand" icon={<FlagIcon />} description="Standul tău de pe baltă." id="start-stand">
        <div className="relative">
          <button
            type="button"
            onClick={onOpenStands}
            data-testid="start-stand-select"
            aria-haspopup="dialog"
            className={cn(
              'flex h-12 w-full cursor-pointer items-center gap-2 rounded-control border border-hairline bg-surface pr-12 pl-3.5 text-left',
              'transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            )}
          >
            <span className={cn('min-w-0 flex-1 truncate', stand ? 't-body-strong text-ink' : 't-body text-muted')}>{stand ? stand.name : 'Alege standul'}</span>
          </button>
          {stand ? (
            <button
              type="button"
              onClick={onClearStand}
              aria-label="Șterge standul"
              data-testid="start-stand-clear"
              className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control text-ink-2 hover:bg-soft-fill focus-visible:outline-2 focus-visible:outline-accent"
            >
              <XMarkIcon aria-hidden className="size-5" />
            </button>
          ) : (
            <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink-2" />
          )}
        </div>
        <div className="flex flex-col gap-2 xl:hidden">
          <h3 className="t-body-strong text-ink">Poziție</h3>
          <AnchorPreview anchor={anchor} loading={anchorLoading} label={sel.name} dimmed={!stand} onPress={stand ? onAdjust : onOpenStands} />
        </div>
        {!stand ? (
          <p data-testid="start-stand-hint" className="t-caption text-muted">
            {hint}
          </p>
        ) : null}
      </T4Section>
    );
  }
  return (
    <T4Section title="Poziție" icon={<MapPinIcon />} description="Unde stai pe mal — pinul de pe hartă." id="start-position">
      <div className="xl:hidden">
        <AnchorPreview anchor={anchor} loading={anchorLoading} label={sel.name} onPress={onAdjust} />
      </div>
      <TextInput
        label="Nume standul / locul (opțional)"
        placeholder="ex. Lângă ponton"
        value={anchorName}
        onChange={e => onAnchorName(e.currentTarget.value)}
        autoComplete="off"
        maxLength={80}
        data-testid="start-anchor-name"
      />
    </T4Section>
  );
}

export function DurationSection({ value, custom, onPreset, onCustom }: { value: number; custom: boolean; onPreset: (ms: number) => void; onCustom: (ms: number) => void }) {
  const name = useId();
  const { days, hours } = durationParts(value);
  return (
    <T4Section title="Durată estimată" icon={<ClockIcon />} description="Cât crezi că stai. O poți prelungi din partidă." id="start-duration">
      <div role="radiogroup" aria-label="Durată estimată" data-testid="start-duration" className="flex flex-wrap gap-2">
        {DURATION_PRESETS.map(p => (
          <label key={p.label} className={chip(!custom && value === p.ms)}>
            <input type="radio" name={name} className="sr-only" checked={!custom && value === p.ms} onChange={() => onPreset(p.ms)} />
            {p.label}
          </label>
        ))}
        <label className={chip(custom)}>
          <input type="radio" name={name} className="sr-only" checked={custom} onChange={() => onCustom(value)} />
          Alta
        </label>
      </div>
      {custom ? (
        <div data-testid="start-duration-custom" className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3 md:max-w-md">
            <Select
              label="Zile"
              value={String(days)}
              options={Array.from({ length: MAX_DURATION_DAYS + 1 }, (_, d) => ({ value: String(d), label: d === 1 ? '1 zi' : `${d} zile` }))}
              onChange={e => onCustom(durationFromParts(Number(e.currentTarget.value), hours))}
            />
            <Select
              label="Ore"
              value={String(hours)}
              disabled={days >= MAX_DURATION_DAYS}
              options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: h === 1 ? '1 oră' : `${h} ore` }))}
              onChange={e => onCustom(durationFromParts(days, Number(e.currentTarget.value)))}
            />
          </div>
          <p className="t-caption text-muted" aria-live="polite">
            Total: {durationLabel(value)} (cel mult 7 zile)
          </p>
        </div>
      ) : null}
    </T4Section>
  );
}

export function SpeciesSection({ chips, selected, onToggle, onSeeAll }: { chips: TargetSpecies[]; selected: TargetSpecies[]; onToggle: (t: TargetSpecies) => void; onSeeAll: () => void }) {
  return (
    <T4Section title="Ce pescuiești?" icon={<FishIcon />} description="Opțional — speciile țintă ale partidei." id="start-species">
      <div role="group" aria-label="Specii țintă" data-testid="start-species" className="flex flex-wrap gap-2">
        {chips.map(t => {
          const active = selected.some(s => sameSpecies(s, t));
          return (
            <button key={speciesKey(t)} type="button" aria-pressed={active} onClick={() => onToggle(t)} className={chip(active)}>
              {t.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onSeeAll}
          data-testid="start-species-all"
          aria-haspopup="dialog"
          className={cn(
            'inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-faint bg-surface px-3.5 t-label text-ink-2',
            'transition-colors duration-(--duration-fast) hover:bg-soft-fill hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          )}
        >
          <PlusIcon aria-hidden className="size-4 stroke-2" />
          Vezi toate
        </button>
      </div>
    </T4Section>
  );
}

export function PublicSection({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <section aria-label="Vizibilitate" data-testid="start-public" className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6">
      <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent-ink max-md:hidden">
        <EyeIcon className="size-6" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={`${id}-switch`} className="cursor-pointer t-heading text-ink">
          Partidă publică
        </label>
        <p id={`${id}-help`} className="t-caption text-muted">
          Vizibilă în comunitate și pe profil — ceilalți văd doar capturile, nu locul exact sau alte detalii.
        </p>
      </div>
      <SettingsSwitch id={`${id}-switch`} checked={checked} onChange={onChange} describedBy={`${id}-help`} />
    </section>
  );
}

/** The large position card of the right column from 1280 (fish's preview, given the room). */
export function PositionAside({ children, caption }: { children: ReactNode; caption?: string | null }) {
  return (
    <section aria-label="Poziție" data-testid="start-position-aside" className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0 xl:p-5">
      <div className="flex items-center gap-2">
        <MapPinIcon aria-hidden className="size-5 text-accent-ink" />
        <h2 className="t-heading text-ink">Poziție</h2>
      </div>
      {children}
      {caption ? <p className="t-caption text-muted">{caption}</p> : null}
    </section>
  );
}
