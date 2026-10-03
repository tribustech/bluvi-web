# Bluvi Design System

A design system for **Bluvi** — a Romanian-language mobile application for fishing enthusiasts.
Built on top of the live `tribustech/bluvi-mobile-app` codebase (Expo + Tamagui + React Native).

## What is Bluvi?

Bluvi is a community mobile app that lets Romanian anglers:

- **Discover lakes (bălți)** — browse, filter, and review fishing lakes around them on an interactive map.
- **Join & organize fishing competitions (concursuri)** — sign up, follow live weigh-ins, see rankings, watch live competitions, and act as referees.
- **Read fishing news (noutăți)** — community editorial content.
- **Catch & weigh logs** — record catches inside competitions through the app's scale flow.
- **Profile & social** — follow other anglers, share results, run a profile.
- **Sponsor & raffle integration** — co-marketing campaigns (e.g. "Bluvi & PescarMania" Fishing and Hunting Expo 2026 raffle).

The app is **Romanian-first** ("Bălți", "Concursuri", "Noutăți", "Pescari", "Înscrie-te"). The brand reads warm, community-oriented and slightly playful, while the UI itself is utilitarian and trust-building (hardware accents like fishing rods, scales, map pins).

## Sources

- **Repo:** `github.com/tribustech/bluvi-mobile-app` (Expo / React Native, Tamagui design tokens)
- **Theme tokens:** `theme.ts`, `tamagui.config.ts`
- **Typography:** `components/Typography.tsx` (preset map)
- **Components mined:** `Button.tsx`, `Badge.tsx`, `CompetitionCard.tsx`, `CardWithImageHeader.tsx`, `toastConfig.tsx`, the tabs layout, sign-in, onboarding, and dashboard.
- **Iconography:** Heroicons (per project README) + Lucide-React-Native + ~18 brand SVG icons in `assets/icons/` (fish, scales, rods, map pins).
- **Fonts:** **Nunito** (full italic + roman family) + SpaceMono for monospace.
- **App stores:** Bundle id `com.tribustech.bluvi`, splash bg `#6366F1` (indigo-5).

## Index

| File | Purpose |
| --- | --- |
| `colors_and_type.css` | Single source of truth for color and type CSS variables. Import in any HTML. |
| `assets/logo/` | Bluvi wordmark, fish-only mark, splash, Android icon, horizontal lockup. |
| `assets/icons/` | Brand-specific fishing & map SVG icons (rod, scale, fish, stand pin, etc.). |
| `assets/images/` | Illustrative photos and placeholders (lake, big-fish, confetti). |
| `assets/fonts/Nunito/` | Webfont files referenced by `colors_and_type.css`. |
| `preview/` | Design-system cards for the Design System tab. |
| `ui_kits/mobile/` | High-fidelity mobile UI kit — JSX components + `index.html` clickable demo. |
| `SKILL.md` | Cross-compatible skill manifest for Claude Code. |

---

## Content fundamentals

**Language:** Romanian only in product copy. Even brand-internal feature names are Romanian: *Bălți, Competiții, Concursuri, Noutăți, Profil, Pescari, Echipe, Bonul fiscal, Tragere la sorți.* Diacritics are honored (`ș`, `ț`, `ă`, `î`, `â`).

**Tone:** Warm, encouraging, casual-but-respectful. Talks to the user as a peer (singular "tu" form: *Salut!*, *Bine ai venit!*, *Ai tot ce trebuie...?*). Sentences are short, often exclamatory, and frequently lead with a verb in the imperative (*Înscrie-te*, *Descoperă*, *Participă*, *Alătură-te*).

**Examples (from the codebase):**
- Dashboard slogans: *"Capturi mari, povești și mai mari. Împărtășește-ți aventura!"*, *"Pescuitul e mai frumos când ai cu cine să îți spui poveștile!"*
- Empty states: *"Momentan nu este disponibilă nicio baltă."*
- Onboarding: *"Bine ai (re)venit in Bluvi!"*, *"Descoperă locuri de pescuit în apropierea ta"*
- CTAs: *"Începe"*, *"Următorul"*, *"Sari peste"*, *"Continuă ca vizitator"*, *"Vezi câștigători"*
- Lake banner: *"Nu găsești balta preferată? Sugerează-ne o baltă..."*

**Casing:** Sentence case in headings and CTAs. Dates inside cards are `UPPERCASED` (`getDisplayedDate(...).toUpperCase()`). Section titles use sentence case with optional inline counts in parens — e.g. `Bălți (24)`, `Concursuri live (3)`.

