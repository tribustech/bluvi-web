/*
 * /partide/[id]/capturi columns, shared by the page and its skeleton so nothing moves when the data
 * lands (ROADMAP §5, CLS < 0.05):
 *  - phone: fish's one white card of rows;
 *  - from 768 a real table (owner rule 14: every column visible — [zi,] ora, fotografie, specie,
 *    greutate), columns sized to their content and the table only as wide as they need (rule 16:
 *    600, so the kg stays within reach of its species instead of floating across the screen);
 *  - from 1280 the partidă's summary card docks right beside it (320 / 360 from 1440, the template
 *    tracks), sticky under the bar; the leftover width of a wide window stays margin (rule 16).
 */

export const BODY =
  'flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,--spacing(150))_--spacing(80)] xl:items-start xl:gap-6 2xl:grid-cols-[minmax(0,--spacing(150))_--spacing(90)]';

export const LIST_COLUMN = 'flex min-w-0 flex-col gap-4 md:max-w-150';

/** The summary card: docked from 1280 only (the phone keeps fish's single list). */
export const SIDE = 'hidden xl:sticky xl:top-22 xl:flex xl:flex-col xl:gap-4';

/** The table's columns (the <col> widths and the skeleton's cells share them). */
export const COL = {
  /** «10 AUG», first column of a multi-day partidă (its 20px side padding included). */
  day: 'w-22',
  /** «14:50» as the first column (side padding included)… */
  time: 'w-22',
  /** …or after «Zi». */
  timeAfterDay: 'w-16',
  photo: 'w-20',
  kg: 'w-28',
} as const;

/** The table's white card. */
export const CARD = 'overflow-hidden rounded-card bg-surface shadow-e0';
