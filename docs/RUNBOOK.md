# Bluvi web — launch runbook

How to take bluvi-web from the Vercel preview to the production domain, how to check it, and how to
undo it. Written for the owner. This repo is public: the runbook names variables and steps, **never
values**. Secrets live in Vercel / DigitalOcean; CMS patch details and grants are in the private
notes (git-ignored `docs/private/`, «the private CMS patches note» and «the private grants note»
below).

Order of the whole launch, in one line: **owner accounts (§1) → env vars (§2) → CMS deploy and
verify (§3.1) → web deploy + domain (§3.2) → revalidation webhook (§3.3) → checks (§4) → indexable
(§3.4) → universal links (§5)**. Rollback is §6, monitoring §7.

---

## 1. Owner decisions and accounts

Tick every box before the launch day. Agents cannot do any of these.

### 1.1 Domain and URL scheme

- [ ] **Pick the web domain** (docs/reviews/M8-url-scheme.md, decision 1). The recommendation is
      option A: the web on its own brand domain (e.g. `bluvi.ro`), `bluvi-app.wearetribus.com`
      stays the app-links domain.
- [ ] **Slug or documentId** (same doc, decision 2). The launch can go out on documentId URLs; a
      slug later only adds 308s, so this does not block the launch.
- [ ] **DNS** at the registrar, for the chosen domain:
  - apex (`bluvi.ro`): the `A` record Vercel shows in Project → Settings → Domains;
  - `www`: `CNAME` to the Vercel target shown there;
  - pick one canonical host (apex recommended) and set the other to redirect to it in Vercel
    Domains (308). `NEXT_PUBLIC_SITE_URL` is the canonical one.
  - Lower the TTL of the records you will change to 300 s a day before the launch (makes §6.3 fast).
  - CAA: if the zone has CAA records, allow `letsencrypt.org` (Vercel's certificates).
- [ ] The certificate shows «Valid» in Vercel Domains for both hosts before you promote.

### 1.2 Vercel

- [ ] **Pro plan** on the team that owns the project (Hobby forbids commercial use). Relevant limits
      to keep in mind:
  - function request body 4.5 MB: photo uploads are compressed in the browser before
    `/api/cms/upload`, so they stay under it;
  - the build prerenders every public page from the CMS (`cacheComponents` + `'use cache'`, tagged
    with the CMS cache tags). A slow CMS makes the build slow, not broken; a page that cannot be
    prerendered in 60 s fails the build (see docs/reviews/M8-notes.md, sitemap walk);
  - pages refresh through Next `revalidateTag` (§3.3 webhook), not time-based ISR: no ISR write
    budget to plan for beyond normal traffic.
- [ ] **Vercel Web Analytics and Speed Insights stay OFF.** The cookie banner only covers GA4 and
      Sentry; turning another tracker on needs a new consent category first.
- [ ] Production branch: `main` (`v2` merges there at launch). Preview deployments for every PR
      stay on, with deployment protection on.
- [ ] While previews (including the staging web host) stay protected: Project → Settings →
      Deployment Protection → **«Protection Bypass for Automation»** → create the secret. It goes
      into the staging CMS as `WEB_REVALIDATE_BYPASS` (§2.2); without it Vercel answers every
      staging purge with 401 before `/api/revalidate` runs, and staging pages refresh only on
      their TTL.
- [ ] Project → Settings → Environment Variables → **«Automatically expose System Environment
      Variables» stays ON.** GA and the environment detection (`resolveAppEnv`, Sentry
      environment) read `NEXT_PUBLIC_VERCEL_ENV`, which Vercel inlines only while this toggle is
      on. Off → GA never loads in production, even after consent, and nothing else fails.
- [ ] Production env vars (§2) set **before** the production build: everything `NEXT_PUBLIC_*`,
      `SITE_INDEXABLE` and the Sentry build vars are read **at build time**. Changing one later means
      a redeploy.

### 1.3 GA4 property

The site sends GA4 events only after the visitor's «Analiză» opt-in (lib/analytics.ts,
components/analytics/). Owner steps, in the GA4 property:

