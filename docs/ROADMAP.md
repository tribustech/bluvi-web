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

Revised 2026-10-06. Reviewing only at milestone end let our interpretations pile up unchecked for
days, so the owner now gives **short, early feedback**:
- **After every batch** (3–6 screens), we publish a review page with phone and desktop screenshots of
  each screen and its key states, and comments on each screen. It takes about 2 minutes to read.
  Building on top of a batch waits for its comments or an OK.
- Every comment is fixed. When a comment states a general rule, it is added to §4b in the same commit.
- **End of each milestone:** skim the Vercel preview.

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

**Width (owner decision 2026-10-04, overrides Fundații's "content max 1120px"):** use the screen like
Facebook does:
- The top bar is full width.
- Pages are full width with 24–32px gutters, up to ~1680px, and centred beyond that.
- Only long reading text (articles, rules, descriptions) is capped at ~720px.
- Card grids auto-fill: more columns as the screen grows, never wider cards.
- From 1280px, dashboards and detail pages use a three-column layout:
  - left: context and filters;
  - centre: content;
  - right: "ce mă așteaptă" or details.
- Maps and tables (ranking, bookings) take all the available width.

**Templates.** Each one ships with all its states and is approved by the owner in M0:

| # | Template | Used by |
|---|---|---|
| T1 | List with filters | competitions, news, anglers, notifications, bookings, polls |
| T2 | List with map | lakes, public waters, community venues |
| T3 | Detail with tabs | competition, lake, angler profile, partidă, public water |
| T4 | Multi-step form | create competition, booking, registration, walk-in, review |
| T5 | Dashboard | home, organizer panel, lake panel |
| T6 | Single-task flow | scale, capture, raffle, penalties, join with code |

## 4b. Owner design rules (feedback log)

These are the owner's own corrections. They override templates and Fundații where they conflict.
Add each new piece of feedback here, dated.

**2026-10-06**
1. **Detail pages are Airbnb-like on desktop, not a full-width photo hero.** Order: title row (name,
   rating, location, actions), then a photo grid (one large plus four small, "Vezi toate fotografiile"),
   then two columns: content on the left, a sticky summary/action card on the right (price, book,
   contact, key facts). A full-bleed hero photo is only acceptable on phone.
2. **Filters are horizontal.** List pages use a filter bar (chips and pills, plus "Filtre" opening a
   dialog for the rest) above the results, never a vertical filter sidebar that takes a column.
3. **Sticky and animated headers must never float.** A header that collapses or animates on scroll
   must stay attached to the top edge at every scroll position, on phone and desktop. No gap, no bar
   left "in the air".
4. **When we don't know, we don't show.** A block whose state is unknown (still loading, failed,
   signed out, no data) is hidden or shows a neutral skeleton. It never shows copy like "nu știm dacă
   ești într-un concurs live".
5. **List screens on desktop are dense and categorised, not sparse carousels** (lakes main screen).
   - No near-empty horizontal rails: a section with fewer items than one row fills is shown compactly
     (smaller cards or a chip row) or merged into another section.
   - Categories are a row of icon chips at the top, Airbnb style (e.g. Aproape de tine, Rezervare
     online, Crap, Somn, Pe timp de noapte, Cu cazare, Top rating). Each category filters the grid
     below.
   - Results are a dense responsive grid of listing cards (photo 4:3 rounded 12–16, text under it,
     no empty footer space), not one carousel per section. Rails stay only where the set is curated
     and short, at most two per page.
6. **The search header of a list is one designed unit.**
   - A prominent search pill (where / what, then filters) with the Bălți / Ape publice switch
     integrated, e.g. a segmented control next to or above the pill.
   - Filters sit as chips under it.
   - The map is a prominent call to action, because looking at the map matters: a large, high-contrast
     "Arată harta" button (filled accent, icon and label, floating, bottom centre on phone), and on
     desktop a clear map entry point in the header next to the search (e.g. a map preview or a primary
     button). Never a small button lost in a row.
7. **Map view is a split view, with horizontal list cards like imobiliare.ro.** List on the left, sticky
   map on the right.
   - In map view the list shows **one card per row in a horizontal layout**: photo on the left (about
     4:3, rounded), and on the right the name, rating, location and distance, key details as compact
     rows or chips (species, regime, facilities, stands), price from-to and the main action.
   - Hovering a card highlights its marker and the reverse.
   - On phone: the map, with a draggable bottom sheet of the same horizontal cards.
   - Owner reference: imobiliare.ro map view (2026-10-06).
     - **Map on the left, about half the width**, with clusters showing counts, pins showing the price
       or rating pill, zoom/recenter controls and "Caută în zona hărții".
     - **List on the right, one card per row.** Each card has:
       - a title row;
       - the photo on the left with gallery arrows and a "1 / N" counter;
       - on the right, the big signature number ("de la 120 RON / tură"), location and distance, an
         icon row of key facts (suprafață, standuri, adâncime, specii) and tags (Rezervare online,
         Pescuit noaptea, Cazare, C&R);
       - an actions row (Sună, WhatsApp/Mesaj where fish has the contact, primary "Rezervă" when
         booking is on).
     - **The search header mirrors theirs:** a segmented Bălți / Ape publice control, then location,
       species and price selects, then "Filtre".
   (Owner refinement 2026-10-06, replaces the earlier "same card as the grid".)
8. **No visible focus ring on non-interactive elements.** Headings focused programmatically after
   navigation (tabIndex -1) get no outline. Rings are only for keyboard focus on controls
   (`:focus-visible`).

**2026-10-06, competition page**
9. **Statistics are bento.** The Statistici view is a bento grid of tiles of different sizes, not a
   list of identical cards. Small facts like "Capturi" get small, pretty tiles; the headline numbers
   get big tiles with the signature number.
10. **Units never run into the text.** In stat tiles the unit (kg, RON, %) is a separate, smaller,
    muted element beside the number, with space between them (SignatureNumber pattern), never glued
    into a sentence.
11. **Never say "capot".** Nobody uses the term and fish never shows it. A no-catch row shows "–" in
    the weight cell (like fish) and "Fără capturi" where a word is needed. The domain docs may keep
    "capot" internally; the UI does not.
12. **Every ranking table looks like a table, every ranking type included (feeder too).** It has a
    coloured header row (column labels like Loc, Echipă, Cantitate on a distinct header background, not
    the page colour), visible row separators and the sector stripe.
13. **Desktop rankings show avatars.** Every person or team row shows the avatar (photo, or initials on
    the solid tone) next to the name when there is room (≥768).
14. **Wide screens get their own layout for lists of people and weighings.** Cântare and Participanți
    must not be the phone list stretched. On desktop:
    - weighings are a table or timeline with every column visible (stand, angler, time, catches, kg,
      status) plus a detail side panel;
    - participants are cards or rows with avatar and their stats shown inline (no separate expand).

**2026-10-06, competition page (2)**
15. **Ranking tables keep fish's colour language per ranking type.** Rule 12's "coloured header" means
    fish's colours, not one generic tint.
    - Feeder: the Total group header is in fish's TOTAL_COLOR, each leg has its own colour with white
      text and a tinted sub-header, and leg tabs show the sector bands. Source:
      `fish/features/competitions/feeder-rounds/FeederRankingTable.tsx`.
    - NC and FIPSed: as `fish/components/ranking-table/NationalChampionshipTable.tsx`.
    - Others: as `fish/components/ranking-table/RankingTable.tsx`.
16. **Tables are compact, never stretched.**
    - Columns are sized to their content (fish's widths as the baseline) and the table is only as wide
      as its content. Numbers never float across a 1440+ screen.
    - Leftover width goes to a side column (live stats, weighing, the selected participant) or stays
      as margin.
17. **People open in an inline popover on desktop, with a link to their profile.**
    - On ≥1024, clicking a participant, a ranking row or a weighing's angler opens a popover anchored
      to that row: avatar, name(s), club, sector and stand, key stats, and "Vezi profilul", which goes
      to the angler profile `/pescari/[id]`.
    - Teams list each member with their own avatar and profile link.
    - Phone keeps fish's sheet.
18. **Participants on desktop are a designed roster, not a grid of numbered boxes.**
    - Group by sector (sector colour as the accent).
    - Each entry shows the avatar (a pair of faces for teams), the name(s), club, stand label and the
      angler's headline stats inline.
    - Signed out: same layout without the stats, plus one quiet sign-in hint.



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
