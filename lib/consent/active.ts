'use client';

/*
 * The active consent categories in the browser (m8.consent): CONFIGURED (./configured.ts), or, in a
 * dev / e2e build only (dead code in production), every category when the cookie
 * `bluvi_consent_preview=all` is set, so the banner and the dialog can be exercised without real ids.
 */

import { useSyncExternalStore } from 'react';
import { CONFIGURED } from './configured';
import { cookieValue, type ConsentChoice } from './model';

export { acceptAll, anyActive, CONFIGURED } from './configured';

export const PREVIEW_COOKIE = 'bluvi_consent_preview';
const PREVIEW_ALL: ConsentChoice = { analytics: true, errors: true };

function read(): ConsentChoice {
  if (process.env.NODE_ENV !== 'production' && typeof document !== 'undefined' && cookieValue(document.cookie, PREVIEW_COOKIE) === 'all') {
    return PREVIEW_ALL;
  }
  return CONFIGURED;
}

const noSubscribe = () => () => {};

/** The active categories: CONFIGURED in the server HTML and on hydration, then the client's value. */
export function useActiveCategories(): ConsentChoice {
  return useSyncExternalStore(noSubscribe, read, () => CONFIGURED);
}
