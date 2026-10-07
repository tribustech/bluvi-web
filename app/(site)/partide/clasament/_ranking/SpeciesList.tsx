'use client';

import type { SpeciesShare } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { PlaceCell, TABLE_CARD, TableNote, Td, Th } from './table';

/*
 * «Specii» (partide.clasament c6; fish SpeciesRow): the period's species ranked — the name,
 * «{n} captură/capturi» and its share. Phone: the catches under the name, the percentage on the
 * right; from 768 the catches are a column and the share carries its bar. Empty: fish's line.
 */

export function SpeciesList({ species }: { species: SpeciesShare[] }) {
  if (!species.length) return <TableNote testId="species-empty">Nicio specie înregistrată în această perioadă.</TableNote>;
  return (
    <div className={TABLE_CARD}>
      <table className="w-full border-separate border-spacing-0 t-table" data-testid="species-rows">
        <caption className="sr-only">Specii</caption>
        <thead>
          <tr>
            <Th className="text-center">Loc</Th>
            <Th>Specie</Th>
            <Th num className="max-md:hidden">
              Capturi
            </Th>
            <Th num>Pondere</Th>
          </tr>
        </thead>
        <tbody>
          {species.map((s, i) => (
            <tr key={s.name}>
              <PlaceCell rank={i + 1} />
              <Td className="max-w-0 w-full">
                <span className="flex min-w-0 flex-col">
                  <span className="truncate t-body-strong text-ink">{s.name}</span>
                  <span className="t-caption text-muted md:hidden">{formatCount(s.count, 'captură', 'capturi')}</span>
                </span>
              </Td>
              <Td num className="t-body text-ink-2 max-md:hidden">
                {s.count.toLocaleString('ro-RO')}
              </Td>
              <Td num>
                <span className="inline-flex items-center gap-3">
                  <span aria-hidden className="h-1.5 w-24 overflow-hidden rounded-full bg-soft-fill max-md:hidden">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(2, Math.min(100, s.pct))}%` }} />
                  </span>
                  <span className="w-12 whitespace-nowrap">
                    <span className="t-body-strong text-ink">{s.pct.toLocaleString('ro-RO')}</span>
                    <span className="ml-0.5 t-micro text-muted">%</span>
                  </span>
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
