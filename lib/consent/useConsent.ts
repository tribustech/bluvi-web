'use client';

import { useSyncExternalStore } from 'react';
import type { Consent } from './model';
import { CONSENT_EVENT, readConsent } from './store';

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  // Another tab's decision lands on the next focus (document.cookie is shared, events are not).
  window.addEventListener('focus', onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener('focus', onChange);
  };
}

const UNKNOWN = () => undefined;

/**
 * The visitor's decision: undefined on the server and during hydration (unknown — render nothing
 * that depends on it, owner rule 4), then the Consent or null (not decided).
 */
export function useConsent(): Consent | null | undefined {
  return useSyncExternalStore<Consent | null | undefined>(subscribe, readConsent, UNKNOWN);
}
