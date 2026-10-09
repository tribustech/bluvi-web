# lib/consent — cookie consent (m8.consent)

The site's consent layer. GDPR / ePrivacy: the optional categories are **off until the visitor opts
in** (a deviation from fish, where Google Analytics is «mandatory» — `fish/CMP/config/cmp.config.ts`).
Nothing is stored server-side and nothing goes to Firestore.

## Record

First-party cookie `bluvi_consent`, `Path=/; Max-Age=15552000 (180 days); SameSite=Lax; Secure` on https:

```json
{ "v": 1, "analytics": false, "errors": false, "at": "2026-10-09T10:00:00.000Z" }
```

| key | category | service |
|---|---|---|
| `analytics` | Analiză | Google Analytics 4 (gtag) |
| `errors` | Monitorizarea erorilor | Sentry, browser side |

A record with another `v` (or malformed) counts as no answer: the banner asks again. Bump
`CONSENT_VERSION` in `model.ts` when the categories or the services change.

## Which categories exist

`configured.ts`: «Analiză» only when `NEXT_PUBLIC_GA4_ID` is set, «Monitorizarea erorilor» only
when `NEXT_PUBLIC_SENTRY_DSN` is set (owner rule 4). With neither: no banner, and /cookie-uri lists
only «Strict necesare». A category that is not configured is always stored `false` (the record keeps
both keys). Turning a service on after launch: bump `CONSENT_VERSION` so earlier decisions are asked
again. Dev / e2e only: the cookie `bluvi_consent_preview=all` shows every category (`active.ts`).

## Public API (stable — used by M8-B2 for GA4 and Sentry)

```ts
import { readConsent, subscribeConsent, setConsent, openConsentSettings, CONSENT_EVENT } from '@/lib/consent';

readConsent(): Consent | null                 // the current decision, null = not decided yet
subscribeConsent(cb: (c: Consent) => void)    // every new decision in this tab; returns unsubscribe
setConsent(partial: Partial<{ analytics; errors }>): Consent | null  // over the current one (all-off base)
openConsentSettings(): void                   // opens the preferences dialog from anywhere
CONSENT_EVENT = 'bluvi:consent'               // CustomEvent<Consent> on window after every decision
useConsent(): Consent | null | undefined      // React: undefined while not mounted (server / hydration)
```

Rules for consumers:
- Load gtag / start Sentry's browser client only when `readConsent()?.analytics` / `?.errors` is
  true, and again on `CONSENT_EVENT` when it turns true.
- On `CONSENT_EVENT` with `analytics: false`: stop sending. `setConsent` already deletes `_ga` /
  `_ga_*` on the host and its parent domains.
- Server HTML never depends on consent: every page stays statically prerendered.

## UI

`components/consent/ConsentProvider.tsx` (mounted once in `app/layout.tsx`) renders the banner
(after mount, only when `readConsent()` is null) and the preferences dialog (opened by the banner's
«Personalizează» or by `openConsentSettings()`). The public page is `/cookie-uri`
(`routes.cookieSettings()`), which works as the no-JS fallback for every «Setări de
confidențialitate» entry.

The banner is not shown on /cookie-uri (the page is the decision UI). On phones it publishes its
height as `--consent-inset` on <html>; the fixed bottom bars (T3 DetailActionBar, T1 StickyActions,
«Arată harta») add it to their `bottom`.

## e2e

`playwright.config.ts` gives every spec `tests/e2e/helpers/consent-state.json` (a decided,
all-refused consent for localhost), so no spec sees the banner except `tests/e2e/consent.spec.ts`.
