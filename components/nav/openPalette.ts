/**
 * Opens the top bar's ⌘K palette (CommandPalette, rendered once by the site shell) from anywhere on
 * the page — e.g. «Caută pescari» on /pescari/sugerati (fish's angler search button). A window event
 * rather than a context: the shell owns the palette's state, a page only asks for it.
 */
export const OPEN_PALETTE_EVENT = 'bluvi:open-palette';

export function openPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}
