import type { OwnedLake } from '@/core/booking';
import { routes } from '@/lib/routes';

/** Back from the picker: history when the previous page is ours, else Acasă (c1). */
export const PICKER_BACK = { fallbackHref: routes.home() } as const;

/** fish components/OwnedLakeCard.tsx LAKE_BG_FALLBACK (assets/images/lake.jpeg, bundled in public/). */
export const LAKE_COVER_FALLBACK = '/images/lake.jpeg';

/**
 * What /operator shows for the owned-lakes read (fish app/(app)/operator/index.tsx):
 *  - loading: the full-area loader (c2) — also while the single lake's redirect is under way, so the
 *    list never flashes before router.replace (c4);
 *  - error: the shared error screen (c3) — only when nothing is cached;
 *  - redirect: exactly one lake → replace with its panel (c4, operator.b.single-lake);
 *  - empty: «Nu administrezi niciun lac.» (c5);
 *  - list: the cards, in server order (c6).
 */
export type PickerView =
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'redirect'; lakeId: string }
  | { kind: 'empty' }
  | { kind: 'list'; lakes: OwnedLake[] };

export function pickerView(read: { data: OwnedLake[] | undefined; isPending: boolean; error: unknown }): PickerView {
  const { data } = read;
  if (data === undefined) {
    if (read.isPending) return { kind: 'loading' };
    return { kind: 'error', error: read.error };
  }
  if (data.length === 1 && data[0]?.documentId) return { kind: 'redirect', lakeId: data[0].documentId };
  if (data.length === 0) return { kind: 'empty' };
  return { kind: 'list', lakes: data };
}

/** The card's three tiles (c8): missing values read 0; the cash ro-RO grouped («1.250»), unit apart. */
export function lakeCardStats(lake: Pick<OwnedLake, 'pending' | 'active' | 'cashToCollect'>) {
  return {
    pending: lake.pending ?? 0,
    active: lake.active ?? 0,
    cash: formatLeiAmount(lake.cashToCollect ?? 0),
  };
}

/** fish `(lake.cashToCollect ?? 0).toLocaleString('ro-RO')` — whole lei, grouped with «.». */
export function formatLeiAmount(n: number): string {
  return (Number.isFinite(n) ? n : 0).toLocaleString('ro-RO', { maximumFractionDigits: 2 });
}

/** The card's cover: the lake's photo, else the bundled lake (c7). */
export function lakeCover(lake: Pick<OwnedLake, 'coverImageUrl'>): string {
  const url = lake.coverImageUrl?.trim();
  return url ? url : LAKE_COVER_FALLBACK;
}
