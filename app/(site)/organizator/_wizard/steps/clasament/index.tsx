'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AdjustmentsVerticalIcon, ScaleIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { FishIcon } from '@/components/icons/brand';
import { T4Section } from '@/components/templates/T4';
import {
  DISABLED_RANKING_TYPES,
  getGeneralRankingWinnerModeLabel,
  GRID_RULE_LABELS,
  hasGeneralRankingWinnerMode,
  hasGridRule,
  RANKING_TYPES,
  type RankingTypeOption,
} from '@/core/organizer';
import { useWizard } from '../../context';
import { explanationParam, type ExplanationTarget } from '../../explanation';
import { BestOfFields } from './BestOfFields';
import { GeneralModeDialog } from './GeneralModeDialog';
import { GridRuleDialog } from './GridRuleDialog';
import { LegsChoice } from './LegsChoice';
import { rankingNormalization, rankingTypePatchRestoring, typeOwnValues, type RankingPatch } from './model';
import { OptionBlock, OptionTrigger } from './parts';
import { RankingTypeCard } from './RankingTypeCard';
import { TiersField } from './TiersField';

type Picker = 'generalMode' | 'gridRule' | null;

/**
 * Step 3 «Tip clasament» (parity organizer.step-ranking; fish
 * app/(app)/create-competition/step-ranking.tsx + components/RankingTypeCard.tsx). One T4 card,
 * «Tipul clasamentului», holding the 11 types in fish's order as a native radio group (arrow keys;
 * Campionat Național / FIPSed disabled, and cleared when a draft carries one). The checked card
 * grows its options:
 *  - Cantitate, Calitate, Cantitate/Calitate, Calitate/Cantitate: «Clasament general» → the mode
 *    dialog (GeneralModeDialog);
 *  - Calitate, Cantitate/Calitate, Calitate/Cantitate: «Standuri fără grilă» → GridRuleDialog;
 *  - Best of x, y, z...: «Praguri clasament» (TiersField); Feeder: «Număr de manșe» (LegsChoice);
 *    Best of: «Parametri Best Of» (BestOfFields);
 *  - every type: «Vezi explicația completă» → ?explicatie= (the frame's RankingExplanationPanel).
 * Choosing a type writes fish's patch (model.rankingTypePatch) and schedules the auto-save; a type
 * reached again with the arrow keys gets back the tiers / best-of values / legs it had in this visit
 * (web addition: the arrow keys change the type as they move, fish only on a deliberate tap; a
 * click / Space keeps fish's reset).
 * The footer («Următorul pas» → lac și sectoare, the save button) is the frame's (WizardScreen).
 */
export function StepClasament() {
  const w = useWizard();
  const [picker, setPicker] = useState<Picker>(null);
  const legsLabelId = useId();
  const type = w.values.rankingType || '';

  // fish's normalising effects: a hydrated disabled type is cleared (fish shouldDirty: an edit),
  // the general mode and the grid rule always fit the type (fish setValue without shouldDirty:
  // `normalize`, so opening the step never makes the form dirty). Not saved on their own (fish
  // setValue without scheduleAutoSave). The key keeps «clear it» (undefined → null): JSON drops it.
  const fixKey = JSON.stringify(Object.entries(rankingNormalization(w.values)).map(([k, v]) => [k, v ?? null]));
  const { setValue } = w;
  useEffect(() => {
    for (const [field, value] of JSON.parse(fixKey) as [keyof RankingPatch, unknown][]) {
      setValue(field, (value ?? undefined) as never, { normalize: field !== 'rankingType' });
    }
  }, [fixKey, setValue]);

  // The values each type owned in this visit: the arrow keys move through the native radios (each
  // one a type change), so arrowing past a card and back must not wipe its tiers / best-of / legs.
  // Only an arrow-key change restores them; a click / Space is fish's deliberate tap (values reset).
  const kept = useRef<Record<string, RankingPatch>>({});
  const viaArrow = useRef(false);
  const select = (next: string) => {
    const restore = viaArrow.current;
    viaArrow.current = false;
    const current = w.values.rankingType || '';
    if (current) kept.current[current] = typeOwnValues(w.values, current);
    const patch = rankingTypePatchRestoring(w.values, next, restore ? kept.current[next] : undefined);
    if (!patch) return;
    const { rankingType, ...rest } = patch;
    for (const [field, value] of Object.entries(rest)) w.setValue(field as keyof RankingPatch, value as never);
    // Last, with fish's scheduleAutoSave (debounced): one save carries the whole patch.
    w.setValue('rankingType', rankingType, { autoSave: 'debounced' });
  };

  const explain = (target: ExplanationTarget) => w.setQuery({ explicatie: explanationParam(target) });

  return (
    <T4Section
      title="Tipul clasamentului"
      description="Alege metoda principală și configurează departajările contextuale."
      icon={<TrophyIcon />}
      id="clasament-tip"
    >
      <div
        role="radiogroup"
        aria-label="Tipul clasamentului"
        className="flex flex-col gap-3"
        data-testid="clasament-tipuri"
        onKeyDown={e => {
          // The change event that follows comes from moving, not from choosing.
          viaArrow.current = e.target instanceof HTMLInputElement && e.target.name === 'rankingType' && e.key.startsWith('Arrow');
        }}
        onPointerDown={() => {
          viaArrow.current = false;
        }}
      >
        {RANKING_TYPES.map(option => (
          <RankingTypeCard
            key={option.value}
            option={option}
            checked={type === option.value}
            disabled={DISABLED_RANKING_TYPES.has(option.value)}
            busy={w.busy}
            onSelect={select}
            onExplain={() => explain({ kind: 'ranking', rankingType: option.value })}
          >
            {type === option.value ? <TypeOptions option={option} legsLabelId={legsLabelId} onPick={setPicker} /> : null}
          </RankingTypeCard>
        ))}
      </div>

      {picker === 'generalMode' && hasGeneralRankingWinnerMode(type) ? (
        <GeneralModeDialog
          rankingType={type}
          value={w.values.generalRankingWinnerMode || ''}
          onClose={() => setPicker(null)}
          onConfirm={mode => {
            w.setValue('generalRankingWinnerMode', mode, { autoSave: 'debounced' });
            setPicker(null);
          }}
          onMore={() => explain({ kind: 'generalMode', rankingType: type })}
        />
      ) : null}
      {picker === 'gridRule' && hasGridRule(type) ? (
        <GridRuleDialog
          value={w.values.gridRule || ''}
          onClose={() => setPicker(null)}
          onConfirm={rule => {
            w.setValue('gridRule', rule, { autoSave: 'debounced' });
            setPicker(null);
          }}
          onMore={() => explain({ kind: 'gridRule' })}
        />
      ) : null}
    </T4Section>
  );
}

