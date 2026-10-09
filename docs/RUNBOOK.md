# Bluvi web — launch runbook

Owner steps for launch. Sections are added per M8 unit; the full runbook (deploy order CMS → web,
env vars, Vercel plan, domain + DNS, revalidation, AASA, rollback) is written by m8.runbook.

## GA4 property (m8.ga4)

The site sends GA4 events only after the visitor's «Analiză» opt-in (lib/analytics.ts,
components/analytics/). Owner steps, in the GA4 property:

1. **Create the web data stream** for the production domain and copy its measurement id (`G-…`).
2. **LAUNCH BLOCKER — enhanced measurement.** Admin → Data streams → the web stream → Enhanced
   measurement → gear icon:
   - turn **off** «Page changes based on browser history events»;
   - turn **off** «Site search».

   Why: the site sends its own `page_view` (fish screen names, `page_path` with only the reportable
   ids, no query string; `send_page_view: false` on config). With «history events» on, gtag.js adds
   a second, automatic `page_view` on every client navigation carrying the real URL — an angler's
   id (`/pescari/<id>`), a booking id, a Partide session id; with «Site search» on, it sends
   `view_search_results` with the free text typed in `?q=` on /pescari, /balti and /concursuri.
   Both double the page_view counts against the app and bypass the default-deny of
   components/analytics/screenNames.ts. Do not go live with GA4 until both are off.
3. Consider turning off «Outbound clicks» and «Form interactions» as well (they carry link URLs
   and form ids/names, nothing the app logs). Keep them only as a knowing choice. «Scrolls» and
   «Video engagement» are harmless but also not in the app's reports.
4. Admin → Data settings → Data filters: **activate the «Developer traffic» filter** (it ships in
   «Testing»), so `debug_mode` hits from a developer's opt-in (below) never reach the reports.
5. Google signals and ad personalisation stay off (the config also sends
   `allow_google_signals: false`, `allow_ad_personalization_signals: false`).

### Environment variables (Vercel)

| Name | Environments | Meaning |
|---|---|---|
| `NEXT_PUBLIC_GA4_ID` | **Production only** | The stream's measurement id. Unset → no GA at all (no script, no cookie). |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | Never in Production; set `1` only on a preview / local run you want to see in DebugView | Like fish `EXPO_PUBLIC_ANALYTICS_DEBUG`: outside production, GA runs only with this opt-in (and then sends `debug_mode`). |

GA runs only when the deployment resolves to production (`NEXT_PUBLIC_VERCEL_ENV=production` on a
non-staging host, see `resolveAppEnv`) or with the debug opt-in — so even an id set on «All
environments» does not let previews or QA runs reach the property. Still: set it on Production only.
