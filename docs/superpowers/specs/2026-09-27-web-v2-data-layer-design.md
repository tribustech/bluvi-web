# bluvi-web v2 — data layer

Date: 2026-09-27. Branch: `v2` (bluvi-web). Status: approved in conversation, section by section; the
user then asked for the whole thing to be built unattended ("fă-le pe toate… inclusiv teste").

## Goal

Rebuild bluvi-web from zero with **every feature the mobile app (`fish/`) has**. This spec covers only
the **headless data layer**: API clients, models, cache keys, query/mutation definitions, auth, the
CMS proxy, cache revalidation, realtime (Firestore) and the tests that prove it all matches the CMS.
Visual design is a separate track run by the user (Claude Design); no product UI ships from this spec.

Audience of the eventual product (all equally important): anglers arriving from Google (SEO public
pages), anglers using the web as a full app, organizers/operators working on a laptop.

## Decisions (with the reason)

| # | Decision | Why |
|---|---|---|
| D1 | Start from zero on branch `v2`; old code not carried over. | Old web was 8k lines on legacy `/api/*`, ~5% of mobile. Nothing deployed. |
| D2 | Platform-agnostic `core/` inside bluvi-web, ported from fish. **fish is not touched.** | Later `core/` can become a shared package that fish adopts module by module. |
| D3 | Verification = unit tests + **contract tests** against the local CMS (guest + logged-in), responses validated by the zod schemas in `core/`. | Only real check without a UI; zod schemas double as runtime validation and types. |
| D4 | Hybrid transport: JWT in an httpOnly cookie; public reads straight from the server (cacheable, SEO); per-user calls through a thin proxy `/api/cms/[...path]` that attaches the bearer. | Token never readable by JS; public pages keep Cloudflare + Next caching; `core/` stays identical in shape to fish. |
| D5 | Hosting: Vercel. Uploads are compressed in the browser (≤ 2048 px, JPEG) and go through the proxy like any call. | Vercel's 4.5 MB request limit; compressed photos stay far below it, so no upload-token endpoint is needed (revised 2026-09-27, was a CMS upload token). |
| D6 | Public pages static/ISR with **tag revalidation driven by the CMS**: the same tags the CMS already purges on Cloudflare (`entityTags`) are POSTed to `/api/revalidate`. Time-based revalidation stays as a safety net. | Seconds-fresh static pages; one hook point in the CMS (`cache-purge-queue` flush). |
| D7 | CMS changes are allowed (revalidate webhook, Apple on web) but are **delivered as patches + instructions**, not committed into the user's CMS checkout. | Never switch/commit the user's checkout while they are away. |

## Stack

Next 16.3 (App Router), React 19.2, TypeScript strict, TanStack Query 5, zod 4, Firebase JS SDK 12,
Vitest 3. Tailwind 4 is installed for the future UI; unused here.

## Layout

```
core/                        platform-agnostic; imports only zod, qs, @tanstack/query-core, firebase/*
  transport/                 Transport interface, ApiError, request helpers, headers
  cache/                     parsers for the CMS cache headers (CDN-Cache-Control, X-Cache-Tag)
  shared/                    pagination, media/image, blocks, common enums
  <domain>/                  one folder per domain:
    schemas.ts               zod schemas = the models; types are z.infer
    api.ts                   pure functions (t: Transport, ...args) => Promise<T>
    queries.ts               query keys + queryOptions factories
    mutations.ts             mutationOptions factories + invalidation lists
    domain/*.ts              pure logic ported from fish (optional)
    *.test.ts                colocated unit tests
  realtime/                  Firestore (chat, partide read models) on firebase/firestore
lib/server/                  server transport (cookie → bearer, next fetch tags/revalidate)
lib/client/                  browser transport (via proxy), QueryClient factory, upload helper
lib/auth/                    session cookie helpers, provider verification glue
app/api/cms/[...path]/       per-user proxy (also carries uploads)
app/api/auth/[provider]/     social sign-in → cookie; /api/auth/logout, /api/auth/session
app/api/revalidate/          CMS webhook → revalidateTag
app/api/firebase-token/      mints Firestore custom token for the signed-in user (via CMS)
app/sitemap.ts, robots.ts    SEO plumbing from /feed/lakes/index + competitions
tests/contract/              contract suite (vitest project "contract")
docs/cms-patches/            CMS changes as patch files + apply instructions
```

