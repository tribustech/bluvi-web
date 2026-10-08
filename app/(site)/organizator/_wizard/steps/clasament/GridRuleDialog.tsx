'use client';

import { useId, useState } from 'react';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';
import { GRID_RULE_OPTIONS, GRID_RULE_TIEBREAK_HELP } from '@/core/organizer';
import { HowItWorks, ModeRadioRow } from './parts';

/**
 * fish OptionPickerSheet for the grid rule (c7): «🔀 Regula departajare standuri fără grilă»,
 * the tiebreak help + full explanation, «După numărul de capturi» / «După media greutății», applied
 * on «Confirmă». A sheet on a phone, a dialog from 768. Mounted only while open.
 */
export function GridRuleDialog({ value, onConfirm, onClose, onMore }: { value: string; onConfirm: (rule: string) => void; onClose: () => void; onMore: () => void }) {
  const [local, setLocal] = useState(value);
  const name = `regula-grila-${useId()}`;
  return (
    <ResponsiveSurface
      open
      onClose={onClose}
      intent="info"
      title="🔀 Regula departajare standuri fără grilă"
      sheetSnap="fit"
      actions={
        <Button block onClick={() => (local ? onConfirm(local) : undefined)} disabled={!local} data-testid="regula-grila-confirma">
          Confirmă
        </Button>
      }
    >
      <div className="flex flex-col gap-3 pt-1" data-testid="regula-grila-dialog">
        <HowItWorks text={GRID_RULE_TIEBREAK_HELP} onMore={onMore} />
        <div role="radiogroup" aria-label="Regula departajare standuri fără grilă" className="flex flex-col gap-2">
          {GRID_RULE_OPTIONS.map(o => (
            <ModeRadioRow
              key={o.value}
              name={name}
              value={o.value}
              icon={o.emoji}
              title={o.label}
              description={o.description}
              checked={local === o.value}
              onSelect={() => setLocal(o.value)}
            />
          ))}
        </div>
      </div>
    </ResponsiveSurface>
  );
}
