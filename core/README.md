# core/ — the Bluvi data layer

Platform-agnostic port of the fish (mobile) data layer. Spec:
`docs/superpowers/specs/2026-09-27-web-v2-data-layer-design.md`. Template to copy: `core/news/`.

## Hard rules

1. **No runtime imports** of `react`, `react-dom`, `react-native`, `next/*`, `expo-*`,
   `@react-native-firebase/*`, `@/lib/*`, `@/app/*`, and no `window`/`document`/`localStorage`/
   `navigator`. Type-only imports from `@tanstack/react-query` are fine (`import type { QueryClient }`).
   Enforced by ESLint and `tests/unit/core-boundary.test.ts`.
2. **fish is the source of truth and is read-only.** Port behaviour, don't redesign it: same
   endpoints, same query params, same query-key shapes, same invalidations/optimistic updates,
   same pure helpers. Keep fish's explanatory comments when they explain a *why*.
3. Every API function **validates** its response with a zod schema (`call(t, req, schema)`).
4. API functions take `t: Transport` first and never read tokens, env or globals.

## Per domain folder `core/<domain>/`

| File | Content |
|---|---|
| `schemas.ts` | zod schemas = the models from `fish/models/*.type.ts` (+ inline types in `fish/services/api/*.ts`). Export `xSchema` and `type X = z.infer<typeof xSchema>`. |
| `api.ts` | One function per fish API function. Name kept from fish (default exports get a name). JSDoc `/** fish services/api/<file>.ts#<fn> */`. |
| `queries.ts` | `<domain>Keys` (exact fish `queryKeys.*` shapes) + one `xQuery(t, ...)` / `xInfiniteQuery(t, ...)` per fish query hook, using `queryOptions` / `infiniteQueryOptions` from `core/shared`. Carry over `staleTime`, `gcTime`, `enabled`, `select`, `placeholderData`, `refetchInterval` etc. |
| `mutations.ts` | One `xMutation(t, qc)` per fish mutation hook using `mutationOptions` from `core/shared`. `qc: QueryClient` (type-only import) — port `onMutate`/`onError`/`onSuccess`/`onSettled` cache logic 1:1. Pure cache helpers (e.g. `applyFollowToProfile`) are exported and unit-tested. Toasts, navigation, analytics, haptics are UI concerns: drop them, leave a one-line comment naming what fish did there. |
| `domain/*.ts` | Pure logic from fish `helpers/` and `features/<area>/domain|helpers` that the data needs (mappers, derivations, grids). Only pure functions — no hooks, no RN. |
| `index.ts` | Re-exports. |
| `*.test.ts` | Colocated unit tests (Vitest). |

Hooks that only wrap `useQuery` become query factories. Hooks with real logic on top (merging two
queries, derived state) become a query factory **plus** a pure function the UI calls with the data.

## Schemas — how strict

- Match the DTO the CMS actually returns. `/feed/*` DTOs are defined in
  `fir-intins-cms/src/api/*/services/dto/` (`toXDTO`) — read them; legacy `/api/*` responses are raw
  Strapi documents with whatever `populate` fish asks for.
- Use `.nullable()` where the DTO can be null, `.optional()` where the key can be absent,
  `.nullish()` only when both really happen. Unknown keys are stripped (default `z.object`).
- Enums the CMS may extend (categories, statuses shown as text) → `z.union([z.enum([...]), z.string()])`
  so a new value does not break a whole list. Enums that drive logic (competition status) stay strict.
- Reuse `core/shared` (`paginatedSchema`, `dataSchema`, `strapiImageSchema`, `feedImageSchema`,
  `richTextSchema`, `nextPageParam`). If another domain owns a type you need, define the minimal
  shape you need locally — duplicates are reconciled after all domains land.
- The contract test is the judge: a schema is right when it parses the real CMS response.

## Transport requests

```ts
call(t, { method: 'GET', path: '/feed/lakes/abc', query: { page }, auth: 'none' }, schema)
```

- `path` has **no** `/api` prefix (the transport adds the base URL, which ends in `/api`).
- Legacy qs queries: pass the object in `query` (serialized with `qs`, brackets, `encodeValuesOnly`),
  or keep fish's hand-built query string in `path` when it is not produced by qs.
- `auth`: `'none'` = public/shared data (server may cache it by the CMS's cache headers);
  `'optional'` = public but personalised when signed in; `'required'` = per-user route.
  When in doubt check `BYPASS` in `fir-intins-cms/src/middlewares/cache-control.ts` and the route's
  `config.auth`. A route that is per-user must never be `'none'`.
- Uploads: body is a `FormData`; the transport leaves it alone.

## Tests

- **Unit** (`npm test`): each api function called once with a fake transport
  (`createFakeTransport` from `@/tests/transport`) asserting method/path/query/body/auth and that a
  realistic fixture parses; query keys equal fish's; pure helpers; mutation cache logic with a real
  `QueryClient` from `@tanstack/react-query` (allowed in tests).
- **Contract** (`npm run test:contract`, local CMS on :1337 must be running): one file per domain
  `tests/contract/<domain>.contract.test.ts`. Use `contractContext()` for `guest`/`user` transports
  (user = QA account `sim-qa@bluvi.test`, owner of local Chita Lake `s84u55lo4n9z0emngozttt6e`).
  Call **every GET** function: public ones as guest and user; per-user ones as user, and assert
  `expectDenied` as guest. Discover ids from list responses; skip with `it.skip` + reason only when the
  local DB has no data for it. **No writes** except explicitly idempotent round-trips
  (follow→unfollow, mark read). Never write to Firestore.