Domains (mirroring fish `services/api/*`, `models/*`, `services/queries/*`, `services/mutations/*`):
`competitions` (cards, pulse, featured, rankings, registrations, stands, polls, sponsors,
notification preferences), `organizer` (drafts, wizard, sectors/stands allocation, weighing/cântar,
raffle, penalties, referees, extra scales), `lakes` (lakes, explore/home/index, facilities, fishes,
public waters, claims, requests, booking interest, reviews, operator stats), `booking` (quote,
bookings, reservations, blocks, walk-in, availability), `partide` (sessions, community, catches,
session follows), `social` (anglers, followers, profile, users, reputation, angler reviews,
notifications, news, feedback, media upload, firebase token), `realtime/chat`, `realtime/partide`.

Mobile-only, not ported (per `docs/drift/classification.yml`): push-tokens, version check, timer,
widget notifications, onboarding, map viewport queries (`in-bbox`, `map-clusters`, `focus-bbox`) —
the latter are ported as plain API functions anyway because a web map will need them; only the
mobile-only hooks are dropped.

### Rules for `core/`

- No imports from `next`, `react`, `react-dom`, `react-native`, `expo-*`, and no `window`/`document`.
  Enforced by ESLint `no-restricted-imports`/`no-restricted-globals` on `core/**` and a unit test
  that scans the folder.
- API functions take the `Transport` as first argument; they never read tokens or env.
- Every API function validates its response with its zod schema (`schema.parse`). Schemas are
  **lenient where the CMS is**: unknown keys pass (`z.looseObject` / default strip), nullable where
  the DTO is nullable. A schema is correct when it passes the contract test against the real CMS.
- queryOptions factories take `(t: Transport, ...args)` and return `queryOptions({...})` from
  `@tanstack/query-core`, so the same object works for server prefetch and client `useQuery`.
- Query keys keep fish's shapes (`services/queries/queryKeys.ts`) so invalidation logic ports 1:1.
- mutationOptions factories return `{ mutationFn, invalidates }`; `invalidates` lists the query-key
  prefixes the fish mutation invalidates (ported from each `use*.ts` mutation hook).

## Transport

```ts
interface Transport {
  request<T = unknown>(req: {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;                 // CMS path WITHOUT the /api prefix, e.g. /feed/lakes/abc
    query?: Record<string, QueryValue>;
    body?: unknown;               // JSON; FormData passes through untouched
    auth?: 'required' | 'optional' | 'none';  // default 'optional'
    signal?: AbortSignal;
  }): Promise<{ data: T; status: number; headers: Headers }>;
}
```

