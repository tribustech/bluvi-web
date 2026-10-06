/**
 * The side-column tracks and the column gap of EVERY template body from 1280 (ROADMAP §4 width
 * rule: three columns from 1280 where the template has them) — one scale, so the centre column's
 * edges stay put going from Acasă (T5) to a list (T1), a lake or a competition (T3), a booking (T4)
 * or the scale (T6).
 *
 *               1280 (xl)   1440 (2xl, --breakpoint-2xl)
 *   left          240          256      context, filters, the section index
 *   right         320          360      details, «ce mă așteaptă», the summary
 *   right wide    360          400      a task's companion column (T6), one step up the same scale
 *   right late     —           320      a right column that only joins from 1440 (*ThenRight)
 *   gap            24           24      between columns
 *
 * Written as literal class strings (Tailwind reads the source), on the spacing scale. The shell
 * column is the window less 2 × 32 gutters (1216 at 1280, 1376 at 1440, capped at 1680):
 *  - three columns at 1280: 1216 − 240 − 320 − 2×24 = 608 for the centre;
 *  - three columns at 1440: 1376 − 256 − 360 − 48 = 712, growing with the window up to
 *    1680 − 256 − 360 − 48 = 1016;
 *  - a late right column (leftMainThenRight / mainThenRight) is for a centre that needs the room
 *    more than the aside needs to be seen (a poster grid): it joins at 1440 on the 1280 step (320),
 *    so the centre is 1376 − 256 − 320 − 48 = 752 there — still three 240px posters at 16 apart
 *    (T1 ListGrid `sm`), never fewer columns than 1280's 952 held. Never use it for a table: a
 *    table takes the whole column (ROADMAP §4).
 * TODO(globals.css): promote to `--container-rail-left / -rail-right / -rail-wide` in @theme.
 */
export const TRACKS = {
  /** left · centre · right */
  three: 'xl:grid-cols-[--spacing(60)_minmax(0,1fr)_--spacing(80)] 2xl:grid-cols-[--spacing(64)_minmax(0,1fr)_--spacing(90)]',
  /** left · centre */
  leftMain: 'xl:grid-cols-[--spacing(60)_minmax(0,1fr)] 2xl:grid-cols-[--spacing(64)_minmax(0,1fr)]',
  /** centre · right */
  mainRight: 'xl:grid-cols-[minmax(0,1fr)_--spacing(80)] 2xl:grid-cols-[minmax(0,1fr)_--spacing(90)]',
  /** centre · right wide */
  mainWide: 'xl:grid-cols-[minmax(0,1fr)_--spacing(90)] 2xl:grid-cols-[minmax(0,1fr)_--spacing(100)]',
  /** left · centre at 1280, the right column (320) joining from 1440 */
  leftMainThenRight: 'xl:grid-cols-[--spacing(60)_minmax(0,1fr)] 2xl:grid-cols-[--spacing(64)_minmax(0,1fr)_--spacing(80)]',
  /**
   * centre · right at 1280, the left column joining from 1440 (Acasă: at 1280 a three-column body
   * leaves 608 for the centre — two rail cards; centre · right gives it 1216 − 320 − 24 = 872,
   * three cards, the density 1440 has). The page carries the left column's blocks in the right one
   * at 1280 (DashboardLayout `contextFrom="2xl"`).
   */
  mainRightThenThree: 'xl:grid-cols-[minmax(0,1fr)_--spacing(80)] 2xl:grid-cols-[--spacing(64)_minmax(0,1fr)_--spacing(90)]',
  /** one column at 1280, the right column (320) joining from 1440 */
  mainThenRight: 'xl:grid-cols-[minmax(0,1fr)] 2xl:grid-cols-[minmax(0,1fr)_--spacing(80)]',
} as const;

/** The one column gap between template columns (24). */
export const TRACK_GAP = 'xl:gap-6';
/** The same gap, columns only (a body whose rows keep their own gap). */
export const TRACK_GAP_X = 'xl:gap-x-6';
