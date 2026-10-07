import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import { DetailBackButton } from '@/components/templates/T3';
import { absoluteUrl, routes } from '@/lib/routes';
import { ArticleFrame, AsideSkeleton } from '../../stiri/_content/ArticleFrame';
import { plainText, sponsorImage } from '../../stiri/_content/content';
import { HOME_CRUMB } from '../../stiri/_content/crumbs';
import { Gallery } from '../../stiri/_content/Gallery';
import { fillsFrame, ratioOf } from '../../stiri/_content/imageSize';
import { JsonLd } from '@/components/seo/JsonLd';
import { loadSponsor, sponsorIds } from '../../stiri/_content/load';
import { withSizes } from '../../stiri/_content/probe';
import { RichText } from '../../stiri/_content/RichText';
import { OtherSponsorsSlot } from '../_content/OtherSponsors';

/*
 * Sponsor — fish app/(app)/sponsors/[sponsorId].tsx (parity home.sponsor), the article frame of
 * Știre (ScreenWithFakeSheet on the T3 tracks). Reached from Acasă's «Sponsori».
 *
 * Static per sponsor: /feed/sponsors/:id is a cached public read (CDN 1 day, tag `sponsor-<id>`,
 * purged by the CMS on a sponsor write); the sponsors are prerendered (generateStaticParams).
 * Loading: loading.tsx; an unknown id: notFound() → not-found.tsx (soft 404 + noindex); a network /
 * 5xx / timeout error: error.tsx («Încearcă din nou» + back).
 *
 * The header picture is the sponsor's image (large → original, fish) in a 224 / 192 / 224 band
 * (Gallery `sponsor`): landscape artwork (4:3 – 2:1, its size read on the server) fills the phone
 * band as in fish and sits at full band height over its blurred self from 768; a logo is contained
 * on white with 24px of air (64 at the phone's sides, clear of the back chip) — fish's cover crop
 * would cut its edges. No image: the grey header (phone). The name is the page title, ≤ 24px under
 * the band; the description is the rich text (nothing when empty); its links carry
 * sponsor_link_clicked { sponsor_id, sponsor_name, url }. The breadcrumb band (Acasă / name) is
 * the page's own, on the server (SiteHeader OWN_BAND_ROUTES).
 */

type Props = { params: Promise<{ id: string }> };

export const instant = false;

export async function generateStaticParams() {
  const ids = await sponsorIds();
  return (ids.length ? ids : ['_']).map((id) => ({ id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const load = await loadSponsor(id);
  if (load.kind === 'missing') return { title: 'Sponsorul nu a fost găsit' };
  const s = load.data;
  const canonical = routes.sponsor(s.documentId);
  const description = plainText(s.description) || `${s.name}, sponsor Bluvi — aplicația pescarilor din România.`;
  // No image keys: the route's generated opengraph-image / twitter-image provide it (global.seo-og).
  return {
    title: `${s.name} · Sponsor`,
    description,
    alternates: { canonical },
    openGraph: { type: 'website', title: s.name, description, url: absoluteUrl(canonical), siteName: 'Bluvi', locale: 'ro_RO' },
    twitter: { card: 'summary_large_image', title: s.name, description },
  };
}

export default async function SponsorPage({ params }: Props) {
  const { id } = await params;
  // Only the sponsor is awaited: «Alți sponsori» streams in its own slot (OtherSponsorsSlot).
  const load = await loadSponsor(id);
  if (load.kind === 'missing') notFound();
  const s = load.data;
  const image = sponsorImage(s.image);
  const [sized] = image ? await withSizes([image]) : [];
  const titleId = 'sponsor-titlu';
  const description = plainText(s.description, 300);

  return (
    <>
      {/* The page's own band, on the server: the real name in the HTML + BreadcrumbList JSON-LD. */}
      <BreadcrumbBand trail={[HOME_CRUMB, { label: s.name, href: routes.sponsor(s.documentId) }]} jsonLd />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: s.name,
          url: s.url || absoluteUrl(routes.sponsor(s.documentId)),
          ...(image ? { logo: image.src } : {}),
          ...(description ? { description } : {}),
        }}
      />
      <ArticleFrame
        titleId={titleId}
        hero={
          <Gallery
            images={sized ? [sized] : []}
            label={`Imagine: ${s.name}`}
            variant="sponsor"
            sizes="(min-width: 1440px) 1000px, (min-width: 1280px) 880px, (min-width: 768px) 720px, 100vw"
            back={<DetailBackButton fallbackHref={routes.home()} ground={sized && fillsFrame(ratioOf(sized)) ? 'photo' : 'page'} />}
          />
        }
        aside={
          <Suspense fallback={<AsideSkeleton variant="tiles" />}>
            <OtherSponsorsSlot currentId={s.documentId} />
          </Suspense>
        }
        asideLabel="Alți sponsori"
      >
        <h1 id={titleId} className="t-title1 text-pretty text-ink md:t-page-title">
          {s.name}
        </h1>
        <RichText
          blocks={s.description}
          tracking={{ event: 'sponsor_link_clicked', params: { sponsor_id: s.documentId, sponsor_name: s.name } }}
        />
      </ArticleFrame>
    </>
  );
}
