import { routes } from '@/lib/routes';
import type { OperatorBack } from './OperatorHeader';

/**
 * Back from a lake's panel (operator.panou) when there is no in-app history (a notification, a
 * shared link, a new tab): the picker only when the viewer owns more than one lake. A single-lake
 * operator would bounce — /operator replaces itself straight back with this panel
 * (operator.b.single-lake) and Back looks dead — so Acasă. Unknown count (the owned-lakes read is
 * still out or failed): Acasă too, the one target that is always safe. fish uses plain
 * router.back() here (app/(app)/operator/[lakeId]/index.tsx), never the picker.
 */
export function panelBack(ownedLakeCount: number | undefined): OperatorBack {
  return { fallbackHref: ownedLakeCount !== undefined && ownedLakeCount > 1 ? routes.operator() : routes.home() };
}
