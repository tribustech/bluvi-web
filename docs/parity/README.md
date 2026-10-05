# Parity inventory

The inventory lists everything the web app must do to match the mobile app (fish). It is the
`docs/parity/inventory.yml` that ROADMAP §3 describes, split into one file per area under
[`areas/`](areas/) so that several people can edit it at once.

The inventory has two kinds of entry:
- one **screen** entry for each fish screen, or for one part of a screen;
- one **behaviour** entry for each thing that spans screens, such as deep links, notification
  routes, role gating, sign-in redirects, refetch intervals and cache rules.

Each entry carries **acceptance criteria**. A criterion is one concrete statement taken from the
fish code, cited by `file:line`, that can be checked on the web page. It says what is shown, under
which condition, what an action does, or what is refetched.

fish is the reference. When fish has a bug, the criterion records what fish does, says that it is a
bug, and states what the web does instead.

## Run

```sh
npm run parity               # validate, then print the status table; exits 1 on any problem
npm run parity -- --verbose  # also list every screen with its milestone, status and route
npm run parity -- --json     # machine-readable summary, for /web-drift and CI
```

The script reads fish from `../fish`. Set `FISH_DIR` to use another location.

The script fails when any of these is true:
- a file does not parse, or its `area` is not the file name;
- a required field is missing or has a value outside the allowed set;
- an id is duplicated, or is not prefixed by its area or screen;
- a `fish` path, or the file part of a `fish_ref`, does not exist in fish;
- a fish screen file is not in any screen's `fish` list. Screen files are all
  `fish/app/**/*.tsx`, except `_layout.tsx` and `__tests__`;
- a web route is claimed by screens from two different areas;
- a `merged_into` names a screen that does not exist, or a screen that has no page of its own.

The script also prints warnings, which do not fail the run. Today it warns about any web screen
with fewer than 5 criteria.

## File format

```yaml
area: <key>                         # must equal the file name
screens:
  - id: <area>.<slug>               # stable, kebab-case; never renamed once used in a test
    title: <Romanian screen name>
    fish: [<paths relative to fish/>]   # the screen file and every component/hook whose behaviour it shows
    web_route: /concursuri/[id]/participanti   # Romanian segments, lib/routes.ts style; free text after the path is allowed
    merged_into: <screen id>        # optional: no page of its own, lives on that screen's page
    template: T1|T2|T3|T4|T5|T6|none    # ROADMAP §4
    milestone: M0..M8
    roles: [guest, angler, participant, organizer, referee, operator, admin]
    core: [<core/ modules or functions it needs>]
    states: [<signed-out, empty, loading, error, domain edge cases>]
    criteria:
      - id: <screen id>.c<n>
        text: <one checkable statement>
        fish_ref: <file:line>[; <file:line> …]
    mobile_only: false              # true only for timer, onboarding, cmp-personalize, rod-config, widgets/push/version check
    web_replacement: <text>         # required when mobile_only is true
    status: todo
behaviours:
  - id: <area>.b.<slug>
    text: <deep link / notification route / role gating / refetch interval / sign-in redirect …>
    fish_ref: <file:line>
```

Some notes on the fields:
- **`participant`** is an angler registered in the competition being viewed. Only the
  competition-page area uses it.
- **Shared routes:** several screens of the same area may share one `web_route`, for example the
  parts of `/concursuri` or the dialogs on `/concursuri/[id]`. Two areas never share a route. When
  two fish screens become one web page, the screen that does not own the page gets `merged_into`.
  Where the two disagree on the header, page size or layout, the owner's criteria win. The merged
  screen's states and its other criteria still apply to the owner's page. One example is
  `competitions-list.*-balta`, which is merged into `lakes.competitions`.
- **Dialogs** that have no URL of their own say so in `web_route`, for example
  `"dialogs over operator.rezervari / …"`. Such screens claim no route.

## Status

A screen's status moves forward one step at a time. The person or agent that proves a step is the one
that changes the status.

| Status | Meaning | Who moves it here, and how |
|---|---|---|
| `todo` | Inventoried, not built. | The inventory author. |
| `proposed` | The page is built and every criterion has a check, but the checks have not all passed yet, or the owner has not reviewed it. | The batch that builds the page. Its e2e spec cites each criterion id. |
| `passing` | Every criterion passes: by its e2e assertion, or by the parity verifier where it cannot be automated. The ROADMAP §5 gates (typecheck, lint, unit, contract, e2e, visual, axe, Lighthouse) are green for the route. | The parity verifier, after it re-checks the page against the fish code it cites. |
| `shipped` | It is on production behind no flag, and the owner has accepted it (ROADMAP §2 and §9). | The main session, after the release. |

A status goes back to `todo` or `proposed` when a later change breaks a criterion, or when fish
changes the behaviour. When a fish screen changes, update its criteria, and their `fish_ref` lines, in
the same task.

## How criteria are verified

1. **e2e.** Each web screen has a Playwright spec under `tests/e2e/`. Each test names the criterion
   ids it covers, for example `test('competition-page.cantare.c4 …')`. Signed-in tests use the QA
   user from `.env.local`.
2. **Parity verifier.** This is an agent pass, run per batch and at the end of each milestone. For
   every criterion it opens the cited fish code and the web page, at 375, 768, 1280 and 1440 px
   (`npm run shots`), signed out and signed in. It marks the criterion as passing, failing, or
   covered by e2e. It moves a screen to `passing` only when no criterion is failing and none is
   unchecked.
3. **/web-drift.** This is the workspace skill. It reads the inventory, using
   `npm run parity -- --json`, and reports the following per screen:
   - missing screens;
   - missing states;
   - failing criteria.

   A milestone closes only when /web-drift reports zero unexplained gaps.

## Adding or changing entries

- When fish gains a screen, `npm run parity` fails with the new file listed under "fish screen not
  in any screen's fish list". Add a screen entry to the area that owns it, with criteria taken from
  the code.
- When a fish file moves, `npm run parity` reports each `fish` path and `fish_ref` that no longer
  exists. Fix the paths. Do not delete the criteria.
- Pick web routes from `lib/routes.ts`. When a route is new, add it to `lib/routes.ts` in the batch
  that builds the page, and keep the inventory and the code in agreement.