1. **Create the web data stream** for the production domain and copy its measurement id (`G-…`)
   into `NEXT_PUBLIC_GA4_ID` (Production only).
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
   «Testing»), so `debug_mode` hits from a developer's opt-in (`NEXT_PUBLIC_ANALYTICS_DEBUG`) never
   reach the reports.
5. Google signals and ad personalisation stay off (the config also sends
   `allow_google_signals: false`, `allow_ad_personalization_signals: false`).

GA runs only when the deployment resolves to production (`NEXT_PUBLIC_VERCEL_ENV=production` on a
non-staging host, see `resolveAppEnv`) or with the debug opt-in — so even an id set on «All
environments» does not let previews or QA runs reach the property. Still: set it on Production only.

### 1.4 Sentry

- [ ] Sentry org + a **new project** for the web (platform «Next.js»), separate from the app's
      project, so web errors do not mix with app releases.
- [ ] Copy the project DSN into `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser). The
      DSN is not a secret, but keep it out of the repo anyway.
- [ ] An **organization auth token** with the source-map upload scope → `SENTRY_AUTH_TOKEN`
      (build only), plus `SENTRY_ORG` / `SENTRY_PROJECT` slugs. Without all three the build skips
      the upload and stack traces stay minified; nothing else changes.
- [ ] Project settings: Data scrubbing on (defaults), «Prevent storing of IP addresses» on.
      Session Replay stays off (not covered by the consent copy).
- [ ] Alerts (§7).

Sentry reports only from `production`, `preview` and `staging` (`SENTRY_ENVIRONMENT`, else
Vercel's `VERCEL_ENV`). The server side reports regardless of consent; the browser SDK loads only
after the «Monitorizarea erorilor» opt-in.

### 1.5 Sign-in consoles (production domain)

For each provider, add the **production origin** (and the `www` host if it is served) next to the
preview / localhost entries that already exist:

- [ ] **Google** (Cloud console → APIs & Services → Credentials → the web OAuth client used by the
      CMS's `GOOGLE_CLIENT_ID`): Authorized JavaScript origins += `https://<domain>`. The web uses
      the code flow in a popup, so no redirect URI on the web host is needed beyond what the client
      already lists. Same client id as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- [ ] **Facebook** (Meta developer console → the Bluvi app): App domains += `<domain>`; Facebook
      Login → Settings → Allowed domains for the JavaScript SDK += `https://<domain>`. The app must
      be in Live mode.
- [ ] **Apple** (developer portal): a **Services ID** for the web (Sign in with Apple configured
      with the primary App ID), Domains += `<domain>`, Return URLs += the exact
      `NEXT_PUBLIC_APPLE_REDIRECT_URI`. The CMS must accept that Services ID as an audience (CMS
      patch P3, deployed with its env per the private CMS patches note).
- [ ] **Firebase** (same project as the app; chat only): Authentication → Settings → Authorized
      domains += `<domain>`. If the web API key has HTTP-referrer restrictions in Google Cloud,
      add `https://<domain>/*`.

### 1.6 Universal links (app ↔ web)

Follow the decision in docs/reviews/M8-url-scheme.md §2. With option A nothing changes in the app
or in the AASA / `assetlinks.json` files; `bluvi-redirect-stores` gets server-side redirect rules
on Amplify (steps in §5). With option B the web would have to serve both `.well-known` files
itself — that is a separate unit, not built.

- [ ] Decision 3 of the URL-scheme doc taken (what the redirect-stores host does for visitors
      without the app).
- [ ] Whoever owns the Amplify app for `bluvi-redirect-stores` is available on launch day.

### 1.7 Legal

- [ ] **Termly privacy policy** updated (the policy the app and the web link to) to mention the
      website: the `bluvi_session` (sign-in) and `bluvi_consent` cookies, Google Analytics 4 cookies
      (`_ga`, `_ga_*`) set only after consent, Sentry error monitoring in the browser after consent
      and on the server, Vercel as host. The categories and their wording match `/cookie-uri`.
- [ ] Cookie policy section (or Termly cookie policy) lists the same cookies with their lifetimes
      (`bluvi_consent` 180 days).

---

## 2. Environment variables

