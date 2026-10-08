'use client';

import { ChoiceGrid, ChoiceTile } from '@/components/templates/T6';
import type { RaffleTypeDto } from '@/core/organizer';
import { raffleCopy, registrationsLabel } from '../_shared/copy';

const C = raffleCopy.intro;

/**
 * fish raffle/index.tsx:161-196 «Alege tipul premiilor» (participant.raffle-intro.c4): one choice per
 * session type, its label; the picked one filled. A native radio group (ChoiceTile `radio`): arrow
 * keys move between types, Space picks. Picking clears the error card. Only rendered when the
 * session has types (a session without types can never be joined: c12).
 */
export function TypePicker({
  types,
  selected,
  onSelect,
  registrationsByType,
}: {
  types: RaffleTypeDto[];
  selected: string | null;
  onSelect: (key: string) => void;
  registrationsByType: Record<string, number>;
}) {
  return (
    <fieldset id="tombola-tip" className="flex min-w-0 flex-col gap-3">
      <legend className="t-heading float-left w-full text-ink">{C.typesTitle}</legend>
      <p className="t-body text-ink-2">{C.typesBody}</p>
      <ChoiceGrid compact>
        {types.map((t) => (
          <ChoiceTile
            key={t.key}
            title={t.label}
            description={registrationsLabel(registrationsByType[t.key] ?? 0)}
            radio={{ name: 'tombola-tip', value: t.key, checked: selected === t.key, onChange: () => onSelect(t.key) }}
          />
        ))}
      </ChoiceGrid>
    </fieldset>
  );
}