- Every request sends `x-app-platform: web` and `x-app-version: <package.json version>`.
- Errors normalise to `ApiError { status, message, code?, bluCode?, details? }` with the same rules as
  fish `services/api/api.ts` (Strapi `error.details.bluCode` → `bluCode`; 401 "Missing or invalid
  credentials" → `code: 'SESSION_DEAD'`).
- Query strings: `qs` (same library and version line fish uses), so legacy `/api/*` bracket queries
  (`populate[...]`, `filters[...]`) serialize byte-identically.

Implementations:
- **Server** (`lib/server/transport.ts`): base `CMS_URL` (e.g. `https://api.bluvi.ro/api`). For
  `auth: 'none'` GETs it goes through a `'use cache'` function that fetches, then reads the CMS's own
  cache headers from the response: `CDN-Cache-Control: public, max-age=N` → `cacheLife({ revalidate:
  N })`, `X-Cache-Tag: a,b` → `cacheTag('a','b')`; a private/no-store answer → short-lived
  (`revalidate: 0`) so it never gets cached. The web therefore caches exactly what Cloudflare caches,
  under the same tags, with zero ported rules to drift (verified 2026-09-27: both headers reach the
  client on prod and on local). Otherwise it reads the session cookie and sends the bearer,
  `cache: 'no-store'`. Requires `cacheComponents: true`.
- **Browser** (`lib/client/transport.ts`): base `/api/cms`; cookie travels automatically.
  `auth: 'none'` GETs may go straight to the CMS (`NEXT_PUBLIC_CMS_URL`) to hit Cloudflare.
- **Test** (`tests/transport.ts`): Node fetch against `CMS_URL`, bearer from a JWT passed in.

## Auth

- Sign-in: `POST /api/auth/{google|facebook|apple}` with the provider credential the browser got
  (Google Identity Services ID token / Facebook access token / Apple JS identity token). The route
  forwards to CMS `POST /auth/{provider}` (same bodies fish sends), gets `{ jwt, user }`, sets cookie
  `bluvi_session` (httpOnly, Secure, SameSite=Lax, Path=/, Max-Age 1y — CMS `jwt.expiresIn: '1y'`),
  and returns the user DTO. Local provider (`/auth/local`) is wired only when
  `ENABLE_LOCAL_AUTH=1` (QA/test).
- `POST /api/auth/logout` clears the cookie. `GET /api/auth/session` returns the profile or 401.
- Dead session: proxy sees 401 "Missing or invalid credentials" → clears cookie, returns 401 with
  `code: SESSION_DEAD`; the client QueryClient clears user-scoped queries on that code.
- Apple on web needs a Services ID; CMS currently verifies the app's audience → CMS patch P3.
- The CMS social routes `JSON.parse(ctx.request.body)`: the web forwards the body as `text/plain`
  (with `application/json` Koa pre-parses it and the CMS answers 400). Facebook on the web reads the
  profile from the Graph API server-side, never from the browser.

## Proxy `/api/cms/[...path]`

GET/POST/PUT/PATCH/DELETE. Allow-list of path prefixes (`/feed/`, and the legacy prefixes fish still
calls: `/competitions`, `/registrations`, `/user`, `/users`, `/lakes`, `/weighings`, `/raffle-sessions`,
`/notification-users`, `/upload`, …) — the full list is generated from the ported API modules and
asserted by a unit test so a new module cannot silently 404. Forwards body, query, `content-type`,
adds bearer + app headers, strips `set-cookie`, passes status and JSON through. No caching.

## Caching and SEO plumbing

- Tags and TTLs come from the CMS response headers (see Transport → Server); `core/cache/` holds the
  pure header parsers, unit-tested against the header values the CMS emits.
- `/api/revalidate` accepts `POST { tags: string[] }` with header `x-revalidate-secret`
  (`REVALIDATE_SECRET`), calls `revalidateTag(tag, 'max')` for each (max 256 chars, max 100 tags).
- CMS patch P1 hooks the purge-queue flush so every Cloudflare purge batch is also POSTed there.
- `app/sitemap.ts`: lakes from `/feed/lakes/index`, competitions from `/feed/competitions`, news from
  `/feed/announcements`; `robots.ts` points at it. Slug/URL scheme is a UI decision — sitemap uses
  `/{balti|concursuri|stiri}/{documentId}` placeholders centralised in `lib/routes.ts`.

## Realtime (Firestore)

- Firebase JS SDK, same Firebase project as mobile; the collection-prefix-per-environment rule from
  fish (`features/chat/domain/chatPaths.ts`) is ported verbatim.
- Auth: `/api/firebase-token` → CMS `/feed/firebase-token` → `signInWithCustomToken`; re-mint +
  retry once on permission-denied (fish `useChatAuth`).
- Chat: room/message/receipt/reaction/typing reads and sends ported from `features/chat/*`
  (transforms, paths, outbox semantics minus the RN-specific persistence).
- Partide: read models (session repo, mappers, active-session pointer) ported from
  `features/partide/domain/firestore/*`. **Firestore rules and data are off-limits**: tests use
  mocks/fixtures only, never write to the shared Firebase project.

## CMS patches (delivered, not applied)

See `docs/cms-patches/README.md` for the diffs and apply notes: **P0** CMS security fix (tracked privately), **P1** revalidate webhook
from the purge queue, **P3** Apple Services ID for web. The upload token and CORS patches were dropped
(not needed, see D5 and the README).

## Testing

- **Unit (Vitest project `unit`)**: schemas parse recorded fixtures; api functions call the transport
  with the expected method/path/query/body (fake transport); queryOptions keys match fish's key
  shapes; mutation invalidation lists; cache-header parsers; qs encoder vs
  fixtures; proxy allow-list; revalidate route; auth cookie handling; core import-boundary test.
- **Contract (Vitest project `contract`)**, against `CMS_URL` (default `http://localhost:1337/api`):
  signs in the QA user via `/auth/local` (`CONTRACT_EMAIL`/`CONTRACT_PASSWORD`), then for every GET
  API function calls it as guest and as user through the real transport and lets the zod schema
  validate the response. Expected-403/401 cases are asserted explicitly (a guest calling a per-user
  route). Ids for detail routes are discovered from list responses. Mutations are covered by unit
  tests only, except idempotent round-trips (follow/unfollow, mark notification read) — no writes to
  competitions, bookings or Firestore.
- Gate: `npm run typecheck && npm run lint && npm test` green; `npm run test:contract` green against
  local CMS, with any skipped endpoint listed and justified in the final report.

## Out of scope

Any product UI and styling; fish changes; applying CMS patches or grants; deploying to Vercel;
web push notifications.
