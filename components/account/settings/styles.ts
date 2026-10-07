/*
 * Class lists of the settings kit, in a module with no 'use client' so a Server Component (a route's
 * loading.tsx, a Suspense fallback) gets the strings themselves, not client references.
 *
 * Geometry (fish components/settings/SettingsRows.tsx, on the web scale):
 * - the card: white, radius 16 (rounded-card), the hairline ring (shadow-e0); rows run edge to edge
 *   inside it (their hover tint and focus ring meet the card's edges), 16 / 20 side padding;
 * - a row: 20px icon · 12 · the label (body-strong) · the trailing control; at least 56 tall
 *   (fish paddingVertical 14 around a 20–28 line), so every target clears 48;
 * - the helper line under a row starts on the label's edge (icon 20 + gap 12 = 32: fish paddingLeft 30).
 */

/**
 * The settings column — the same edges as /notificari (account.notifications NotificationsFrame), so
 * going between the two never moves the header: below 1280 one column up to 720, centred (a phone's
 * cards; on a tablet a switch stays next to its label); from 1280 anchored to the shell's left gutter
 * (ROADMAP §4: full width with the shell gutters) and capped at 840 — a row is a short line with a
 * control at its end, never a label at 0 and its switch 1600px away.
 */
export const SETTINGS_COLUMN = 'mx-auto w-full max-w-180 xl:mx-0 xl:max-w-210';

/**
 * From 1280: the column (≤ 840) and a docked side column right after it, on T1's right track (320 →
 * 360 from 1440, 24 apart), left-aligned in the shell. Fixed tracks: the cards never change width when
 * the side column is empty or loading.
 */
export const SETTINGS_BODY =
  'xl:grid xl:items-start xl:gap-6 xl:grid-cols-[minmax(0,--spacing(210))_--spacing(80)] 2xl:grid-cols-[minmax(0,--spacing(210))_--spacing(90)]';

/** The docked side column (≥ 1280 only; below it the screen says what it needs in the cards). */
export const SETTINGS_ASIDE = 'hidden xl:sticky xl:top-22 xl:flex xl:flex-col xl:gap-4';

/** fish SettingsCard: white, radius 16. overflow-hidden clips a row's hover tint to the radius. */
export const SETTINGS_CARD = 'overflow-hidden rounded-card bg-surface shadow-e0';

/** Row padding: fish paddingHorizontal 16 (20 from 768, the card rhythm of the templates). */
export const ROW_PAD_X = 'px-4 md:px-5';

/** The row's line: icon · label · trailing. */
export const ROW_LINE = 'flex min-h-14 items-center gap-3 py-3';

/** The helper under a row's line: on the label's edge (icon 20 + gap 12), caption, muted. */
export const ROW_HELPER = 't-caption -mt-1.5 pb-3.5 pl-8 text-muted';

/** The 20px leading icon slot (fish 20, black). */
export const ROW_ICON = 'size-5 shrink-0 text-ink [&>svg]:size-5';

/** Keyboard focus inside the clipped card: an inset ring (an outer one would be cut by overflow-hidden). */
export const ROW_FOCUS =
  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/** The uppercase section label (fish Typography caption $gray5, paddingLeft 4). */
export const SECTION_LABEL = 't-eyebrow px-1 text-muted uppercase';

/** Sections and lone cards stack 16 apart (fish gap 16), 24 from 768. */
export const SETTINGS_STACK = 'flex flex-col gap-4 md:gap-6';
