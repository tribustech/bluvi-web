/*
 * Pure stand labels — fish helpers/formatNationalStand.ts + helpers/formatStandLabel.ts.
 * TODO(core): these belong in core/organizer/domain (the scale screens need them); kept here
 * because this task may only touch the T6 folders.
 */

const sectorLetter = (sectorName: string | null | undefined): string => {
  const s = (sectorName ?? '').trim();
  if (s.length <= 1) return s;
  const tail = s.match(/[A-Za-z]\s*$/);
  return tail?.[0]?.trim() ?? s[s.length - 1] ?? s[0] ?? '';
};

/** fish `formatNationalStand`: «A1(10)» with a draw position, «A10» without. */
export function formatNationalStand(
  sectorName: string | null | undefined,
  sectorDrawPosition: number | null | undefined,
  standName: string | number | null | undefined,
): string {
  const letter = sectorLetter(sectorName);
  const stand = standName == null ? '' : String(standName);
  return sectorDrawPosition != null ? `${letter}${sectorDrawPosition}(${stand})` : `${letter}${stand}`;
}

/** fish `formatStandLabel`: «Stand A1(10)» on NC, «Sector A, Stand 10» otherwise. */
export function formatStandLabel(
  isNc: boolean,
  sectorName: string,
  sectorDrawPosition: number | null | undefined,
  standName: string | number | null | undefined,
): string {
  const stand = standName == null ? '' : String(standName);
  if (isNc) return `Stand ${formatNationalStand(sectorName, sectorDrawPosition ?? null, stand)}`;
  return `Sector ${sectorName}, Stand ${stand}`;
}

/** fish scale/index.tsx tile label: «Stand A1(10)» on NC, «Stand 10» otherwise. */
export function standTileLabel(isNc: boolean, sectorName: string, drawPosition: number | null, standName: string): string {
  return isNc ? `Stand ${formatNationalStand(sectorName, drawPosition, standName)}` : `Stand ${standName}`;
}
