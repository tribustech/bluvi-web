/** Controls that own a keyboard focus ring (Fundații §07); everything else is a landing spot. */
const CONTROL = 'a[href],button,input,select,textarea,summary,[contenteditable],[role=button],[role=link],[role=tab],[role=option],[role=menuitem]';

/**
 * Moves focus to a landing spot after navigation, a retry or a removal (a heading, a section, a
 * region) — WCAG 2.4.3 — without the ring: owner rule 8 (ROADMAP §4b) keeps rings for keyboard
 * focus on controls. The browser would otherwise draw `:focus-visible` on it whenever the action
 * that moved focus came from the keyboard. A control passed in is focused as is, ring and all.
 */
export function focusLandingSpot(el: HTMLElement, options?: FocusOptions) {
  if (!el.matches(CONTROL)) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    if (el.getAttribute('tabindex') === '-1') el.classList.add('outline-none');
  }
  el.focus(options);
}
