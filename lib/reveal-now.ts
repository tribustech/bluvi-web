/*
 * Suspense reveals without React's 300 ms throttle (M8-B4, global.b.performance-audit).
 *
 * React 19.2's streaming runtime batches the reveal of every Suspense boundary that completes after
 * the shell has painted: the inline `$RC` script waits until 300 ms after the previous reveal (and
 * never reveals between 2.0 and 2.3 s), counting from a `$RT` timestamp the shell sets on its first
 * animation frame (react-dom-server `completeBoundaryScriptFunctionOnly`, `shellTimeRuntimeScript`).
 *
 * Every boundary bigger than React's progressive chunk (12.8 KB of HTML, which the shell's head and
 * top bar already use up) is streamed that way — including the ones the build prerendered: a lake's
 * photos, a competition's header, a news article, the Partide hub. So the page's main content (the
 * LCP element) always painted at least 300 ms after the shell, once the JavaScript had already
 * loaded; Lighthouse's simulated mobile run then charges the whole bundle's download and
 * evaluation to the LCP (LCP 4.4–5.5 s on the audited pages, docs/reviews/M8-notes.md
 * «m8.perf-audit»).
 *
 * The script keeps `$RT` unset: `$RC` then takes its first branch, `requestAnimationFrame`, and a
 * boundary is revealed on the frame after it arrives — what React did before 19.2. It only touches
 * the timing of reveals (React's own runtime still moves the nodes), it runs before any of React's
 * scripts (first in <head>), and if a React version renames the variable it does nothing at all:
 * the throttle simply comes back. Remove it if React makes the throttle configurable.
 */
export const REVEAL_NOW_SCRIPT = "try{Object.defineProperty(window,'$RT',{configurable:true,get:function(){},set:function(){}})}catch(e){}";