**Emoji:** Sparingly, mostly in the source repo's own README (`👋`, `✨`, `🌟`, `⭐`). **Not** used as primary iconography in the product UI itself. When you need a "fishing" feel, use the SVG icon set, not emoji.

**Vibe:** Community-first. Always assumes the reader is here to fish, talk about fish, and meet other people who fish. Never corporate. Never patronizing.

---

## Visual foundations

**Brand identity is built on one bold color: indigo `#6366F1`** (`indigo-5`). It's the splash background, the primary button, the tab-bar active state, and the link/accent color throughout. Pair it with a saturated full-bleed lake/fishing photo and Nunito Bold and you're 80% on-brand.

### Color
- **Primary:** indigo-5 `#6366F1`. Pressed = same color at `opacity: 0.8`. Disabled = indigo-4 `#A5B4FC`. Deep accent / outline borders use indigo-5 directly.
- **Surface:** mostly pure white cards on a near-white page. Tinted backgrounds appear in badges and toasts (indigo-1, green-2, red-1, yellow-1@50%).
- **Text:** body text reads near-black (`gray-10`). Helper/muted text is `gray-5`. Links and emphasized stats are indigo-5. Dates use `gray-10` at small sizes.
- **Status pairings (from `Badge.tsx` + `toastConfig.tsx`):**
  - success → bg `green-2` + border/text `green-7`
  - warning → bg `yellow-1@50%` + text `yellow-6`
  - danger → bg `red-1` + border/text `red-5`
  - info / branded → bg `indigo-1` + text `indigo-5`
  - solid brand badge → bg `indigo-5` + text white (used for "validated" check overlays)

### Type
- Single family: **Nunito** (Bold + SemiBold + Italics). No serif, no display, no mono in product UI (SpaceMono ships but is unused in screens we examined).
- Nunito is rounded and friendly — that's intentional. **Never substitute Inter or system stacks** in mocks.
- Weights: SemiBold 600 for body, Bold 700 for everything that wants attention (headings, helpers, badges, button labels).
- Sizes are tight: 12 / 14 / 16 / 20px. Rarely larger than 24 (onboarding hero is `fontSize: 24`).

### Spacing & layout
- Built on Tamagui's `space` token scale. Common gaps: 4 / 8 / 10 / 12 / 16 / 20px.
- Screen padding is uniformly `padding: 20`.
- Cards almost always have an internal `gap: 8` or `gap: 10` between rows (title, meta, badges).
- Tab bar floats with rounded top corners (`borderTopLeftRadius: 16`, `borderTopRightRadius: 16`) and a subtle shadow — it's not flush.

### Backgrounds & imagery
- **Backgrounds:** mostly flat white. The brand never uses gradient backdrops. The only "indigo background" appearances are: (a) splash screen (`#6366F1`) and (b) `confetti-indigo.png` decorative overlays on win/raffle states.
- **Imagery is photographic.** Lakes and competitions always lead with a real image (full-bleed at the top of the card, 200px tall, 10px radius). When loading, an Expo blurhash is used as a placeholder — never a colored skeleton block.
- The `big-fish.png` and `big-score.png` illustrations exist for celebratory moments; otherwise illustration is rare.
- Lottie animations (`finsherman.json`, `success-confetti.json`, `success.json`, `error.json`, `pending.json`) animate the onboarding hero and feedback states.

### Animation
- All animation goes through Tamagui's spring presets (`@tamagui/animations-moti`):
  - `fast`   — damping 20, stiffness 250 (UI affordances)
  - `select` — damping 10, mass 0.4, stiffness 85 (selection bounce)
  - `medium` — damping 10, mass 0.9, stiffness 100 (default — slogan crossfade)
  - `slow`   — damping 20, stiffness 60 (sheets / large transitions)
- **No fades, no easings curves named "ease-in-out"** — the language is *spring*. Things settle, they don't slide.
- Slogans on the dashboard cross-fade with `enterStyle={{ opacity: 0, y: 10 }}` — small Y offset, not large.
- Haptic light feedback fires on every primary button press (`useHapticFeedback('impactLight')`).

### Hover / press states
- **Press = `opacity: 0.8`** for primary, `opacity: 0.5` for chromeless / icon-only. The background color does *not* change on press for primary buttons (only opacity).
- Press on cards: `pressStyle={{ opacity: 0.7 }}` — softer than buttons.
- Disabled = ~50% opacity OR a step lighter (`indigo-4` for disabled primary).

