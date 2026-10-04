# bluvi-web: roadmap

Status: approved direction, 2026-10-04. This is the single source of truth for what the web must
contain, in what order, and how a screen counts as done. It is updated in the same commit as the
work it describes.

Related:
- Data layer spec: `docs/superpowers/specs/2026-09-27-web-v2-data-layer-design.md`
- Data layer conventions: `core/README.md`
- CMS patches: kept local-only (`docs/private/cms-patches/`, git-ignored); security items tracked in the private CMS repo
- Design reference: `design/` (Claude Design export)

## 1. Goal and rules

The web has **every feature of the mobile app (fish)**. It is mobile first, looks like the app on a
phone and is built for the desktop on a laptop, and it must look impeccable. The backend is the same
CMS, and the data layer (`core/`) is already ported from fish.

1. **Parity is verified, not intended.** Every fish screen and behaviour is listed in the parity
   inventory (§3). A web screen is done only when every acceptance criterion taken from its fish
   files passes.
2. **We propose, the owner approves.** Claude Design owns the design system (Fundații) and the
   anchor screens. Every other screen is composed from the system and the approved templates (§4),
   reviewed by agent panels (§6), and shown to the owner at milestone level.
3. **fish and the CMS stay the reference.** When web and fish disagree, fish wins unless the
   inventory documents a web-specific reason. When fish and the CMS disagree, flag it to the owner
   (workspace CLAUDE.md, domain sync rule).
4. **No raw visual values.** Colors, type, spacing, radii, shadows and motion come only from
   `app/globals.css` tokens and the kit components.

## 2. Owner checkpoints

The owner wants little reviewing, so the owner looks at the work only at these points:
- **M0:** approve the 6 page templates (§4), with variants where a choice is real.
- **End of each milestone:** skim a Vercel preview plus one review page. Comments there become
  fix tasks.

Everything else is gated by automation and agent panels (§5–§6).

## 3. Parity inventory

`docs/parity/inventory.yml` is built in M0. It has one entry per fish screen (110 under
`fish/app/`) and one per cross-cutting behaviour:
- deep links;
- notification → route mapping;
- role-dependent UI (organizer, operator, referee);
- signed-out gating;
- error and empty states;
- live refresh intervals.

Each entry records:
- the fish source files;
- the web route, template, `core/` modules and states (signed out, empty, loading, error, edge cases);
- the **acceptance criteria**, which are concrete, checkable statements extracted from the fish code
  (what is shown, under which conditions, what each action does, what is refetched);
- the status: `todo → proposed → passing → shipped`.

`/web-drift` (`.claude/skills/web-drift` in the workspace) is extended in M0 to read the inventory.
It reports missing screens, missing states and failing criteria per screen, and it runs at the end
of every milestone. A milestone closes only when it reports zero unexplained gaps.

**Mobile only, with the web replacement:**

| fish | Web |
|---|---|
| `timer/*`, rod alarms, `partide/rod-config` | Not on web: background alarms have no web equivalent. |
| `onboarding` | The signed-out home acts as the landing page. |
| `cmp-personalize` (GDPR SDK) | Cookie consent banner (M8). |
| Android widgets, push tokens, version check | Not on web. In-app notifications only; web push is a later option. |

## 4. Shell and templates

**Shell.** The menu is a top bar at every width:
- **Phone:** logo, search, notifications, avatar and ☰, which opens the menu as a panel.
- **Desktop:** logo, the main links (Acasă, Bălți, Competiții, Partide), ⌘K search, notifications,
  avatar, and an Administrare menu for organizers and operators.

The bottom tab bar, the rail and the side menu are retired.

**Templates.** Each one ships with all its states and is approved by the owner in M0:

| # | Template | Used by |
|---|---|---|
| T1 | List with filters | competitions, news, anglers, notifications, bookings, polls |
| T2 | List with map | lakes, public waters, community venues |
| T3 | Detail with tabs | competition, lake, angler profile, partidă, public water |
| T4 | Multi-step form | create competition, booking, registration, walk-in, review |
| T5 | Dashboard | home, organizer panel, lake panel |
| T6 | Single-task flow | scale, capture, raffle, penalties, join with code |

## 5. Automated gates

A screen reaches review only after it passes all of these:
- **Screenshots** at 375, 768, 1280 and 1440, for every state in its inventory entry.
- **Accessibility:** axe-core with zero violations, plus keyboard paths in the e2e test.
- **Performance** on public pages: a Lighthouse budget of LCP under 2.5s, CLS under 0.05 and
  TBT under 200ms on mobile.
- **Lint:** no raw colors, font sizes, spacing or z-index outside the tokens.
- **Parity:** the inventory criteria, checked by e2e tests against the local CMS. Every action is
  covered (register, follow, book, capture, weigh…).
- **Visual baselines:** once approved, the screenshots become Playwright `toHaveScreenshot`
  baselines, and an unapproved visual change fails CI.
