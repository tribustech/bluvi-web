# bluvi-web v2: UI build workflow

Date: 2026-10-03. Branch `v2`. It builds on the data layer
(`docs/superpowers/specs/2026-09-27-web-v2-data-layer-design.md`). The design comes from Claude
Design and is copied verbatim into `design/` (source: `~/Downloads/Bluvi Web Design /`).

## Inputs

| Design file | What it decides |
|---|---|
| `design/Fundatii.dc.html` | Tokens (light + proposed dark), type scale mobile/desktop, spacing, radii, elevation, breakpoints, motion, iconography, components (§07) |
| `design/Harta ecranelor.dc.html` | Every route, grouped, with its design status (ready / next / planned / mobile-only) |
| `design/Acasa.dc.html` | Home: mobile signed in (organizer + operator + active partidă) and signed out, desktop with a "ce mă așteaptă" right column |
| `design/Concurs.dc.html` | Competition page, Ranking: mobile 1:1, desktop full table + sector filter + docked chat + live weighing tile, edge-case states |
| `design/github.md` | Which fish files each design screen mirrors |

The competition list is not a separate screen; the competition page covers it (user, 2026-10-03).

## Decisions

- **Dark theme:** tokens only. The dark palette from Fundații is defined under
  `[data-theme="dark"]`, and no switch or `prefers-color-scheme` hook is wired yet.
- **Breakpoints:** <768 tab bar, sheets, padding 20 · 768–1279 rail 72px, 2 columns, sheets become
  dialogs · ≥1280 side menu 248px, content + 380–420px panel · ≥1440 content max 1120px centered.
- **Icons:** Heroicons 2 outline 24px (1.5 stroke), solid 20px only for presence (star, pin,
  check). The Bluvi brand SVGs from `design/assets/icons`. No emoji.
- **Data:** every screen reads through `core/` factories. Public pages are server-rendered from the
  cached public reads (static + tag revalidation), and the browser takes over with the same query
  keys (hydration). Nothing hard-coded except the design's own copy.
- **Verification:** headless Playwright (a separate Chromium, never the user's browser) takes
  screenshots of the design frames and of our pages at 375 / 768 / 1280 / 1440, side by side
  (`npm run shots`).

## Phases

### 0. Preparation (serial, main session)
1. Copy the design into `design/` and serve it locally (`npm run design`).
2. Tokens into `app/globals.css`: Tailwind 4 `@theme` from Fundații (colors, sectors A–X, type
   steps with mobile/desktop sizes, spacing, radii, elevation, breakpoints, motion springs).
   Dark tokens prepared under `[data-theme="dark"]`.
3. Nunito via `next/font/local` from the design-system font files. `@heroicons/react`. Brand SVGs
   as React components.
4. Screenshot harness `scripts/shots.ts` + `npm run shots -- <target>`.

### 1. Components (3 parallel agents, from Fundații §07)
- **A.** Buttons, status pills vs attribute badges, bento tiles (CountTile navy + StatTile), avatar +
  FaceStack (initials), the signature number.
- **B.** Cards (competition, lake, angler, partidă, catch), ranking row (mobile), ranking table
  (desktop: sticky header, tabular numbers, sortable, sector stripe).
- **C.** Navigation (tab bar, rail, side menu, desktop header with breadcrumb, ⌘K search,
  notifications, avatar), temporary surfaces (sheet / dialog / side panel per the Fundații rule),
  form fields.

Each component lives in `components/ui` or `components/<area>` and is shown on `/dev/kit` with the
design's sample data. Each agent screenshots its components against the matching Fundații frame.

### 2. App shell (serial)
Responsive layout with the navigation from 1C, signed-in/out header, sign-in page, loading/error
boundaries, server prefetch + `HydrationBoundary` helper, page metadata helpers + JSON-LD.

### 3. Screens with design (a pipeline per screen)
Screens: **Acasă** (signed in / signed out, mobile + desktop), **Concurs · Clasament** (mobile +
desktop + states). Steps per screen:
1. **Implement** on top of `core/` with real local-CMS data. Every state in the design (signed out,
   empty, loading, error, capot, tie, 24 sectors) is reachable.
2. **Visual check** against the design frames at both widths. The checker lists every difference
   with a screenshot pair. The implementer fixes them, at most 2 rounds.
3. **Adversarial review**: data fidelity vs fish (same fields, same derivations), SEO for public
   pages (metadata, JSON-LD, static/revalidate), accessibility (focus, contrast, landmarks), no
   per-user data in cached responses.
4. **Gate**: `npm run typecheck && npm run lint && npm test`, and a Playwright smoke test of the
   route against the local CMS.

### 4+. Next batches
Rerun the phase-3 pipeline per batch as the screen map flips screens to "Gata pentru feedback":
the rest of the competition tabs, lakes list + map, lake page, then the remaining zones.

## Scale and ownership
- Phase 1: 3 agents. Phase 3: about 3 agents per screen, 2 screens in parallel. At most 8 at once.
- Agents never commit. The main session commits per component group and per screen, by pathspec.
- fish and the CMS stay read-only.
