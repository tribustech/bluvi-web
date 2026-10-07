'use client';

import { RankingFace } from '@/components/ranking';
import { cn } from '@/components/ui/cn';
import { fmtKg, isWeighed, type TopAngler } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { AnglerLink, type OpenAngler } from './AnglerPopover';
import { PlaceCell, ROW_LINK, rowClick, TABLE_CARD, TableNote, Td, Th } from './table';

/*
 * «Pescari» from the 4th place on (partide.clasament c4; fish AnglerRow): a compact table — Loc,
 * Pescar, and the figures. Phone: the name over «N partide · N capturi» (fish), the weight on the
 * right. From 768 the partide and the catches are columns of their own and the avatar sits beside
 * the name (owner rule 13; RankingFace: the photo or the initials on the solid tone). The weight is
 * the number with its unit apart (rule 10); nothing weighed: «—». The viewer's own row is tinted
 * and marked «Tu». With only the podium: fish's «Doar podiumul are date pentru perioada asta.»
 */

export function AnglersTable({ anglers, onOpen, popover, meUid }: { anglers: TopAngler[]; onOpen: OpenAngler; popover: boolean; meUid: string | null }) {
  if (anglers.length <= 3) return <TableNote testId="podium-only">Doar podiumul are date pentru perioada asta.</TableNote>;
  return (
    <div className={TABLE_CARD}>
      <table className="w-full border-separate border-spacing-0 t-table" data-testid="angler-rows">
        <caption className="sr-only">Pescari, de la locul 4</caption>
        <thead>
          <tr>
            <Th className="text-center">Loc</Th>
            <Th>Pescar</Th>
            <Th num className="max-md:hidden">
              Partide
            </Th>
            <Th num className="max-md:hidden">
              Capturi
            </Th>
            <Th num>Total</Th>
          </tr>
        </thead>
        <tbody>
          {anglers.slice(3).map((a, i) => {
            const rank = i + 4;
            const name = a.name ?? 'Pescar';
            const me = a.uid === meUid;
            return (
              <tr
                key={a.uid}
                onClick={rowClick}
                data-popover-anchor
                data-me={me || undefined}
                className={cn('cursor-pointer transition-colors duration-(--duration-fast)', me ? 'bg-accent-tint' : 'hover:bg-soft-fill')}
              >
                <PlaceCell rank={rank} />
                <Td className="max-w-0 w-full">
                  <span className="flex min-w-0 items-center gap-3">
                    <RankingFace name={name} face={{ src: a.avatarUrl, team: false }} />
                    <span className="flex min-w-0 flex-col">
                      <span className="flex min-w-0 items-center gap-2">
                        <AnglerLink angler={a} rank={rank} onOpen={onOpen} popover={popover} rowLink label={`Locul ${rank}: ${name}`} className={cn('truncate t-body-strong text-ink', ROW_LINK)}>
                          {name}
                        </AnglerLink>
                        {me ? <span className="shrink-0 rounded-full bg-accent-ink px-1.5 t-micro-strong text-on-accent">Tu</span> : null}
                      </span>
                      <span className="truncate t-caption text-muted md:hidden">{subtitle(a)}</span>
                    </span>
                  </span>
                </Td>
                <Td num className="t-body text-ink-2 max-md:hidden">
                  {a.partide.toLocaleString('ro-RO')}
                </Td>
                <Td num className="t-body text-ink-2 max-md:hidden">
                  {a.catches.toLocaleString('ro-RO')}
                </Td>
                <Td num>
                  <Kg kg={a.totalKg} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** fish AnglerRow's line: «{n} partidă/partide · {n} captură/capturi». */
export const subtitle = (a: { partide: number; catches: number }) =>
  `${formatCount(a.partide, 'partidă', 'partide')} · ${formatCount(a.catches, 'captură', 'capturi')}`;

/** The weight with its unit apart (owner rule 10); nothing weighed: «—». */
export function Kg({ kg }: { kg: number }) {
  if (!isWeighed(kg)) return <span className="t-body-strong text-muted">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="t-body-strong text-ink">{fmtKg(kg)}</span>
      <span className="ml-1 t-micro text-muted">kg</span>
    </span>
  );
}
