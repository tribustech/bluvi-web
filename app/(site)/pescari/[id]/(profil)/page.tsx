import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { HydrationBoundary } from '@tanstack/react-query';
import { AnglerProfileView } from '@/components/account/angler/AnglerProfileView';
import { parseProfileTab } from '@/components/account/angler/tabs';
import { param, type SearchParams } from '@/lib/search-params';
import { jsonLdHtml } from '@/lib/json-ld';
import { absoluteUrl, routes } from '@/lib/routes';
import { AnglerProfileFallback } from '../_components/AnglerProfileFallback';
import { e2eThrowProfile } from '../_components/e2e-faults';
import { prefetchProfileTab } from '../_components/prefetch';
import { loadAnglerPublic } from '../_components/public-profile';
import { anglerDescription, anglerJsonLd } from '../_components/seo';

/*
 * Profil pescar — fish app/(app)/anglers/[documentId]/index.tsx → AnglerProfileScreen (parity
 * account.angler-profile, T3; legacy /anglers/<id> 308s here, next.config.ts).
 *
 * What the server renders: the selected tab's first page (`?tab=`, Capturi by default) — a cached
 * PUBLIC read (./_components/prefetch.ts) handed to the client view through HydrationBoundary, so
 * the catches / sessions / competitions are in the HTML — and the PUBLIC header
 * (GET /feed/anglers/:id/public, CMS PR #113; ../_components/public-profile.ts): name, avatar,
 * counts, bio, trophies, for guests and crawlers alike. The per-viewer bits (the follow state,
 * «Editează profilul» on your own page) come from GET /feed/anglers/:id in the browser through
 * /api/cms with the session cookie. An unknown id answers 404 ANGLER:NOT_FOUND → notFound().
 *
 * A CMS without the public route (before PR #113 is deployed) answers a bare 404: the page then
 * keeps its earlier behaviour — the header read in the browser only, signed out a sign-in hint in
 * its slot and the public tabs (web deviation from fish's redirect, the parity entry's c1 web_note).
 *
 * The page, its loading.tsx and error.tsx sit in the (profil) route group so they wrap this page
 * only: /pescari/[id]/conexiuni keeps its own skeleton and error (M8 follow-up).
 *
 * SEO (owner decision 2026-10-10: angler profiles are public): with the public header the page is
 * `index, follow`, titled «{nume} — pescar pe Bluvi», with JSON-LD ProfilePage + Person, the angler
 * OG card (opengraph-image.tsx) and a sitemap entry (lib/server/sitemap-entries.ts anglerEntries).
 * Without it (old CMS, failed read): `noindex, follow`, no JSON-LD, the brand card.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export const instant = false;

export async function generateStaticParams() {
  // No list of anglers to prerender: one placeholder for Cache Components' build validation; every
  // real id renders on request (its reads cached under the CMS tags).
  return [{ id: '_' }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const canonical = routes.angler(id);
  const pub = await loadAnglerPublic(id);
  if (pub.kind === 'missing') return { title: 'Pescarul nu a fost găsit', robots: { index: false, follow: true } };
  if (pub.kind === 'ok') {
    const p = pub.profile;
    const title = `${p.username} — pescar pe Bluvi`;
    const description = anglerDescription(p);
    return {
      title: { absolute: title },
      description,
      alternates: { canonical },
      robots: { index: true, follow: true },
      openGraph: { type: 'profile', title, description, url: absoluteUrl(canonical), siteName: 'Bluvi', locale: 'ro_RO', username: p.username },
      twitter: { card: 'summary_large_image', title, description },
    };
  }
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
  const [pub, state] = await Promise.all([loadAnglerPublic(id), prefetchProfileTab(id, tab)]);
  if (pub.kind === 'missing') notFound();
  const publicProfile = pub.kind === 'ok' ? pub.profile : null;
  return (
    <>
      {publicProfile ? (
        <script
          type="application/ld+json"
          // JSON-LD: `<` escaped so a username or bio can never close the script element.
          dangerouslySetInnerHTML={jsonLdHtml(anglerJsonLd(publicProfile))}
        />
      ) : null}
      <HydrationBoundary state={state}>
        <AnglerProfileView documentId={id} mode="other" initialTab={tab} publicProfile={publicProfile} />
      </HydrationBoundary>
    </>
  );
}
