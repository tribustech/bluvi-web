'use client';

import { useId, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardDocumentListIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/20/solid';
import { controlShell } from '@/components/forms/Field';
import { FishIcon } from '@/components/icons/brand';
import { RING_SELECTED } from '@/components/templates/rings';
import { T4ChoiceCard, T4Section } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';
import { fishesQuery } from '@/core/lakes';
import { formatCount } from '@/core/realtime/chat/format';
import { createBrowserTransport } from '@/lib/client/transport';
import { useWizard } from '../../context';
import { digitsOnly, sortCompetitionSpecies, toggleSpecies } from './model';

/**
 * Step 2 «Configurare competiție» (parity organizer.step-config; fish
 * app/(app)/create-competition/step-config.tsx). Three T4 cards:
 *  - «Format participanți»: Individual (default) / Echipă as exclusive choice cards (auto-save on
 *    choose, debounced like fish scheduleAutoSave); «Participanți per echipă *» only for Echipă.
 *  - «Capacitate competiție»: «Total participanți *» / «Total echipe *».
 *  Both counts keep digits only, validate on every keystroke (fish trigger) with the schema's
 *  messages and auto-save on blur (fish onBlur → autoSaveDraft).
 *  - «Specii eligibile *»: only when the catalog has species (loading / failed / empty → hidden,
 *    owner rule 4), sorted by competitionPriority then Romanian name; toggle pills (aria-pressed,
 *    accent = fish indigo when on) that wrap on the web (c6 allows it) instead of fish's scroller.
 * The footer («Următorul pas» → clasament, the save button) is the frame's (WizardScreen).
 */
export function StepConfigurare() {
  const w = useWizard();
  const t = useMemo(() => createBrowserTransport(), []);
  const fishes = useQuery(fishesQuery(t));
  const species = useMemo(() => sortCompetitionSpecies(fishes.data), [fishes.data]);

  const team = w.values.competitionType === 'team';
  const type = w.values.competitionType ?? 'single';
  const selected = w.values.fishSpeciesIds ?? [];
  const typeLabelId = useId();

  return (
    <>
      <T4Section
        title="Format participanți"
        description="Alege formatul competiției și structura echipei."
        icon={<UserGroupIcon />}
        id="configurare-format"
      >
        <div role="radiogroup" aria-labelledby={typeLabelId} aria-describedby={`${typeLabelId}-help`} className="flex flex-col gap-2">
          <div className="flex flex-col">
            <span id={typeLabelId} className="t-label text-ink-2">
              Tipul competiției *
            </span>
            <span id={`${typeLabelId}-help`} className="t-caption text-muted">
              Alege dacă participanții concurează individual sau în echipă.
            </span>
          </div>
          <div className={cn('grid grid-cols-2 gap-3', CHOICE_MAX_W)}>
            {(
              [
                { value: 'single', label: 'Individual' },
                { value: 'team', label: 'Echipă' },
              ] as const
            ).map(option => (
              <T4ChoiceCard
                key={option.value}
                type="radio"
                name="competitionType"
                value={option.value}
                checked={type === option.value}
                disabled={w.busy}
                onChange={on => {
                  if (!on || type === option.value) return;
                  // A team size that no longer applies must not stay behind: hidden, it would keep
                  // the schema error (publish blocked with nothing on screen) and ride along in the
                  // PUT of a single-angler competition. Fish only checks it for team (configErrors).
                  if (option.value === 'single' && w.errors.teamParticipants) w.setValue('teamParticipants', undefined);
                  w.setValue('competitionType', option.value, { autoSave: 'debounced' });
                }}
                title={option.label}
              />
            ))}
          </div>
        </div>

        {team ? (
          <div className={COUNT_GRID}>
            <CountInput
              id="configurare-echipa"
              label="Participanți per echipă *"
              helper="Câți membri are fiecare echipă."
              value={w.values.teamParticipants}
              error={w.errors.teamParticipants}
              disabled={w.busy}
              onChange={v => w.setValue('teamParticipants', v)}
              onBlur={() => w.touch('teamParticipants')}
            />
          </div>
        ) : null}
      </T4Section>

      <T4Section
        title="Capacitate competiție"
        description="Definește limita maximă de participanți sau echipe."
        icon={<ClipboardDocumentListIcon />}
        id="configurare-capacitate"
      >
        <div className={COUNT_GRID}>
          <CountInput
            id="configurare-limita"
            label={team ? 'Total echipe *' : 'Total participanți *'}
            helper={team ? 'Numărul maxim de echipe acceptate.' : 'Numărul maxim de participanți acceptați.'}
            placeholder={team ? 'ex. 20' : 'ex. 50'}
            value={w.values.participantsLimit}
            error={w.errors.participantsLimit}
            disabled={w.busy}
            onChange={v => w.setValue('participantsLimit', v)}
            onBlur={() => w.touch('participantsLimit')}
          />
        </div>
      </T4Section>

      {species.length > 0 ? (
        <T4Section
          title="Specii eligibile *"
          description="Selectează speciile de pește care intră în competiție."
          icon={<FishIcon />}
          id="configurare-specii"
          action={
            selected.length > 0 ? (
              <span className="t-caption text-muted tabular-nums" data-testid="configurare-specii-count">
                {formatCount(selected.length, 'selectată', 'selectate')}
              </span>
            ) : null
          }
        >
          <ul aria-label="Specii eligibile" className="flex flex-wrap gap-2" data-testid="configurare-specii">
            {species.map(fish => {
              const on = selected.includes(fish.documentId);
              return (
                <li key={fish.documentId}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={w.busy}
                    onClick={() => w.setValue('fishSpeciesIds', toggleSpecies(w.values.fishSpeciesIds, fish.documentId), { autoSave: 'debounced' })}
                    className={cn(
                      'inline-flex h-10 cursor-pointer select-none items-center gap-1.5 rounded-full px-4 t-label whitespace-nowrap',
                      'transition-[background-color,color,box-shadow,opacity] duration-(--duration-fast) ease-fast active:opacity-80',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                      'disabled:cursor-not-allowed disabled:opacity-50',
                      on ? cn('bg-accent-tint text-accent-ink hover:bg-accent-tint-2', RING_SELECTED) : 'bg-soft-fill text-ink-2 hover:text-ink',
                    )}
                  >
                    {on ? <CheckIcon aria-hidden className="-ml-1 size-4" /> : null}
                    {fish.Name}
                  </button>
                </li>
              );
            })}
          </ul>
        </T4Section>
      ) : null}
    </>
  );
}

/**
 * The choice row and the count fields share one right edge on desktop (a 1–3 digit number never
 * needs more than half of it); a phone keeps the full width.
 */
const CHOICE_MAX_W = 'md:max-w-xl';
const COUNT_GRID = cn('grid gap-4 sm:grid-cols-2 sm:gap-3', CHOICE_MAX_W);

/**
 * A count field (fish TextInput keyboardType number-pad): digits only, numeric keyboard. Like fish
 * step-config (and the «Tipul competiției» radiogroup above), the caption sits between the label
 * and the input and stays visible; the error goes under the input, in addition to it.
 */
function CountInput({
  id,
  label,
  helper,
  placeholder,
  value,
  error,
  disabled,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  helper: string;
  placeholder?: string;
  value: string | undefined;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
}) {
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-col">
        <label htmlFor={id} className="t-label text-ink-2">
          {label}
        </label>
        <span id={helpId} className="t-caption text-muted">
          {helper}
        </span>
      </div>
      <div className={controlShell(Boolean(error), disabled)}>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          aria-required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          placeholder={placeholder}
          disabled={disabled}
          value={value ?? ''}
          onChange={e => onChange(digitsOnly(e.currentTarget.value))}
          onBlur={onBlur}
          className="t-body h-full min-w-0 flex-1 bg-transparent text-ink outline-none tabular-nums placeholder:text-muted focus-visible:outline-none disabled:cursor-not-allowed"
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="t-caption text-status-danger-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
