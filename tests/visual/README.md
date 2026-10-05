# Visual baselines

ROADMAP §5: every screen is captured at 375, 768, 1280 and 1440 for each state in its inventory
entry. Once the owner approves the captures they become Playwright `toHaveScreenshot` baselines,
and an unapproved visual change fails the run.

**Status: infrastructure only. No baselines are committed yet.** Until the owner approves them,
`npm run test:visual` fails with "snapshot doesn't exist" — that is expected.

## Files

| File | What |
|---|---|
| `playwright.visual.config.ts` | Own config (not part of `npm run test:e2e`). Light scheme, `ro-RO`, `Europe/Bucharest`, reduced motion, DPR 1. |
| `capture.ts` | `captureRoute({ name, path, states, widths?, mask? })` → one test per state × width. |
| `*.visual.spec.ts` | One file per screen. |
| `__screenshots__/<spec>/<name>-<state>-<width>-<platform>.png` | Baselines (after approval). |

## Stability

- `document.fonts.ready` before every capture.
- Animations, transitions, the LIVE pulse and the shimmer stopped (Playwright `animations: 'disabled'`
  plus an injected stylesheet); caret and scrollbars hidden.
- Lazy images: the page is scrolled top → bottom → top and every `<img>` is decoded.
- Dynamic content is masked: every `<time>`, every `[data-visual-mask]`, plus per-route selectors.
  **New UI that shows a relative time, a countdown or a live value must carry `data-visual-mask`**
  (or render a `<time>`).
- Live competitions are not baselined (they change between runs); e2e covers them.
- Tolerance: `maxDiffPixelRatio 0.002`, `threshold 0.2` (anti-aliasing only).

## Workflow

Needs the dev server on :3000 (or `VISUAL_BASE_URL`) and the local CMS on :1337 with the QA user
(`CONTRACT_EMAIL` / `CONTRACT_PASSWORD` in `.env.local`).

1. Capture for review: `npm run shots -- app <path> --widths 375,768,1280,1440` (the review page).
2. Owner approves.
3. `npm run test:visual:update` writes the baselines; review the PNGs and commit them with the
   screen.
4. From then on `npm run test:visual` compares. A deliberate change = re-approve, then step 3.

Platform: the file name carries `{platform}` because macOS and Linux rasterise fonts differently.
For CI, generate the Linux set inside the Playwright image so it matches the runner:

```sh
docker run --rm --network host -v "$PWD":/work -w /work mcr.microsoft.com/playwright:v1.63.0-noble \
  npx playwright test -c tests/visual/playwright.visual.config.ts --update-snapshots
```

Visual tests are not in CI yet: they need a CMS with fixed data (seeded local CMS or a frozen
fixture server). Wire them in once that exists.
