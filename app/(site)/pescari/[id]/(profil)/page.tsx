import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { AnglerProfileView } from '@/components/account/angler/AnglerProfileView';
import { parseProfileTab } from '@/components/account/angler/tabs';
import { param, type SearchParams } from '@/lib/search-params';
import { routes } from '@/lib/routes';
import { AnglerProfileFallback } from '../_components/AnglerProfileFallback';
import { e2eThrowProfile } from '../_components/e2e-faults';
import { prefetchProfileTab } from '../_components/prefetch';

/*
 * Profil pescar — fish app/(app)/anglers/[documentId]/index.tsx → AnglerProfileScreen (parity
 * account.angler-profile, T3; legacy /anglers/<id> 308s here, next.config.ts).
 *
 * What the server renders: the selected tab's first page (`?tab=`, Capturi by default) — a cached
 * PUBLIC read (./_components/prefetch.ts) handed to the client view through HydrationBoundary, so
 * the catches / sessions / competitions are in the HTML. The header (name, counts, follow) is
 * per viewer: GET /feed/anglers/:id answers 401 without a session, so it loads in the browser
 * through /api/cms with the session cookie; an unknown id answers 404 ANGLER:NOT_FOUND there →
 * notFound() (not-found.tsx). Signed out the header slot is a sign-in hint and the public tabs
 * stay (web deviation from fish's redirect, documented in the parity entry's c1 web_note).
 *
 * The page, its loading.tsx and error.tsx sit in the (profil) route group so they wrap this page
 * only: /pescari/[id]/conexiuni keeps its own skeleton and error (M8 follow-up).
 *
 * SEO: until the CMS serves a public header (docs/private/cms-patches/M2-angler-public-profile.md)
 * the page has no name to show a crawler: `noindex, follow`, no JSON-LD, not in the sitemap, and
 * the brand card as its share image (opengraph-image.tsx).
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export const instant = false;

export async function generateStaticParams() {
  // No list of anglers to prerender (and nothing to index yet): one placeholder for Cache
  // Components' build validation; every real id renders on request.
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const canonical = routes.angler(id);
  const title = 'Profil de pescar';
  const description = 'Capturile, partidele și concursurile unui pescar pe Bluvi.';
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: { type: 'profile', title, description, url: canonical, siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function AnglerPage({ params, searchParams }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<AnglerProfileFallback />}>
      <Profile id={id} searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({ id, searchParams }: { id: string; searchParams: Props['searchParams'] }) {
  const tab = parseProfileTab(param(await searchParams, 'tab'));
  await e2eThrowProfile();
  const state = await prefetchProfileTab(id, tab);
  return (
    <HydrationBoundary state={state}>
      <AnglerProfileView documentId={id} mode="other" initialTab={tab} />
    </HydrationBoundary>
  );
}
