/**
 * fish `features/partide/helpers/partidaTabs.ts` — pure tab-visibility logic for the partidă screen
 * shell, kept UI-free so the tab set and the landing tab are unit-testable without React.
 * (fish's `SceneProps` contract is the web's `_member/tabs` frame, not data: it stays with the app.)
 */

export type PartidaTabKey = 'crono' | 'jurnal' | 'galerie' | 'stats' | 'info';

/** Ended partide drop the live Cronometre tab. */
export function visibleTabs(isEnded: boolean): PartidaTabKey[] {
  return isEnded ? ['jurnal', 'galerie', 'stats', 'info'] : ['crono', 'jurnal', 'galerie', 'stats', 'info'];
}

/** Landing tab: ended → Jurnal; active → Cronometre when it has rods, else Jurnal. */
export function initialTab(isEnded: boolean, rodCount: number): PartidaTabKey {
  if (isEnded) return 'jurnal';
  return rodCount > 0 ? 'crono' : 'jurnal';
}

/**
 * fish `[id].tsx` live → ended effect: the tab SET shrinks under the viewer (a teammate finished);
 * the selected tab is kept when it still exists, else the ended landing tab (Jurnal) is chosen.
 */
export function tabAfterEndedChange(selected: PartidaTabKey, isEnded: boolean, rodCount: number): PartidaTabKey {
  return visibleTabs(isEnded).includes(selected) ? selected : initialTab(isEnded, rodCount);
}