Names only. «Build» = read while `next build` runs: changing it needs a redeploy. Vercel sets
`VERCEL_ENV` / `NEXT_PUBLIC_VERCEL_ENV` itself (the `NEXT_PUBLIC_*` one only while «Automatically
expose System Environment Variables» is on, §1.2); do not set them. `NEXT_PUBLIC_APP_VERSION` and
`NEXT_PUBLIC_SENTRY_ENVIRONMENT` are computed in next.config.ts; do not set them either.

### 2.1 Web (Vercel)

| Name | Scope | Production | Preview | Purpose | Required |
|---|---|---|---|---|---|
| `CMS_URL` | server | prod CMS `…/api` | staging CMS `…/api` | CMS base URL incl. `/api` (proxy, server components, auth routes). | yes |
| `NEXT_PUBLIC_CMS_URL` | browser, build | same as `CMS_URL` | same as `CMS_URL` | Direct public GETs from the browser (Cloudflare-cached). | yes |
| `NEXT_PUBLIC_SITE_URL` | browser, build | `https://<domain>` (canonical host) | the preview / staging host | Canonical URLs, sitemap, robots, Open Graph, share links, app-env detection. | yes |
| `REVALIDATE_SECRET` | server | random, ≥ 32 chars | a different value | Shared with the CMS (`WEB_REVALIDATE_SECRET`); authenticates `POST /api/revalidate`. | yes |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | browser, build | web OAuth client id | same | Google sign-in (same client as the CMS `GOOGLE_CLIENT_ID`). | yes |
| `GOOGLE_CLIENT_SECRET` | server | that client's secret | same | Google code exchange. | yes |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | browser, build | Meta app id | same | Facebook Login JS SDK. | yes |
| `NEXT_PUBLIC_APPLE_SERVICES_ID` | browser, build | the web Services ID | same | Sign in with Apple JS. | yes (once P3 is live) |
| `NEXT_PUBLIC_APPLE_REDIRECT_URI` | browser, build | `https://<domain>/…` as registered | preview URI if registered | Apple return URL; must equal the CMS `APPLE_WEB_REDIRECT_URI`. | yes (once P3 is live) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | browser, build | Firebase web app config | same | Chat (Firestore) client. | yes |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | browser, build | Firebase web app config | same | Chat. | yes |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | browser, build | Firebase web app config | same | Chat. | yes |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | browser, build | Firebase web app config | same | Chat. | yes |
| `NEXT_PUBLIC_FIREBASE_ENV` | browser, build | `production` | `staging` | Picks the chat database (`(default)` only in production). Anything else falls back to `local`. One Firebase project serves every environment, so a wrong value writes chat into another environment. | yes |
| `SITE_INDEXABLE` | server, build | `1` **only on the launch deployment** (§3.4) | never | Unset → `robots.txt` disallows all and every response carries `X-Robots-Tag: noindex, nofollow`. | launch only |
| `NEXT_PUBLIC_GA4_ID` | browser, build | measurement id (§1.3) | never | GA4. Unset → no gtag script, no cookie. | optional |
| `NEXT_PUBLIC_ANALYTICS_DEBUG` | browser, build | **never** | `1` only on a preview you want in DebugView | GA outside production, with `debug_mode`. | optional |
| `SENTRY_DSN` | server | project DSN | project DSN (optional) | Server / edge error reporting. Unset → Sentry never initialises. | optional |
| `NEXT_PUBLIC_SENTRY_DSN` | browser, build | project DSN | project DSN (optional) | Browser error reporting after consent. | optional |
| `SENTRY_ENVIRONMENT` | server, build | `production` (or unset → `VERCEL_ENV`) | `preview` / `staging` | Sentry environment; only `production`, `preview`, `staging` report. | optional |
| `SENTRY_ORG`, `SENTRY_PROJECT` | build | slugs | same | Source-map upload target. | optional |
| `SENTRY_AUTH_TOKEN` | build, **secret** | org token | same | Source-map upload. All three of org/project/token, or no upload. | optional |
| `ENABLE_LOCAL_AUTH` | server | **never** | **never** | QA-only local password sign-in. Must not exist on any Vercel environment. | never |
| `ENABLE_DEV_KIT` | server | **never** | `1` only for a one-off check (§4.8) | Serves `/dev/*` (kit, templates, Sentry crash page) in a production build. | never in prod |
| `PUBLIC_WATERS_DB` | server | unset | unset | Overrides the path of the bundled public-waters dataset (local tooling). | no |

