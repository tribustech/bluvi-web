/**
 * The two inset rings every template draws — ONE source, so the selection weight cannot drift
 * between templates again (T1/T2 had 1.5px, T4/T6 2px):
 *  - selected: a checked chip / tile / choice card (accent-tint fill + this 2px accent ring);
 *  - danger line: a card or field group in error (1px status-danger-line instead of the e0 hairline).
 * Written as literal class strings per variant (Tailwind reads the source).
 * TODO(globals.css): promote to `--shadow-selected` / `--shadow-danger-line` in @theme and replace
 * these with `shadow-selected` / `shadow-danger-line` (needs the owner of app/globals.css).
 */
export const RING_SELECTED = 'shadow-[inset_0_0_0_2px_var(--color-accent)]';
export const RING_SELECTED_CHECKED = 'has-checked:shadow-[inset_0_0_0_2px_var(--color-accent)]';
export const RING_SELECTED_EXPANDED = 'aria-expanded:shadow-[inset_0_0_0_2px_var(--color-accent)]';
export const RING_DANGER = 'shadow-[inset_0_0_0_1px_var(--color-status-danger-line)]';
