'use client';

import { useMemo, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { formatDecimal, plural } from '@/components/cards/format';
import { sectorFill } from '@/components/ranking/sector';
import { ChoiceGrid, ChoiceTile, FlowSearch, FlowSection, FlowToolbar } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import type { SectorView, StandView } from './data';

/** Lowercase, no diacritics: «Ștefan» matches «stefan». */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

function matches(stand: StandView, sector: string, q: string): boolean {
  const hay = fold([stand.tileLabel, `${sector}${stand.name}`, stand.club ?? '', stand.team ?? '', ...stand.people].join(' '));
  return hay.includes(q);
}

/**
 * fish: «<Echipa>: <names>» on team competitions. A guest registration's one name is typed by the
 * organiser and usually repeats the team, often with a typo («Bibanu si Paul Sarbu: Bibanul si
 * Paul Sarbu») — so it is decided on the source, not on string likeness: a guest on a team
 * competition shows the team alone; the anglers show only when they are registered participants.
 */
function describe(stand: StandView) {
  const names = stand.people.join(', ');
  if (!stand.team) return names;
  if (stand.guest || !names) return <span className="font-bold">{stand.team}</span>;
  return (
    <>
      <span className="font-bold">{stand.team}: </span>
      {names}
    </>
  );
}

/**
 * Step 1 — «Alege standul» (fish scale/index.tsx): every sector, every stand; a stand with nobody
 * on it is shown but cannot be opened (fish: disabled, «-»). The web adds a find-as-you-type field
 * (stand or angler) and each stand's weighed total, read from /weighings-summary. When the scale is
 * closed for the viewer the tiles stay navigable (step 2 is then read-only) but neutral.
 */
export function StandPicker({
  sectors,
  hrefFor,
  readOnly = false,
}: {
  sectors: SectorView[];
  hrefFor: Record<string, string>;
  /** The scale is closed for the viewer: tiles still open the stand, but neutral (no weigh promise). */
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState('');
  const q = fold(query.trim());
  const visible = useMemo(
    () =>
      sectors
        .map((s) => ({ ...s, stands: q ? s.stands.filter((st) => matches(st, s.name, q)) : s.stands }))
        .filter((s) => s.stands.length > 0),
    [sectors, q],
  );
  const count = visible.reduce((acc, s) => acc + s.stands.length, 0);

  return (
    <>
      <FlowToolbar>
        <FlowSearch
          label="Caută stand sau pescar"
          placeholder="Caută stand sau pescar"
          value={query}
          onChange={setQuery}
          resultLabel={count === 0 ? 'Niciun stand găsit' : plural(count, 'stand găsit', 'standuri găsite')}
        />
      </FlowToolbar>
      {visible.length === 0 ? (
        // Inside the task card: no card of its own (a card never sits inside a card), and no title —
        // the field's caption right above already says «Niciun stand găsit». The flow's notice disc
        // (40px, 24px outline glyph, as T4Notice / T4Gate), not the 48px illustration.
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft-fill text-ink-2">
            <MagnifyingGlassIcon className="size-6" />
          </span>
          <p className="t-body min-w-0 flex-1 pt-2 text-ink-2">
            Nu există niciun stand sau pescar pentru «{query.trim()}». Verifică ce ai scris sau caută după numărul standului.
          </p>
        </div>
      ) : (
        visible.map((sector) => {
          const fill = sectorFill(sector.name, 'var(--color-muted)');
          const free = sector.stands.filter((s) => !s.occupied).length;
          const id = `sector-${sector.name}`;
          return (
            <FlowSection
              key={sector.name}
              id={id}
              title={`Sector ${sector.name}`}
              marker={<span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', fill.className)} style={fill.style} />}
              meta={[plural(sector.stands.length, 'stand', 'standuri'), free ? plural(free, 'liber', 'libere') : null]
                .filter(Boolean)
                .join(' · ')}
            >
              <ChoiceGrid label={`Standurile din sectorul ${sector.name}`}>
                {sector.stands.map((stand) => (
                  <ChoiceTile
                    key={stand.documentId}
                    title={stand.tileLabel}
                    kicker={stand.club}
                    description={stand.occupied ? describe(stand) : 'Liber — niciun pescar alocat'}
                    value={stand.weighings > 0 ? `${formatDecimal(stand.totalKg, 3, 3)} kg` : undefined}
                    valueCaption={stand.weighings > 0 ? plural(stand.weighings, 'cântărire', 'cântăriri') : undefined}
                    stripeClassName={fill.className || undefined}
                    href={stand.occupied ? hrefFor[stand.documentId] : undefined}
                    disabled={!stand.occupied}
                    tone={readOnly ? 'neutral' : 'accent'}
                  />
                ))}
              </ChoiceGrid>
            </FlowSection>
          );
        })
      )}
    </>
  );
}