/** The options of the checked type (fish RankingTypeCard children). */
function TypeOptions({ option, legsLabelId: legsId, onPick }: { option: RankingTypeOption; legsLabelId: string; onPick: (p: Picker) => void }) {
  const w = useWizard();
  const values = w.values;
  const v = option.value;
  const general = hasGeneralRankingWinnerMode(v);
  const grid = hasGridRule(v);
  if (!general && !grid && v !== 'bestOfTiers' && v !== 'feederRounds' && v !== 'bestOf') return null;
  return (
    <div className="grid gap-5 md:grid-cols-2 md:gap-4">
      {general ? (
        <OptionBlock icon={<AdjustmentsVerticalIcon />} title="Clasament general">
          <OptionTrigger
            label="Mod de departajare în clasamentul general"
            value={getGeneralRankingWinnerModeLabel(values.generalRankingWinnerMode, v)}
            onOpen={() => onPick('generalMode')}
            disabled={w.busy}
            testId="clasament-mod-general"
          />
        </OptionBlock>
      ) : null}
      {grid ? (
        <OptionBlock icon={<ScaleIcon />} title="Standuri fără grilă">
          <OptionTrigger
            label="Regula departajare standuri fără grilă"
            value={values.gridRule ? GRID_RULE_LABELS[values.gridRule] : undefined}
            onOpen={() => onPick('gridRule')}
            disabled={w.busy}
            testId="clasament-regula-grila"
          />
        </OptionBlock>
      ) : null}
      {v === 'bestOfTiers' ? (
        <OptionBlock icon={<FishIcon />} title="Praguri clasament">
          <TiersField value={values.bestOfTierSizes} disabled={w.busy} onCommit={tiers => w.setValue('bestOfTierSizes', tiers, { autoSave: 'now' })} />
        </OptionBlock>
      ) : null}
      {v === 'feederRounds' ? (
        <OptionBlock icon={<FishIcon />} title="Număr de manșe" labelId={legsId}>
          <LegsChoice value={values.roundsCount} disabled={w.busy} labelledBy={legsId} onChange={count => w.setValue('roundsCount', count, { autoSave: 'debounced' })} />
        </OptionBlock>
      ) : null}
      {v === 'bestOf' ? (
        <OptionBlock icon={<FishIcon />} title="Parametri Best Of" className="md:col-span-2">
          <BestOfFields
            values={{ bestOfFishCount: values.bestOfFishCount, numberOfWinners: values.numberOfWinners }}
            errors={{ bestOfFishCount: w.errors.bestOfFishCount, numberOfWinners: w.errors.numberOfWinners }}
            disabled={w.busy}
            onChange={(field, value) => w.setValue(field, value)}
            onBlur={field => w.touch(field)}
          />
        </OptionBlock>
      ) : null}
    </div>
  );
}
