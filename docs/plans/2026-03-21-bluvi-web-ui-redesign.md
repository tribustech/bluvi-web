# Bluvi Web UI Redesign — Match Mobile App Design Language

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all lint errors and redesign every web component to match the mobile app's visual identity — shadow-based cards with image overlap, tight spacing, separator lines, and the clean/minimal Bluvi aesthetic.

**Architecture:** The mobile app uses a distinct design language built on Tamagui tokens: shadow-based cards (no borders), `CardWithImageHeader` pattern with negative-margin image overlap, `borderRadius: 10`, tight `gap: 2-4` spacing, separator lines between card sections, and a minimal color palette. The web currently uses generic shadcn/ui bordered cards that feel disconnected from the mobile experience. This plan systematically transforms every web component to match.

**Tech Stack:** Next.js 15, Tailwind CSS 4, shadcn/ui primitives (restyled), lucide-react, next/image

---

## Design Language Reference (from mobile app)

These patterns MUST be followed across all components:

### Card Pattern (from `CardWithImageHeader.tsx`)
- `border-radius: 10px` (use `rounded-card`)
- Shadow-based elevation: `shadow-[0_5px_15px_rgba(0,0,0,0.12)]` — NO borders
- Image header fills top, content section overlaps image by ~10px via negative margin
- Content padding: `p-3` to `p-4`, gap: `gap-1` to `gap-2` (tight)
- White background, no backdrop-blur or glassmorphism on cards

### Badge Pattern (from mobile `Badge.tsx`)
- `rounded-[2px]` (NOT rounded-sm which is 4px)
- `px-1.5 py-[2.5px]` (very compact)
- `text-xs font-bold uppercase tracking-wider`

### Separator Pattern
- Thin `border-t border-gray-1` between card sections (like between header info and footer stats)

### Section Headers (from `SeeAllTitle.tsx`)
- `text-xl font-bold text-gray-7` for section titles
- "Vezi toate" link: `text-sm font-bold text-indigo-5` with ChevronRight icon

### Empty States (from `SadEmptyList.tsx`)
- Centered icon (large, muted), heading at 24px, gray5 description

### Buttons (from mobile `Button.tsx`)
- `rounded-[10px]` (use `rounded-button`)
- Shadow: `shadow-[0_2px_8px_rgba(0,0,0,0.1)]`
- No borders on primary buttons

