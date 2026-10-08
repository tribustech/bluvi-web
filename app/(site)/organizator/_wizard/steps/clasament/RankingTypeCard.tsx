'use client';

import type { ReactNode } from 'react';
import { T4ChoiceCard } from '@/components/templates/T4';
import type { RankingTypeOption } from '@/core/organizer';
import { splitRankingLabel } from './model';
import { ExplanationLink } from './parts';

/**
 * fish components/RankingTypeCard.tsx (c1–c3): one ranking type as a T4 radio card — fish's emoji
 * (decorative), the name, the description. The checked card grows its options (children) and
 * «Vezi explicația completă» under the row, inside the same ring. A disabled type (Campionat
 * Național, FIPSed) is a native disabled radio: the kit's disabled look (dashed, never faded — the
 * text stays AA) with a greyscale emoji, skipped by the arrow keys, never expanded.
 */
export function RankingTypeCard({
  option,
  checked,
  disabled,
  busy,
  onSelect,
  onExplain,
  children,
}: {
  option: RankingTypeOption;
  checked: boolean;
  disabled: boolean;
  busy: boolean;
  onSelect: (value: string) => void;
  onExplain: () => void;
  children?: ReactNode;
}) {
  const { emoji, name } = splitRankingLabel(option.value, option.label);
  return (
    <T4ChoiceCard
      type="radio"
      name="rankingType"
      value={option.value}
      checked={checked}
      disabled={disabled}
      onChange={on => {
        // While a save / publish runs the choice stays put (the card does not collapse meanwhile).
        if (on && !checked && !busy) onSelect(option.value);
      }}
      title={
        <>
          {emoji ? (
            <span aria-hidden className={disabled ? 'mr-1.5 inline-block grayscale' : 'mr-1.5'}>
              {emoji}
            </span>
          ) : null}
          {name}
        </>
      }
      description={option.description}
      id={`clasament-${option.value}`}
      expanded={
        disabled ? null : (
          <div className="flex flex-col gap-4 border-t border-hairline pt-4" data-testid={`clasament-optiuni-${option.value}`}>
            {children}
            <ExplanationLink onClick={onExplain} className="self-start" />
          </div>
        )
      }
    />
  );
}
