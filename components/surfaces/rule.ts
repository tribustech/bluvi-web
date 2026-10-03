/**
 * Which temporary surface to open — the Fundații §07 rule.
 *
 * - **Mobile (<768): always a Sheet** (bottom, swipe, snap 50/90%).
 * - **Tablet (768–1279): sheets become Dialogs** (centered, max 480) — there is no room for a
 *   side panel next to a two-column layout.
 * - **Desktop (≥1280):**
 *   - `context` — the user must keep seeing the list behind it (a stand, an angler, a weighing):
 *     **SidePanel**, 420px, docked next to the content so the list stays visible and clickable.
 *   - `decision` — a choice that interrupts (cancel, penalty, confirm): **Dialog**.
 *
 * Pure function so it is usable from server code and tests; `useBreakpoint()` supplies the
 * breakpoint in the browser.
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop';
export type SurfaceIntent = 'context' | 'decision';
export type SurfaceKind = 'sheet' | 'dialog' | 'panel';

export const BREAKPOINT_MD = 768;
export const BREAKPOINT_XL = 1280;

export function breakpointForWidth(width: number): Breakpoint {
  if (width >= BREAKPOINT_XL) return 'desktop';
  if (width >= BREAKPOINT_MD) return 'tablet';
  return 'mobile';
}

export function pickSurface(intent: SurfaceIntent, breakpoint: Breakpoint): SurfaceKind {
  if (breakpoint === 'mobile') return 'sheet';
  if (breakpoint === 'desktop' && intent === 'context') return 'panel';
  return 'dialog';
}
