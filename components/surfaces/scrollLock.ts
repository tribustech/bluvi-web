/**
 * The page behind a modal surface never scrolls or rubber-bands — iOS Safari included, where the
 * root's `overflow: hidden` alone still lets a touch on the scrim, or on a sheet whose content does
 * not overflow, drag (rubber-band) the page and the visual viewport.
 *
 *  - the root gets `overflow: hidden` and `overscroll-behavior: none` (wheel, keyboard, desktop);
 *  - a non-passive touchmove guard cancels every touch scroll that no scroller INSIDE the top modal
 *    <dialog> can take in its direction — so the dialog's own lists still scroll (and, with
 *    `overscroll-behavior: contain`, never hand the gesture on), but the page never moves. A scroller
 *    already at its end in that direction is no scroller: that pull would chain to the page.
 *
 * No `position: fixed` body: that unpins every sticky header behind the scrim (they jump off screen
 * for as long as the sheet is open). Reference-counted: a sheet over a dialog keeps the lock until
 * both are gone; the scroll position is never touched, so nothing needs restoring.
 */
let count = 0;
/** Bumped by a forced release: a releaser from before it has nothing left to undo. */
let pageGen = 0;
let saved: { root: string } | null = null;
let startX = 0;
let startY = 0;

function scrollable(el: Element, axis: 'x' | 'y', delta: number): boolean {
  const s = getComputedStyle(el);
  const overflow = axis === 'y' ? s.overflowY : s.overflowX;
  if (overflow !== 'auto' && overflow !== 'scroll') return false;
  const h = el as HTMLElement;
  if (axis === 'y') {
    if (h.scrollHeight <= h.clientHeight + 1) return false;
    // delta > 0: the finger moves down — the content scrolls toward its top.
    return delta > 0 ? h.scrollTop > 0 : h.scrollTop + h.clientHeight < h.scrollHeight - 1;
  }
  if (h.scrollWidth <= h.clientWidth + 1) return false;
  return delta > 0 ? h.scrollLeft > 0 : h.scrollLeft + h.clientWidth < h.scrollWidth - 1;
}

/** The topmost open modal dialog (the last one shown), or null. */
function topDialog(): HTMLDialogElement | null {
  const open = document.querySelectorAll<HTMLDialogElement>('dialog[open]');
  for (let i = open.length - 1; i >= 0; i--) if (open[i]!.matches(':modal')) return open[i]!;
  return open.length ? open[open.length - 1]! : null;
}

function onTouchStart(e: TouchEvent) {
  const t = e.touches[0];
  if (!t) return;
  startX = t.clientX;
  startY = t.clientY;
}

function onTouchMove(e: TouchEvent) {
  if (!e.cancelable || e.touches.length !== 1) return;
  const t = e.touches[0]!;
  const dx = t.clientX - startX;
  const dy = t.clientY - startY;
  const axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
  const delta = axis === 'y' ? dy : dx;
  const dialog = topDialog();
  let el = e.target instanceof Element ? e.target : null;
  // Outside the top dialog (its scrim is the dialog itself): nothing may scroll.
  if (dialog && el && dialog.contains(el) && el !== dialog) {
    // A text field keeps its own caret / selection drag.
    if (el.closest('input, textarea, [contenteditable="true"]')) return;
    // An element that handles the gesture itself (a map, a slider, a drag handle).
    if (el.closest('[data-own-gesture]')) return;
    for (; el && el !== dialog; el = el.parentElement) {
      if (scrollable(el, axis, delta)) return;
    }
  }
  e.preventDefault();
}

export function lockPageScroll(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (count++ === 0) {
    const root = document.documentElement;
    saved = { root: root.style.cssText };
    root.style.overflow = 'hidden';
    root.style.overscrollBehavior = 'none';
    root.dataset.scrollLocked = '';
    document.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  }
  const gen = pageGen;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    // Force-released since (releaseOrphanLocks): nothing left to undo.
    if (gen !== pageGen) return;
    if (--count > 0) return;
    releasePage();
  };
}

function releasePage() {
  count = 0;
  pageGen++;
  const root = document.documentElement;
  if (saved) root.style.cssText = saved.root;
  saved = null;
  delete root.dataset.scrollLocked;
  document.removeEventListener('touchstart', onTouchStart, { capture: true });
  document.removeEventListener('touchmove', onTouchMove, { capture: true });
}

/* ------------------------------------------------------------------ the full-screen map's lock */

/**
 * A full-screen map (T2Viewport, phone) takes the document's scroll away: `html[data-viewport-lock]`
 * (globals.css, below 768). Owned by the mounted map — set in its layout effect, removed in that
 * effect's cleanup — never inferred from the DOM: Next's cacheComponents keeps the previous route
 * mounted but hidden (React <Activity>), so a `:has([data-viewport-lock])` rule kept the lake page
 * reached from the map, /balti reached back from it, any tab, unscrollable (owner 2026-10-11).
 * Activity runs the cleanup when it hides the route, and the effect again when it shows it.
 */
let viewportLocks = 0;
let viewportGen = 0;

export function lockViewport(): () => void {
  if (typeof document === 'undefined') return () => {};
  if (viewportLocks++ === 0) document.documentElement.dataset.viewportLock = '';
  const gen = viewportGen;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (gen !== viewportGen) return;
    if (--viewportLocks > 0) return;
    releaseViewport();
  };
}

function releaseViewport() {
  viewportLocks = 0;
  viewportGen++;
  delete document.documentElement.dataset.viewportLock;
}

/** A visible (not display:none, not in a hidden <Activity>) element. */
const shown = (el: Element) => el.getClientRects().length > 0;

/**
 * After a navigation (ShellScrollGuard, on every pathname change): a lock whose owner is no longer
 * on screen is released. Belt and braces — every lock is released by its owner's cleanup; this
 * only guarantees a new page is never left unscrollable by one that leaked.
 */
export function releaseOrphanLocks() {
  if (typeof document === 'undefined') return;
  if (viewportLocks > 0 && ![...document.querySelectorAll('[data-viewport-frame]')].some(shown)) releaseViewport();
  if (count > 0 && ![...document.querySelectorAll('dialog[open]')].some(shown)) releasePage();
}
