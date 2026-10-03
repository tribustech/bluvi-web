import type { ColumnDefinition } from '@/core/competitions/domain/table/getTableColumns';

/*
 * Web presentation of the builders' columns (core/competitions/domain/table/getTableColumns).
 * The builders stay the source of WHICH columns a ranking type has; the web only renames them to
 * the Fundații wording and orders them Loc · Stand · Pescar · values · Loc sector · Puncte.
 */

export type WebColumn = ColumnDefinition & {
  align: 'left' | 'right';
  kind: 'place' | 'stand' | 'name' | 'weight' | 'count' | 'points' | 'catch';
};

const WEIGHT_KEYS = new Set([
  'quantity',
  'quality',
  'quality1',
  'biggestFish',
  'topNCatchesAvarage',
  'averageBestN',
]);
const COUNT_KEYS = new Set(['catchCount', 'bestOfCount', 'sectorPosition']);

function rank(key: string): number {
  if (key === 'generalPosition') return 0;
  if (key === 'position') return 1;
  if (key === 'participant') return 2;
  if (key === 'bestOfCount') return 3;
  const catchMatch = /^catch(\d+)$/.exec(key);
  if (catchMatch) return 10 + Number(catchMatch[1]) / 1000;
  if (key === 'quantity') return 30;
  if (['quality', 'quality1', 'topNCatchesAvarage', 'averageBestN'].includes(key)) return 29;
  if (key === 'catchCount') return 31;
  if (key === 'biggestFish') return 32;
  const tierMatch = /^tier(\d+)$/.exec(key);
  if (tierMatch) return 40 + Number(tierMatch[1]) / 1000;
  if (key === 'sectorPosition') return 50;
  if (key === 'totalPoints') return 61;
  if (/Points$/.test(key)) return 60;
  return 45;
}

export function toWebColumns(columns: ReadonlyArray<ColumnDefinition>): WebColumn[] {
  const keys = new Set(columns.map(c => c.key));
  const singlePoints = !keys.has('totalPoints');
  const title = (c: ColumnDefinition): string => {
    switch (c.key) {
      case 'generalPosition':
        return 'Loc';
      case 'position':
        return 'Stand';
      case 'participant':
        return 'Pescar';
      case 'quantity':
        return 'Cantitate';
      case 'catchCount':
        return 'Capturi';
      case 'biggestFish':
        return 'CMMC';
      case 'sectorPosition':
        return 'Loc sector';
      case 'totalPoints':
        return 'Puncte';
      case 'quantityPoints':
        return singlePoints ? 'Puncte' : 'Pct. cantitate';
      case 'qualityPoints':
        return singlePoints ? 'Puncte' : 'Pct. calitate';
      default:
        return c.title;
    }
  };
  return columns
    .map((c, i) => ({ c, i }))
    .sort((a, b) => rank(a.c.key) - rank(b.c.key) || a.i - b.i)
    .map(({ c }) => {
      const kind: WebColumn['kind'] =
        c.key === 'generalPosition'
          ? 'place'
          : c.key === 'position'
            ? 'stand'
            : c.key === 'participant'
              ? 'name'
              : /^(catch|tier)\d+$/.test(c.key)
                ? 'catch'
                : WEIGHT_KEYS.has(c.key)
                  ? 'weight'
                  : COUNT_KEYS.has(c.key)
                    ? 'count'
                    : 'points';
      return { ...c, title: title(c), kind, align: kind === 'place' || kind === 'stand' || kind === 'name' ? 'left' : 'right' };
    });
}