Test-only variables (`CONTRACT_EMAIL`, `CONTRACT_PASSWORD`, `E2E_STRAPI_API_TOKEN`) live only in a
developer's `.env.local`. They are never set on Vercel.

### 2.2 CMS (DigitalOcean App Platform)

| Name | Production | Staging | Purpose |
|---|---|---|---|
| `WEB_REVALIDATE_URL` | `https://<domain>/api/revalidate` | `https://<staging web host>/api/revalidate` | Where the CMS forwards every cache-tag purge batch (CMS PR #108, see docs/domain/caching.md). Unset → no-op: web pages then refresh only when their cache entry expires. |
| `WEB_REVALIDATE_SECRET` | same value as the web's Production `REVALIDATE_SECRET` | same as Preview's | Sent as `x-revalidate-secret`. |
| `WEB_REVALIDATE_BYPASS` | **unset** (production is public) | the Vercel «Protection Bypass for Automation» secret of the web project (§1.2) | Sent as `x-vercel-protection-bypass` so a protected staging web still receives the purges. Missing on staging → every purge gets 401 from Vercel (the CMS logs a warning at most once a minute). |
| Facebook sign-in vars | per the private CMS patches note | same | Required by the Facebook sign-in change in that note; without them Facebook sign-in fails for the app and the web. |
| Apple web sign-in vars | per the private CMS patches note (P3) | same | Accept the web Services ID as an Apple audience. |

The CMS also needs the Strapi permission grants the web relies on, per role (roles do not inherit).
They are listed in **the private grants note**; apply them in the Strapi admin UI on staging, check,
then on production.

---

## 3. Deploy order

**CMS first, then web.** The web reads only existing CMS routes, so a new CMS never breaks the old
web; the reverse is not true.

### 3.1 CMS

1. Merge the CMS changes the web needs `staging` → `main` per the workspace CLAUDE.md release flow
   (`/release-audit` first):
   - **the Facebook sign-in change from the private CMS patches note is on production and its
     env vars (§2.2) are set first**, otherwise Facebook sign-in fails — in the app as well as on
     the web;
   - the web-revalidate forwarder and the Apple Services ID change (same note). Deploying these
     two is harmless while their env vars are unset.
2. Apply the grants from the private grants note on production (Strapi admin UI).
3. **Verify the CMS** before touching the web:
   - the app still works on a phone against production (sign-in **including Facebook**, a
     competition, a lake);
   - every `/feed/*` route the web reads answers anonymously where it should (the private grants
     note has the probe list) — a missing Public grant shows up as 403;
   - `curl -sI <prod CMS>/api/feed/competition-cards` (a cacheable route) carries `X-Cache-Tag: competitions-list`.

### 3.2 Web

1. Merge `v2` → `main` (or promote the checked preview). Vercel builds Production with the §2.1
   variables, **without** `SITE_INDEXABLE`.
2. Read the build log (§4.1). A failed or warning build is not promoted.
3. Attach the domain (§1.1) to the Production deployment and wait until `https://<domain>/` serves
   it (certificate «Valid»). Only then go on to §3.3.

### 3.3 Revalidation webhook

Needs §3.2 step 3: the CMS must post to a domain that already serves the Production deployment.

1. On DigitalOcean set `WEB_REVALIDATE_URL` + `WEB_REVALIDATE_SECRET` on the production CMS app
   (§2.2, no `WEB_REVALIDATE_BYPASS` there) and let it redeploy. If the process keeps old env,
   compare the running process environment with the app spec before assuming the value is live.
2. Check: `curl -s -X POST https://<domain>/api/revalidate -H 'content-type: application/json' -d
   '{"tags":["competitions-list"]}'` without the header → **401** (from the route, not a Vercel
   login page).
3. Edit something harmless in the CMS admin (e.g. re-save a news item), wait about 5 s, then reload
   its web page twice (stale-while-revalidate: the first visit after a purge can still serve the
   old copy). The CMS currently tells the web at the same time as, or before, it purges
   Cloudflare, and the web re-reads through the Cloudflare-cached CMS URL — so when the web
   regenerates first, it stores the stale edge copy again and the change can take one TTL. If the
   change is still missing after the second reload, do the manual §6.6 order once (Cloudflare tag
   first, then the web tag) and reload: if it appears then, the webhook works and only the timing
   race hit; if not, check the CMS logs for forwarder failures.

   **Staging variant** (to rehearse this on the staging CMS + staging web): the staging web host is
   a protected preview, so first check the staging CMS has `WEB_REVALIDATE_BYPASS` (§2.2). The 401
   probe is `curl -s -X POST https://<staging web host>/api/revalidate -H
   'x-vercel-protection-bypass: <bypass secret>' -H 'content-type: application/json' -d
   '{"tags":["competitions-list"]}'` → **401** from the route (JSON body); an HTML Vercel login page
   instead means the bypass secret is wrong. Then edit-and-reload on the staging web exactly as in
   step 3, logged in to Vercel in the browser.

### 3.4 Go indexable

1. Set `SITE_INDEXABLE=1` on **Production only** and redeploy (it is read at build time).
2. `curl -s https://<domain>/robots.txt` → `Allow: /`, `Disallow: /api/`, a `Sitemap:` line;
   `curl -sI https://<domain>/` has **no** `X-Robots-Tag`.
3. Search Console: add the domain property (DNS TXT verification), submit
   `https://<domain>/sitemap.xml`, check it is read without errors after a few hours.
4. Preview deployments must stay noindex: `curl -sI <a preview URL>` shows
   `X-Robots-Tag: noindex, nofollow`.
5. Now run the Open Graph check (§4.6) with the Facebook Sharing Debugger.

---

## 4. Pre-launch checks

Run against the Production deployment on the final domain, after §3.3 and before §3.4, unless
noted.

1. **Build clean.** In the Vercel build log: no errors, no `Unexpected cache miss after cache
   warming`, no prerender timeouts. Background in docs/reviews/M8-notes.md; locally,
   `NEXT_PRIVATE_DEBUG_CACHE=1 npx next build` and `grep -c 'omitting entry'` should be 0.
2. **Lighthouse budget** (mobile): LCP < 2.5 s, CLS < 0.05, TBT < 200 ms on `/`, a competition, a
   lake, `/concursuri`, `/balti` (`npm run test:lighthouse` locally on the prod build;
   PageSpeed Insights on the live URL).
3. **axe sweep**: the accessibility e2e over every route at 375 and 1280 is green on the release
   commit (zero violations).
4. **Legacy redirects** (the links the app has shared). Each answers with the status and
   `location` shown (full table: tests/e2e/legacy-redirects.cases.ts):

   | `curl -sI https://<domain>…` | status | `location` path |
   |---|---|---|
   | `/competitions/<id>` | 308 | `/concursuri/<id>` |
   | `/competitions/<id>?activeTabId=clasament` | 308 | `/concursuri/<id>/clasament` |
   | `/competitions/<id>/chat` | 308 | `/concursuri/<id>/chat` |
   | `/lakes/<id>` | 308 | `/balti/<id>` |
   | `/lakes/<id>/reviews` | 308 | `/balti/<id>/recenzii` |
   | `/news/<id>` | 308 | `/stiri/<id>` |
   | `/partide/comunitate/<id>` | 308 | `/partide/<id>` |
   | `/partide/join/<code>` | 307 | `/partide` |

   Use a real competition / lake id and follow the redirect once: the page renders (200).
5. **robots / sitemap**: before §3.4 robots disallows all; `/sitemap.xml` lists the sub-sitemaps
   and each opens with absolute `https://<domain>/…` URLs (never a preview host).
6. **Open Graph** — **run after §3.4** (or re-run there). Before §3.4 `robots.txt` disallows all
   and every response carries `X-Robots-Tag: noindex, nofollow`; Twitterbot and Meta's crawler can
   refuse the URL, so a «blocked by robots» answer or a missing card before §3.4 is expected and is
   **not** an OG bug. At this stage only a WhatsApp preview (it ignores robots) is a valid check.
   After §3.4: paste a competition, a lake and the home URL into the Facebook Sharing Debugger and
   a WhatsApp chat: title, description and the generated image appear; `og:url` is the canonical
   domain.
7. **Consent + GA4**: in a private window the banner appears; «Refuz toate» → no request to
   `googletagmanager.com`, no `_ga` cookie; «Accept toate» → GA4 Realtime shows the visit. If
   Realtime stays empty (and no `googletagmanager.com` request after accepting), check first that
   «Automatically expose System Environment Variables» is on (§1.2), then redeploy. For
   DebugView use a preview with `NEXT_PUBLIC_ANALYTICS_DEBUG=1` (the production stream filters
   developer traffic). `/cookie-uri` changes the choice; withdrawing removes `_ga*`.
8. **Sentry test event**: on a **preview** with `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`,
   `SENTRY_ENVIRONMENT=preview` and `ENABLE_DEV_KIT=1`, accept «Monitorizarea erorilor» and open
   `/dev/observability?crash=render`: an event arrives in the `preview` environment with a
   readable stack trace (source maps) and no cookie / token in it. Remove `ENABLE_DEV_KIT`
   afterwards. On production, confirm the project receives events from the first real error.
9. **Sign-in** on the production domain with Google, Facebook and Apple, then sign-out. Facebook
   sign-in must also be re-tested **in the app on a phone** against production: the Facebook
   sign-in change (§3.1 step 1) touches the CMS side for both.
10. **Signed-out gates**: `curl -sI https://<domain>/setari` → 307 to `/intra?next=%2Fsetari`.
11. `ENABLE_LOCAL_AUTH` and `ENABLE_DEV_KIT` absent on Production: `curl -s -o /dev/null -w '%{http_code}'
    https://<domain>/dev/kit` → 404.

---

## 5. Universal links cut-over

Option A (recommended, docs/reviews/M8-url-scheme.md §2). The app and its AASA / `assetlinks.json`
do not change; only the fallback for visitors without the app moves from the redirect-stores SPA to
the web.

1. **Before editing anything**, export the current rules: `aws amplify get-app --app-id <id>
   --query 'app.customRules'` (or a screenshot of «Rewrites and redirects»), and keep the copy —
   §6.4 restores exactly that list. The existing rules live only in the Amplify console, not in the
   repo (`amplify.yml` only sets headers). Among them: a rewrite that maps the extensionless
   `/.well-known/apple-app-site-association` to the repo file
   `public/.well-known/apple-app-site-association.json`, and the SPA catch-all (`/<*>` or a regex
   rule → `/index.html`, 200).

   Then, in the Amplify app serving `bluvi-app.wearetribus.com` → «Rewrites and redirects», set
   the rules **in this order** (first match wins):
   1. the existing `.well-known` rewrites, unchanged (above the 301, or every app link breaks);
   2. the paths the owner chose to keep on Amplify (decision 3: `/ios`, `/android`, `/assets/<*>`,
      `/` if the landing stays there, `/competitions/<*>` only if the SPA ranking stays);
   3. the new `/<*>` → `https://<domain>/<*>`, **301**;
   4. the existing SPA `index.html` rewrite, last — or removed if nothing kept in item 2 needs it.
      A 301 placed below it never fires.
2. Check from a terminal:
   - `curl -sI https://bluvi-app.wearetribus.com/.well-known/apple-app-site-association` → **200**,
     `content-type: application/json`, not a 301; and `curl -s` of the same URL returns the JSON
     body (starts with `{` and lists `applinks`), **not** the SPA `index.html`;
   - same for `/.well-known/assetlinks.json` → 200;
   - `curl -sI 'https://bluvi-app.wearetribus.com/competitions/<id>?activeTabId=clasament'` → 301 to
     the web with the query kept, then the web's 308 to `/concursuri/<id>/clasament`.
3. **iOS** (phone with the app installed): Apple serves AASA from its CDN; check
   `https://app-site-association.cdn-apple.com/a/v1/bluvi-app.wearetribus.com` still lists the
   paths. Paste a `https://bluvi-app.wearetribus.com/lakes/<id>` link in Notes and tap it → the app
   opens on the lake. Long-press → «Open in Safari» → the web lake page.
4. **Android** (phone with the app): `adb shell pm get-app-links <app package>` shows the host as
   `verified`; tapping the same link in a messaging app opens the app. In Chrome without the app →
   the web page.
5. **Without the app** (desktop, or a phone without it): the link lands on the web page, not on the
   store or the SPA.
6. **In-app browsers** (Instagram, Facebook): the link opens the web page (universal links never
   fire there) — expected.

If any `.well-known` check fails, remove the catch-all rule at once (§6.4); the app links depend on
those two files.

When the app later shares web links (decision 4), that is a new store build with the web domain in
`associatedDomains` and an AASA served by the web — a separate unit.

---

## 6. Rollback

Each layer rolls back on its own. Do the smallest one that fixes the problem.

1. **Web: Vercel instant rollback.** Project → Deployments → the previous good Production
   deployment → «Instant Rollback» (or promote it). Takes seconds; env vars are those that
   deployment was built with. Note that Vercel stops auto-promoting new `main` builds after an
   instant rollback until you promote one again.
2. **Stop indexing.** Remove `SITE_INDEXABLE` from Production and redeploy (or roll back to a
   deployment built without it). Search Console → Removals only if wrong pages were already
   indexed.
3. **DNS revert.** Point the domain records back to what they were (low TTL from §1.1 makes this
   minutes). Only for a launch that must be fully withdrawn.
4. **Universal links.** Restore the Amplify rules from the copy exported in §5 step 1 (at minimum,
   delete the new 301 catch-all, §5 step 1.3, and put the SPA `index.html` rewrite back last if it
   was removed); the SPA fallback is back at once. Re-run the `.well-known` checks of §5 step 2.
5. **CMS rollback is independent** (DigitalOcean: redeploy the previous deployment). The web keeps
   working on an older CMS **as long as that CMS still has every `/feed/*` route and grant the web
   reads**; rolling the CMS back past those routes breaks the matching web pages. Losing only the
   web-revalidate forwarder is harmless: pages then refresh when their cache entry expires. Unset
   `WEB_REVALIDATE_URL` on the CMS if the web is down, so purges stop calling it (they never block
   the CMS anyway).
6. **Stale or wrong data on pages:**
   - Cloudflare (CMS edge cache): purge by **Cache-Tag** in the Cloudflare dashboard (the tag the
     CMS response carries in `X-Cache-Tag`, e.g. `competition-<documentId>`), the same tags the CMS
     purges itself — never «Purge everything» unless the incident needs it;
   - Next (web pages): POST the same tags to `https://<domain>/api/revalidate` with the
     `x-revalidate-secret` header (body `{"tags":[…]}`, up to 100 tags). Purge Cloudflare first,
     wait until it has finished (a few seconds), then the web, or the web regenerates from the
     stale edge copy. The CMS's own forwarder does not keep this order yet (§3.3 step 3), so this
     manual order is also the fix when a page stays stale after a CMS edit;
   - last resort: redeploy the web; the build prerenders every page from the CMS again.

---

## 7. Monitoring after launch

First 48 hours: someone watches these at least twice a day.

- **Sentry** (web project): alert rules for «a new issue» and «more than N events in 1 hour»
  (start with 50) on `environment:production`, routed to the owner's email / Slack. Check the
  release tagged `app_version` matches the deployed `package.json` version. Watch for a spike of
  «Session rejected by the API» (mass sign-out: a CMS auth or grant problem).
- **GA4**: Realtime shows consenting visitors; page_view counts in the first days stay plausible
  (a doubling means enhanced measurement history events are on, §1.3 step 2).
- **Vercel**: Logs (filter on 5xx and on `/api/cms`, `/api/auth`, `/api/revalidate`), function
  duration and errors in Observability, usage against the Pro plan limits.
- **Search Console**: coverage and sitemap status after a few days; redirect and «Duplicate without
  canonical» warnings point to URL-scheme issues.
- **CMS**: application logs (BetterStack via the DigitalOcean log forwarding), 403 bursts (a missing
  grant) and failures of the web-revalidate forwarder (logged at most once a minute); Cloudflare
  analytics for the cache hit ratio on `/feed/*`.
- **App**: the app's own Sentry project and crash reports are unchanged by the web launch; a change
  there after §5 means the `.well-known` files broke.