### Colors (ONLY use these)
- Primary: `indigo-5` (#6366F1), dark: `indigo-7` (#4338CA), light bg: `indigo-1` (#F0F3FD)
- Success: `green-7` on `green-2` bg
- Warning: `yellow-6` on `yellow-1` bg
- Error: `red-5` on `red-1` bg
- Text: `gray-7` primary, `gray-5` secondary
- Borders (sparingly): `gray-1` or `gray-2`

---

### Task 1: Fix Lint Errors — Replace `<img>` with `<Image>` and Remove Unused Imports

**Files:**
- Modify: `components/domain/raffle-dashboard.tsx`
- Modify: `components/domain/profile-form.tsx`
- Modify: `components/domain/organizer-draft-review.tsx`
- Modify: `app/(public)/lakes/[slug]/page.tsx`

**Step 1: Fix raffle-dashboard.tsx — replace 4 `<img>` tags with `<Image>`**

Add `import Image from "next/image"` at line 3. Replace:
- Line 22: winner avatar `<img>` → `<Image width={32} height={32}>`
- Line 72-73: header logos `<img>` → `<Image width={40} height={40}>`
- Line 172: prize image `<img>` → `<Image width={64} height={64}>`

```tsx
// Line 22 area — winner avatar
{winner.avatarUrl ? (
  <Image src={resolveMediaUrl(winner.avatarUrl)} alt="" width={32} height={32} className="rounded-full object-cover" />
) : (
```

```tsx
// Lines 72-73 — header logos
{raffle.session.headerLogoLeftUrl && <Image src={resolveMediaUrl(raffle.session.headerLogoLeftUrl)} alt="" width={120} height={40} className="h-10 w-auto" />}
{raffle.session.headerLogoRightUrl && <Image src={resolveMediaUrl(raffle.session.headerLogoRightUrl)} alt="" width={120} height={40} className="h-10 w-auto" />}
```

```tsx
// Line 172 — prize image
{prize.image?.url && (
  <Image src={resolveMediaUrl(prize.image.url)} alt={prize.title} width={64} height={64} className="rounded-card object-cover" />
)}
```

**Step 2: Fix profile-form.tsx — replace `<img>` with `<Image>`**

Add `import Image from "next/image"` at line 3. Replace line 90:

```tsx
{currentAvatarUrl ? (
  <Image src={currentAvatarUrl} alt="Avatar" width={80} height={80} className="h-full w-full rounded-full object-cover" />
) : (
```

**Step 3: Fix organizer-draft-review.tsx — remove unused `Megaphone` import**

Change line 10 from:
```tsx
import { Check, Pencil, Loader2, Send, Calendar, Users, Trophy, MapPin, Megaphone } from "lucide-react";
```
to:
```tsx
import { Check, Pencil, Loader2, Send, Calendar, Users, Trophy, MapPin } from "lucide-react";
```

**Step 4: Fix lakes/[slug]/page.tsx — replace `<img>` with `<Image>` for fish species**

Add `import Image from "next/image"` (already imported at the file level? Check — it's NOT imported currently). Add the import, then replace line 163-167:

```tsx
<Image
  src={resolveMediaUrl(species.fish.Image.url)}
  alt={species.fish?.Name || ""}
  width={200}
  height={112}
  className="h-full w-full object-contain p-2"
/>
```

**Step 5: Run lint to verify all warnings are resolved**

Run: `cd bluvi-web && npx next lint`
Expected: No warnings about `<img>` or unused imports.

**Step 6: Commit**

```bash
git add -A && git commit -m "fix: replace <img> with next/image, remove unused imports"
```

---

### Task 2: Redesign Global CSS — Remove Glassmorphism, Add Shadow-Based Card System

**Files:**
- Modify: `app/globals.css`

**Step 1: Replace `.surface-card` class**

The current `.surface-card` uses `backdrop-filter: blur(14px)` and borders — this is the #1 source of the "generic" look. Replace with mobile-matching shadow:

```css
.surface-card {
  background: #ffffff;
  border-radius: 10px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.08);
}
```

**Step 2: Update body background**

Simplify the gradient — the mobile app uses a clean light background, not a heavy purple-tinted gradient:

```css
body {
  margin: 0;
  min-height: 100vh;
  background: #f6f7fb;
  color: hsl(var(--foreground));
  font-family: var(--font-nunito), sans-serif;
}
```

**Step 3: Add utility classes for mobile-matching patterns**

```css
/* Card with image header — the overlap effect from mobile's CardWithImageHeader */
.card-image-overlap {
  margin-top: -10px;
  padding-top: 20px;
  position: relative;
  z-index: 1;
  background: #ffffff;
  border-bottom-left-radius: 10px;
  border-bottom-right-radius: 10px;
}

/* Separator line matching mobile */
.separator {
  border-top: 1px solid #f2f2f2;
}
```

**Step 4: Run `npm run build` to verify no breaking changes**

Run: `cd bluvi-web && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add app/globals.css && git commit -m "style: replace glassmorphism with shadow-based cards matching mobile"
```

---

### Task 3: Redesign `ui/card.tsx` — Shadow-Based, No Borders

**Files:**
- Modify: `components/ui/card.tsx`

**Step 1: Update Card component to use shadow instead of surface-card**

```tsx
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)]", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-lg font-bold text-gray-7", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-gray-5", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center px-4 pb-4", className)} {...props} />;
}
```

Key changes: `p-5 → p-4`, `pt-0` removed (padding handled by parent), shadow replaces `surface-card`.

**Step 2: Verify build**

Run: `cd bluvi-web && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/ui/card.tsx && git commit -m "style: card component uses shadow, tighter padding, no borders"
```

---

### Task 4: Redesign `ui/badge.tsx` — Match Mobile Badge Exactly

**Files:**
- Modify: `components/ui/badge.tsx`

**Step 1: Update badge to match mobile's compact style**

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[2px] px-1.5 py-[2.5px] text-xs font-bold uppercase tracking-wider",
  {
    variants: {
      variant: {
        default: "bg-indigo-5 text-white",
        secondary: "bg-indigo-1 text-indigo-7",
        destructive: "bg-red-5 text-white",
        outline: "border border-gray-2 bg-white text-gray-7",
        indigo: "bg-indigo-1 text-indigo-5",
        solidIndigo: "bg-indigo-5 text-white",
        green: "bg-green-2 text-green-7",
        gray: "bg-gray-1 text-gray-7",
        yellow: "bg-yellow-1 text-yellow-6",
        red: "bg-red-1 text-red-5",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

Key changes: `rounded-sm` → `rounded-[2px]`, `px-2 py-1` → `px-1.5 py-[2.5px]`, added `uppercase tracking-wider`.

**Step 2: Commit**

```bash
git add components/ui/badge.tsx && git commit -m "style: badge matches mobile borderRadius/padding/tracking"
```

---

### Task 5: Redesign `CompetitionCard` — Image Overlap + Shadow + Separator

**Files:**
- Modify: `components/domain/competition-card.tsx`

**Step 1: Rewrite to match mobile's `CompetitionCard` pattern**

```tsx
import Image from "next/image";
import Link from "next/link";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { Competition } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatDate, resolveMediaUrl } from "@/lib/utils";

const statusMap: Record<string, { label: string; variant: "indigo" | "green" | "gray" | "yellow" }> = {
  notStarted: { label: "Urmeaza", variant: "indigo" },
  started: { label: "Live", variant: "green" },
  completed: { label: "Finalizata", variant: "gray" },
  draft: { label: "Draft", variant: "yellow" },
};

export function CompetitionCard({ competition }: { competition: Competition }) {
  const image = resolveMediaUrl(competition.banner?.url) || "/logo.svg";
  const status = statusMap[competition.competitionStatus] || { label: competition.competitionStatus, variant: "gray" as const };

  return (
    <Link href={`/competitions/${competition.documentId}`}>
      <div className="overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_8px_25px_rgba(0,0,0,0.12)]">
        {/* Image header */}
        <div className="relative h-[200px] w-full">
          <Image src={image} alt={competition.name} fill className="object-cover" />
        </div>

        {/* Content with overlap */}
        <div className="card-image-overlap px-4 pb-4">
          {/* Date */}
          <p className="text-xs font-bold uppercase tracking-wider text-gray-5">
            {formatDate(competition.startDate)} - {formatDate(competition.endDate)}
          </p>

          {/* Title */}
          <h3 className="mt-1 text-lg font-bold text-gray-7">{competition.name}</h3>

          {/* Lake */}
          <div className="mt-1 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-indigo-5" />
            <span className="text-sm text-gray-5">{competition.lake?.name ?? "Locatie in curs"}</span>
          </div>

          {/* Separator */}
          <div className="separator my-3" />

          {/* Footer: participants + badges + fee */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-gray-5">
                <Users className="h-3.5 w-3.5 text-indigo-5" />
                <span>{competition.participantsRegistered ?? 0}/{competition.participantsLimit ?? "-"}</span>
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-lg font-bold text-gray-7">{competition.registerFee} lei</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
```

Key changes:
- Removed shadcn Card wrapper — direct div with shadow
- Image header at 200px (matching mobile)
- `card-image-overlap` class for the negative-margin overlap effect
- Date above title (matching mobile's helper2 pattern)
- Separator between info and footer stats
- Fee shown as heading1-weight (matching mobile)
- Tighter spacing throughout (`gap-1`, `mt-1`)

**Step 2: Verify build**

Run: `cd bluvi-web && npm run build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add components/domain/competition-card.tsx && git commit -m "style: competition card matches mobile — shadow, overlap, separator"
```

---

### Task 6: Redesign `LakeCard` — Image Overlap + Shadow + Fish Badges

**Files:**
- Modify: `components/domain/lake-card.tsx`

**Step 1: Rewrite to match mobile's `NewLakeCardWithCarouselHeader`**

```tsx
import Image from "next/image";
import Link from "next/link";
import { MapPinned, Star, BadgeCheck } from "lucide-react";
import type { Lake } from "@/types";
import { Badge } from "@/components/ui/badge";
import { resolveMediaUrl } from "@/lib/utils";

export function LakeCard({ lake }: { lake: Lake }) {
  const image = resolveMediaUrl(lake.images?.[0]?.url) || "/logo.svg";

  return (
    <Link href={`/lakes/${lake.documentId}`}>
      <div className="overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_8px_25px_rgba(0,0,0,0.12)]">
        {/* Image header */}
        <div className="relative h-[200px] w-full">
          <Image src={image} alt={lake.name} fill className="object-cover" />
        </div>

        {/* Content with overlap */}
        <div className="card-image-overlap px-4 pb-4">
          {/* Title row with rating */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-bold text-gray-7">{lake.name}</h3>
              {lake.isVerified && <BadgeCheck className="h-4 w-4 text-indigo-5" />}
            </div>
            {lake.reviewsMeta?.averageRating ? (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-5 text-yellow-5" />
                <span className="text-sm font-bold text-gray-7">{lake.reviewsMeta.averageRating.toFixed(1)}</span>
              </div>
            ) : null}
          </div>

          {/* Address */}
          <div className="mt-1 flex items-center gap-1.5">
            <MapPinned className="h-3.5 w-3.5 text-indigo-5" />
            <span className="text-sm text-gray-5">{lake.address || lake.county || "Romania"}</span>
          </div>

          {/* Separator */}
          <div className="separator my-3" />

          {/* Fish species as badges */}
          <div className="flex flex-wrap gap-1.5">
            {lake.fishSpecies?.slice(0, 4).map((item, i) => (
              <Badge key={i} variant="indigo">{item.fish?.Name || "Specie"}</Badge>
            ))}
            {(lake.fishSpecies?.length ?? 0) > 4 && (
              <Badge variant="gray">+{(lake.fishSpecies?.length ?? 0) - 4}</Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
```

Key changes: same shadow+overlap pattern, Star rating in header, fish species as compact badges after separator.

**Step 2: Commit**

```bash
git add components/domain/lake-card.tsx && git commit -m "style: lake card matches mobile — shadow, overlap, rating, fish badges"
```

---

### Task 7: Redesign `NewsCard` — Image Overlap + Shadow

**Files:**
- Modify: `components/domain/news-card.tsx`

**Step 1: Rewrite with mobile patterns**

```tsx
import Image from "next/image";
import Link from "next/link";
import type { NewsArticle } from "@/types";
import { timeAgo, resolveMediaUrl } from "@/lib/utils";

export function NewsCard({ article }: { article: NewsArticle }) {
  const image = resolveMediaUrl(article.banner?.url) || "/logo.svg";
  const slug = article.slug || article.documentId;

  return (
    <Link href={`/news/${slug}`}>
      <div className="overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_8px_25px_rgba(0,0,0,0.12)]">
        {/* Image header */}
        <div className="relative h-[200px] w-full">
          <Image src={image} alt={article.title} fill className="object-cover" />
        </div>

        {/* Content with overlap */}
        <div className="card-image-overlap px-4 pb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-5">
            {article.createdAt ? timeAgo(article.createdAt) : "Recent"}
          </p>
          <h3 className="mt-1 text-lg font-bold text-gray-7">{article.title}</h3>
          <p className="mt-1 text-sm text-gray-5 line-clamp-2">
            {article.excerpt || "Ultimele noutati din ecosistemul Bluvi."}
          </p>
        </div>
      </div>
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add components/domain/news-card.tsx && git commit -m "style: news card matches mobile — shadow, overlap, compact"
```

---

### Task 8: Redesign Home Page — Clean Layout, Mobile-Matching Section Headers

**Files:**
- Modify: `app/(public)/page.tsx`

**Step 1: Clean up the hero section and section headers**

Key changes:
- Hero: simplify background, remove the "Organizer flow" stat card (too technical), clean copy
- Section headers: use "Vezi toate" with ChevronRight icon (matching mobile's SeeAllTitle)
- Remove developer-facing copy ("SEO pages", "URL-friendly", "indexable")

```tsx
import Link from "next/link";
import { ArrowRight, Trophy, ChevronRight } from "lucide-react";
import { organizationJsonLd } from "@/lib/structured-data";
import { CompetitionCard } from "@/components/domain/competition-card";
import { LakeCard } from "@/components/domain/lake-card";
import { NewsCard } from "@/components/domain/news-card";
import { Button } from "@/components/ui/button";
import { safeStrapiGet } from "@/lib/strapi";
import type { Competition, Lake, NewsArticle, StrapiPaginatedResponse } from "@/types";

export const revalidate = 300;

export default async function HomePage() {
  const [competitions, lakes, news] = await Promise.all([
    safeStrapiGet<StrapiPaginatedResponse<Competition>>(
      "/competitions",
      {
        "filters[competitionStatus][$in]": ["started", "notStarted"],
        "pagination[pageSize]": 6,
        sort: "startDate:asc",
        populate: ["lake", "banner"],
      },
      { tags: ["competitions"], revalidate },
    ),
    safeStrapiGet<StrapiPaginatedResponse<Lake>>(
      "/lakes",
      {
        "pagination[pageSize]": 6,
        sort: "updatedAt:desc",
        populate: ["images", "facility", "fishSpecies.fish"],
      },
      { tags: ["lakes"], revalidate },
    ),
    safeStrapiGet<StrapiPaginatedResponse<NewsArticle>>(
      "/announcements",
      {
        "pagination[pageSize]": 4,
        sort: "createdAt:desc",
        populate: ["banner"],
      },
      { tags: ["news"], revalidate },
    ),
  ]);

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }} />

      {/* Hero */}
      <section className="overflow-hidden rounded-card bg-white px-6 py-12 shadow-[0_5px_15px_rgba(0,0,0,0.08)] md:px-10 md:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-1 px-4 py-2 text-sm font-bold text-indigo-7">
              <Trophy className="h-4 w-4" />
              Platforma Bluvi
            </div>
            <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight text-gray-7 md:text-4xl">
              Competitii de pescuit, balti si clasamente live.
            </h1>
            <p className="mt-4 max-w-xl text-gray-5">
              Descopera competitii, exploreaza balti din toata Romania si urmareste clasamentele in timp real.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/competitions">
                  Exploreaza competitiile
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/sign-in">Intra in cont</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-card bg-indigo-5 p-6 text-white shadow-[0_5px_15px_rgba(99,102,241,0.3)]">
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-2">Competitii active</p>
            <p className="mt-2 text-4xl font-bold">{competitions?.meta.pagination.total ?? 0}</p>
            <p className="mt-1 text-sm text-indigo-2">competitii disponibile acum</p>
          </div>
        </div>
      </section>

      {/* Competitions */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-7">Competitii recomandate</h2>
          <Link href="/competitions" className="flex items-center gap-1 text-sm font-bold text-indigo-5">
            Vezi toate <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(competitions?.data ?? []).map((competition) => (
            <CompetitionCard key={competition.documentId} competition={competition} />
          ))}
        </div>
      </section>

      {/* Lakes */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-7">Balti populare</h2>
          <Link href="/lakes" className="flex items-center gap-1 text-sm font-bold text-indigo-5">
            Vezi toate <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {(lakes?.data ?? []).map((lake) => (
            <LakeCard key={lake.documentId} lake={lake} />
          ))}
        </div>
      </section>

      {/* News */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-7">Noutati</h2>
          <Link href="/news" className="flex items-center gap-1 text-sm font-bold text-indigo-5">
            Vezi toate <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {(news?.data ?? []).map((article) => (
            <NewsCard key={article.documentId} article={article} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add app/\(public\)/page.tsx && git commit -m "style: home page — clean hero, mobile-matching section headers"
```

---

### Task 9: Redesign Listing Pages — Clean Headers, Remove Dev Copy

**Files:**
- Modify: `app/(public)/competitions/page.tsx`
- Modify: `app/(public)/lakes/page.tsx`

**Step 1: Clean competitions page header**

Replace the subtitle "Filtrare URL-friendly pentru status si paginare indexabila." with user-facing copy:

```tsx
<p className="mt-2 text-sm text-gray-5">Descopera competitii de pescuit din toata Romania.</p>
```

**Step 2: Clean lakes page header**

Replace "Listare publica optimizata pentru descoperire si SEO." with:

```tsx
<p className="mt-2 text-sm text-gray-5">Exploreaza baltile disponibile pe platforma Bluvi.</p>
```

Also style the search input to match the design:

```tsx
<input
  defaultValue={q}
  name="q"
  placeholder="Cauta dupa nume sau adresa"
  className="h-10 rounded-card border border-gray-2 bg-white px-4 text-sm text-gray-7 placeholder:text-gray-5 focus:border-indigo-4 focus:outline-none focus:ring-2 focus:ring-indigo-1"
/>
<button className="rounded-card bg-indigo-5 px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(99,102,241,0.2)]">Cauta</button>
```

**Step 3: Commit**

```bash
git add app/\(public\)/competitions/page.tsx app/\(public\)/lakes/page.tsx && git commit -m "style: listing pages — user-facing copy, clean search styling"
```

---

### Task 10: Redesign Lake Detail Page — Consistent Shadow Cards

**Files:**
- Modify: `app/(public)/lakes/[slug]/page.tsx`

**Step 1: Update all section containers to use shadow-based cards**

Replace all `surface-card rounded-sheet` with `rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)]`. Replace all `rounded-card bg-white ring-1 ring-gray-2` (facilities) with `rounded-card bg-gray-1` (no ring).

Key changes throughout the file:
- Line 95: `surface-card rounded-sheet` → `rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)]`
- Line 142: facility items remove `ring-1 ring-gray-2`
- Line 160: fish species cards use shadow
- Line 202: pricing section uses shadow
- Line 223: contact section uses shadow
- Line 249: map section uses shadow
- Line 269: reviews section uses shadow

**Step 2: Update info items grid to be more compact**

Replace the multi-colored background info items with a simpler row:

```tsx
{infoItems.length > 0 && (
  <div className="mt-4 flex flex-wrap gap-4">
    {infoItems.map((item) => (
      <div key={item.label} className="flex items-center gap-2">
        <item.icon className="h-4 w-4 text-indigo-5" />
        <span className="text-sm text-gray-5">{item.label}:</span>
        <span className="text-sm font-bold text-gray-7">{item.value}</span>
      </div>
    ))}
  </div>
)}
```

**Step 3: Commit**

```bash
git add app/\(public\)/lakes/\[slug\]/page.tsx && git commit -m "style: lake detail — shadow cards, compact info, no rings/borders"
```

---

### Task 11: Redesign Image Carousel — Remove Border Artifacts

**Files:**
- Modify: `components/domain/image-carousel.tsx`

**Step 1: Update carousel to use shadow-based container**

Replace line 25 `rounded-sheet bg-gray-1` with `rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)]`.

Update empty state (line 14): match mobile's SadEmptyList pattern with larger icon.

Update thumbnail strip: remove the `ring-2 ring-indigo-5` active state, use shadow instead:

```tsx
className={cn(
  "relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-card transition",
  i === current ? "shadow-[0_0_0_2px_#6366F1]" : "opacity-60 hover:opacity-100",
)}
```

**Step 2: Commit**

```bash
git add components/domain/image-carousel.tsx && git commit -m "style: carousel uses shadow container, indigo outline for active thumb"
```

---

### Task 12: Redesign Weighing Components — Remove Borders

**Files:**
- Modify: `components/domain/weighing-history.tsx`
- Modify: `components/domain/weighing-form.tsx`

**Step 1: Update weighing history**

- Line 9: empty state — replace `border border-dashed border-gray-2` with shadow card
- Line 19: weighing cards — already uses `surface-card`, will inherit new shadow style
- Line 48: catch pills — replace `ring-1 ring-gray-2` with `shadow-sm`

**Step 2: Update weighing form**

- Line 77: "no weighing" state — replace `border border-dashed border-indigo-4 bg-indigo-1` with `rounded-card bg-indigo-1 shadow-[0_2px_8px_rgba(99,102,241,0.15)]`

**Step 3: Commit**

```bash
git add components/domain/weighing-history.tsx components/domain/weighing-form.tsx && git commit -m "style: weighing components — shadow instead of borders"
```

---

### Task 13: Redesign Raffle Dashboard — Consistent Shadows

**Files:**
- Modify: `components/domain/raffle-dashboard.tsx`

**Step 1: Update raffle components**

- Empty state (line 40): replace `border border-dashed border-gray-2` with shadow card
- Winner card (line 17): replace `ring-1 ring-gray-2` with shadow-sm
- Prize items (line 169): replace `border border-gray-2` with shadow
- Type selection buttons: already styled well, keep

**Step 2: Commit**

```bash
git add components/domain/raffle-dashboard.tsx && git commit -m "style: raffle dashboard — shadow cards, no borders"
```

---

### Task 14: Redesign Profile Form — Consistent Styling

**Files:**
- Modify: `components/domain/profile-form.tsx`

**Step 1: Update form container**

Replace line 77 `surface-card rounded-sheet` with `rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)]`.

Avatar button: replace `border-2` with shadow for the active state:
```tsx
currentAvatarUrl ? "shadow-[0_0_0_2px_#A5B4FC]" : "border-2 border-dashed border-gray-2"
```

**Step 2: Commit**

```bash
git add components/domain/profile-form.tsx && git commit -m "style: profile form — shadow container, avatar ring"
```

---

### Task 15: Redesign Notification Bell — Shadow Dropdown

**Files:**
- Modify: `components/shared/notification-bell.tsx`

**Step 1: Update dropdown**

Line 56: replace `border border-gray-2 bg-white shadow-card` with `bg-white shadow-[0_10px_30px_rgba(0,0,0,0.15)]` (no border, stronger shadow for elevated dropdown).

Notification items: remove `border-b border-gray-1` between items, use a subtler separator or gap instead.

**Step 2: Commit**

```bash
git add components/shared/notification-bell.tsx && git commit -m "style: notification dropdown — shadow, no borders"
```

---

### Task 16: Redesign Organizer Draft Review — Consistent Cards

**Files:**
- Modify: `components/domain/organizer-draft-review.tsx`

**Step 1: Update review sections**

Line 24: replace `border border-gray-2` with `bg-gray-1 shadow-sm`.

The outer Card is already updated by Task 3.

**Step 2: Commit**

```bash
git add components/domain/organizer-draft-review.tsx && git commit -m "style: organizer review — shadow sections, no borders"
```

---

### Task 17: Update Header & Footer — Clean Styling

**Files:**
- Modify: `components/shared/header.tsx`
- Modify: `components/shared/footer.tsx`

**Step 1: Update header**

Replace `border-b border-white/50 bg-white/80 backdrop-blur-xl` with:
```
bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.06)] backdrop-blur-sm
```

No heavy border, subtle shadow instead. Keep the blur minimal.

**Step 2: Update footer**

Replace `border-t border-white/60 bg-white/70 backdrop-blur-xl` with:
```
bg-white shadow-[inset_0_1px_0_#f2f2f2]
```

Clean white footer, subtle inset shadow for the top edge.

**Step 3: Commit**

```bash
git add components/shared/header.tsx components/shared/footer.tsx && git commit -m "style: header/footer — subtle shadow, no heavy borders or blur"
```

---

### Task 18: Update Lake Map — Shadow Container

**Files:**
- Modify: `components/domain/lake-map.tsx`

**Step 1: Update iframe container**

Replace `rounded-sheet` on line 20 with `rounded-card shadow-sm`.

**Step 2: Commit**

```bash
git add components/domain/lake-map.tsx && git commit -m "style: lake map — shadow container"
```

---

### Task 19: Final Build Verification and Visual Review

**Step 1: Run full lint check**

Run: `cd bluvi-web && npx next lint`
Expected: No warnings.

**Step 2: Run TypeScript check**

Run: `cd bluvi-web && npx tsc --noEmit`
Expected: No errors.

**Step 3: Run full build**

Run: `cd bluvi-web && npm run build`
Expected: Build succeeds, all pages render.

**Step 4: Commit any remaining fixes**

```bash
git add -A && git commit -m "chore: final build verification — all clean"
```