### Borders & shadows
- Outlined buttons use a **2px border** in `indigo-5` on white.
- Divider lines (`Separator borderColor="$gray4"`) live inside cards, never page-wide.
- Two distinct shadow systems:
  - **Card cover shadow:** `0 5px 3.84 rgba(0,0,0,.25)` — lifts photo cards.
  - **Brand glow:** `0 2px 10 rgba(99,102,241,0.15)` — only on the dashboard profile card. This is a *signature* shadow.
  - **Button shadow:** subtle `0 2px 4 rgba(0,0,0,0.1)`.

### Corner radii
- Buttons: 10px.
- Cards: 10px (default), 16px (profile / hero cards).
- Badges: 2px (intentionally crisp, almost rectangular). This contrasts with the rounder buttons/cards.
- Tab bar top corners: 16px.
- Avatars: 12px (squircle-ish), or `borderRadius: 999` for circular.

### Transparency & blur
- Used sparingly. Notable: live-competition viewer pill sits over the photo; uses `expo-blur` with low intensity. Press states use `opacity` rather than translucent overlays.

### Card anatomy (signature)
1. **Photo** at top, 200px tall, full-bleed inside a 10px-radius card.
2. Optional **solid-indigo badge** absolutely positioned top-left with a check icon (used for "verified" / status).
3. White content area with `padding: 10`, `gap: 4`.
4. Content order: `UPPERCASED date` → big bold title → `MapPin` icon + lake name in indigo → `Separator` → avatars + participant count → small badges in a row → organizer chip → optional fee block.

---

## Iconography

**Two systems, used together:**

1. **Heroicons** (`react-native-heroicons` — outline + solid). The default UI iconography: tab-bar icons (`HomeIcon`, `MapIcon`, `TrophyIcon`, `NewspaperIcon`, `UserIcon`), `BellAlertIcon`, `MapPinIcon`, `CheckIcon`, `CheckCircleIcon`, `ExclamationCircleIcon`. Used at 12 / 20 / 24 / 32px, stroke-based for inactive states, solid for "presence" affordances (a check inside a colored badge).
2. **Lucide-React-Native** (`lucide-react-native`) — used for a few dashboard items the project README didn't mention: e.g. `ShieldUserIcon` for confidentiality settings.

**Brand SVGs** (in `assets/icons/`) cover the *fishing-specific* iconography Heroicons can't:
- `fish.svg` / `dead-fish.svg` — catch states.
- `fishing-rod.svg`, `fishing-man.svg`, `scale.svg` — feature glyphs.
- `catch.svg`, `tips.svg` — competition & content section markers.
- `map-pin.svg`, `map-pin-stand-default.svg`, `map-pin-stand-selected.svg`, `stand-pin.svg` — map markers.
- `google.svg`, `facebook.svg`, `google-maps.svg`, `waze.svg` — third-party auth and map providers.
- `sad-search.svg`, `sad-star.svg` — empty-state mascots.

**For HTML mocks:** prefer the brand SVGs from `assets/icons/` for fishing-domain glyphs, and **Heroicons via CDN** for generic UI:
```html
<!-- Heroicons (outline) — example -->
<img src="https://cdn.jsdelivr.net/npm/heroicons@2.0.18/24/outline/home.svg" width="24" height="24" alt="">
```

**Emoji:** Not used in product UI. Don't introduce them into mocks unless the user asks.
**Unicode glyphs:** Not used as icons. Don't sub stars (★), arrows (→), or check marks for icons — use the SVG/Heroicon equivalents.

---

## Design tokens at a glance

| Token | Value | Used for |
|---|---|---|
| `--brand` | `#6366F1` (indigo-5) | Primary buttons, tab active, links |
| `--brand-hover` | `#4338CA` (indigo-7) | Pressed/focused brand state |
| `--brand-tint` | `#F0F3FD` (indigo-1) | Soft brand backgrounds, badges |
| `--fg-body` | `gray-10` `#262626` | Default text |
| `--fg-muted` | `#737373` (gray-5) | Helper text, dates, meta |
| `--bg-input` | `#F2F2F2` (gray-1) | Input field backgrounds |
| `--radius-lg` | 10px | Buttons, cards |
| `--shadow-glow` | indigo @ 15% | Dashboard profile card (signature) |

---

## Caveats & substitutions

- **Heroicons via CDN.** The repo uses `react-native-heroicons`. For HTML previews we substitute with the same SVGs served from jsdelivr. Visual fidelity is identical.
- **No SpaceMono in mocks.** It ships in fonts/ but no screen we examined uses it. Don't import it unless you need code-style display.
- **Lottie animations:** captured in `assets/animations/success-confetti.json`. Other animations (finsherman, error, pending) live in the upstream repo and were not re-imported to keep the design-system folder lean — pull on demand.
