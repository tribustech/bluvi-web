/*
 * Which optional consent categories exist on this deployment (m8.consent). Owner rule 4 — when we
 * don't know, don't show: a category is asked for and disclosed only when its service is configured.
 *  - «Analiză»                 ⇔ NEXT_PUBLIC_GA4_ID is set (GA4);
 *  - «Monitorizarea erorilor»  ⇔ NEXT_PUBLIC_SENTRY_DSN is set (Sentry in the browser).
 * With neither, there is no banner and /cookie-uri lists only «Strict necesare». The stored record
 * keeps both keys (shape unchanged); a category that is not active is always stored false.
 *
 * When a service is turned on after launch, bump CONSENT_VERSION (model.ts) so earlier decisions,
 * which did not cover it, are asked again.
 *
 * Dev / e2e only (dead code in a production build): the cookie `bluvi_consent_preview=all` shows
 * every category, so the banner and the dialog can be exercised without real ids.
 */

import type { ConsentChoice } from './model';

/** The categories whose service is configured (inlined at build time). Server-safe (no React). */
export const CONFIGURED: ConsentChoice = {
  analytics: Boolean(process.env.NEXT_PUBLIC_GA4_ID),
  errors: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
};

export function anyActive(a: ConsentChoice): boolean {
  return a.analytics || a.errors;
}

/** «Accept toate»: every active category on, the others stay off. */
export function acceptAll(a: ConsentChoice): ConsentChoice {
  return { analytics: a.analytics, errors: a.errors };
}
