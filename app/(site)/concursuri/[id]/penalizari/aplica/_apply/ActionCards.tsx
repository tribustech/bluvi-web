'use client';

import type { Ref } from 'react';
import { TextInput } from '@/components/forms/TextInput';
import { T4ChoiceCard } from '@/components/templates/T4';
import { cn } from '@/components/ui/cn';
import type { PenaltyAction } from '@/core/competitions';
import { ACTION_OPTIONS, type ActionTone } from './model';

/**
 * fish ActionCardIcon (apply.tsx:54-56): the referee's card — an 18×26 yellow or red card, the
 * colour language every angler reads at a glance.
 */
export function PenaltyCardMarker({ tone, className }: { tone: ActionTone; className?: string }) {
  return (
    <span
      aria-hidden
      data-tone={tone}
      className={cn('block h-6.5 w-4.5 shrink-0 rounded-xs', tone === 'danger' ? 'bg-status-danger-fg' : 'bg-yellow-5', className)}
    />
  );
}

type Props = {
  action: PenaltyAction;
  onAction: (action: PenaltyAction) => void;
  /** c7: PENALTY:ALREADY_ELIMINATED, under the group's title. */
  actionError?: string;
  value: string;
  onValue: (value: string) => void;
  valueError?: string;
  valueRef?: Ref<HTMLInputElement>;
  disabled?: boolean;
};

/**
 * c3/c4 «Tip penalizare» — fish RankingTypeCard ×3 (apply.tsx:259-321): one choice, Avertisment
 * preselected. Each card is T4ChoiceCard (the kit's twin of RankingTypeCard: a native radio, so the
 * arrows move the choice and the group is one tab stop), led by its yellow / red card; the chosen
 * one is ringed and «Penalizare greutate» opens «Greutate de penalizat» inside its own ring.
 */
export function ActionCards({ action, onAction, actionError, value, onValue, valueError, valueRef, disabled }: Props) {
  return (
    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-3" aria-describedby={actionError ? 'tip-penalizare-eroare' : undefined}>
      <legend className="t-title2 mb-3 text-ink">Tip penalizare</legend>
      {actionError ? (
        <p id="tip-penalizare-eroare" role="alert" data-testid="action-error" className="t-body -mt-1 rounded-control bg-status-danger-bg px-3 py-2 text-status-danger-fg">
          {actionError}
        </p>
      ) : null}
      <div role="radiogroup" aria-label="Tip penalizare" className="flex flex-col gap-2.5">
        {ACTION_OPTIONS.map((o) => (
          <T4ChoiceCard
            key={o.value}
            type="radio"
            name="action"
            value={o.value}
            checked={action === o.value}
            onChange={(checked) => checked && onAction(o.value)}
            title={o.label}
            description={o.description}
            leading={<PenaltyCardMarker tone={o.tone} />}
            invalid={Boolean(actionError) && action === o.value}
            expanded={
              o.value === 'DEDUCT_TOTAL_WEIGHT' ? (
                <TextInput
                  ref={valueRef}
                  label="Greutate de penalizat"
                  name="value"
                  value={value}
                  onChange={(e) => onValue(e.target.value)}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.000"
                  suffix="kg"
                  error={valueError}
                  className="md:max-w-80"
                />
              ) : null
            }
          />
        ))}
      </div>
    </fieldset>
  );
}
