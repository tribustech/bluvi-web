/** The consent layer's public API (m8.consent) — documented in ./README.md. */
export { CONSENT_EVENT, CONSENT_OPEN_EVENT, clearAnalyticsCookies, openConsentSettings, readConsent, setConsent, subscribeConsent } from './store';
export { useConsent } from './useConsent';
export { ALL_ACCEPTED, CONSENT_COOKIE, CONSENT_VERSION, NO_CHOICE, type Consent, type ConsentCategory, type ConsentChoice } from './model';