- **Base checks:** `tsc`, eslint, unit tests, contract tests and `next build`.

## 6. How a batch is built (multi-agent)

Each milestone runs as batches of 3–6 screens through one workflow:

1. **Implement**: one agent per screen. Input: the inventory entry, the fish files, the template,
   and `core/`.
2. **Design critic panel**: 3 independent agents with different lenses. Each lists concrete
   problems from screenshots plus source.
   - fidelity to Fundații and the template;
   - visual polish (rhythm, alignment, hierarchy, density per breakpoint);
   - states and edge cases.
3. **Parity verifier**: an adversarial agent that tries to prove a criterion fails, citing fish
   file:line.
4. **Fix**, then repeat steps 2–3 **until two rounds in a row find nothing new**, with at most 4
   rounds; whatever is left is logged.
5. **Gate** (§5) and **commit** per screen.
6. **End of milestone:** `/web-drift`, the Vercel preview and the review page for the owner.

## 7. Milestones

Counts are fish screens (`fish/app/**`). Exact lists live in the inventory.

| | Scope | fish screens |
|---|---|---|
| **M0 Foundation** | Working sign-in (env, Google/Facebook/Apple consoles, local QA login); CMS P0 deployed (security), then P1 and P3; Vercel project with PR previews; new top-bar shell; T1–T6 approved; gates in CI; review page; parity inventory; `/web-drift` extended. Redo Acasă and Concurs on the new shell. | — |
| **M1 Public & SEO** | Competitions list (Descoperă / Viitoare / Live / Încheiate / per lake); competition page, all tabs (ranking, info, participants, extra scales, rules, statistics, ranking image); lakes list + map + filters; lake page and all subpages (catches, ranking, competitions, gallery, reviews, stands, statistics, partide, map); public waters + subpages; news; sponsors; sitemap, JSON-LD, OG images | ~45 |
| **M2 Account** | Sign-in, complete profile, own profile, angler profile, connections, suggested anglers, notifications, notification preferences and settings, settings, edit profile | ~11 |
| **M3 Booking** | Book a lake (3 steps), my bookings + detail, lake review | ~6 |
| **M4 Partide** | Partide list, live partidă (Firestore), start, capture + photo preview, history, statistics, anglers, ranking, community (venue, catches, gallery), join with code | ~15 |
| **M5 Competition participant** | Registration (teams, guests, disclaimer), competition chat + photo, polls (current, past), raffle (6 screens) | ~13 |
| **M6 Organizer** | Organizer panel, create-competition wizard (all steps, rich text editor, ranking explanation, stand allocation), sectors, participant allocation, scale (index, add, history, revisions), penalties (index, select stand, apply), stand timeline | ~20 |
| **M7 Lake operator** | Choose lake, lake panel, bookings grid, stand blocks, walk-in (3 steps), rate angler | ~8 |
| **M8 Launch** | Final domain and URL scheme (slug vs documentId) with redirects; universal links coordinated with the app (`bluvi-app.wearetribus.com` AASA) so one link opens the app on phones and the web elsewhere; GDPR cookie banner + GA4; Sentry; accessibility and performance audit; `/web-drift` zero gaps; runbook | — |

M1 comes first because it brings search traffic and builds on the public cache that already
exists. M2–M7 need sign-in, which M0 delivers. Organizer and operator come last because they are
the most complex and mostly used on a laptop.

## 8. Known gaps to close in M0

- **Sign-in:** `.env.local` still uses the old web's variable names. Rename them per `.env.example`,
  then register `localhost:3000` and the preview domains in the Google and Facebook consoles. Apple
  needs P3 deployed and a Services ID.
- **CMS P0**: a security fix tracked privately in tribustech/bluvi-strapi#104; independent of the web.
- **No design for the competitions list:** `Competitii.dc.html` (anchor 1/3) is not in the export.
  It will be composed from fish `(tabs)/competitions/index.tsx` + `pulse/*` on T1.
- **Production 404s:** an unknown competition id returns 200 with `noindex` (a Next 16 streaming
  constraint). Add an existence check in `proxy.ts` if real 404s are needed.
- **Local CMS grants** missing compared to staging: Public `polls/current`, lakes home/explore/bbox,
  `mineCount`, `suggested`, `timeline-snapshot`, map markers.
- **Kit gaps:**
  - a solid initials avatar tone;
  - a per-sector foreground token (sectors B, C and K are under AA);
  - a feeder ranking table;
  - a 22/800 desktop section title step, if Fundații confirms it.

## 9. Definition of done (per screen)

The inventory entry is `shipped` when:
1. every acceptance criterion passes in e2e;
2. every state renders at the 4 widths;
3. the critic panel and the parity verifier ran until dry;
4. the gates in §5 are green;
5. the visual baselines are committed.

The owner's milestone review can reopen any screen.
