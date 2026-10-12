import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BreadcrumbBand, type Crumb } from '@/components/nav/Breadcrumbs';
import { PROSE_MAX } from '@/components/nav/shell';
import { JsonLd } from '@/components/seo/JsonLd';
import { ListHeader, ListPage, filterChipClass } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { blurDataUrl } from '@/lib/blurhash';
import { lakesCount, type Landing, type LandingGroup, type LandingLake } from '@/lib/lake-landing';
import { absoluteUrl, routes } from '@/lib/routes';
import { LAKE_GRID, LakeGridCard } from '../_list/LakeGridCard';
import { lakeImage } from '../_list/lakeImage';

/*
 * The frame of the lakes' SEO landing pages (lib/lake-landing.ts): the T1 list page (ListPage +
 * ListHeader: the page's one h1, the count under it, a back square to the parent hub), the
 * server-rendered breadcrumb band with its BreadcrumbList (SiteHeader OWN_BAND_ROUTES lists these
 * routes), a data-driven intro, the Bălți grid (LakeGridCard on LAKE_GRID) and plain, crawlable
 * links to the neighbouring pages. JSON-LD: CollectionPage whose mainEntity is the ItemList of the
 * lakes shown (position, url, name).
 */

export const LAKES_CRUMB: Crumb = { label: 'Bălți', href: routes.lakes() };
export const HOME_CRUMB: Crumb = { label: 'Acasă', href: routes.home() };
export const COUNTIES_CRUMB: Crumb = { label: 'Județe', href: routes.lakesCounties() };
export const SPECIES_CRUMB: Crumb = { label: 'Specii', href: routes.lakesSpeciesHub() };

/** Title, description, canonical, Open Graph and Twitter of a landing page (the /balti pattern). */
export function landingMetadata({ title, description, path }: { title: string; description: string; path: string }): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type: 'website', url: absoluteUrl(path), siteName: 'Bluvi', locale: 'ro_RO', title, description },
    twitter: { card: 'summary_large_image', title, description },
  };
}

function CollectionJsonLd({ name, description, path, items }: { name: string; description: string; path: string; items: { name: string; path: string }[] }) {
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name,
        description,
        url: absoluteUrl(path),
        inLanguage: 'ro-RO',
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: items.length,
          itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: absoluteUrl(it.path), name: it.name })),
        },
      }}
    />
  );
}

/** A titled row of link chips (h2 + plain links). Nothing when there is no link. */
export function LinkSection({ title, links, more }: { title: string; links: { href: string; label: string; count?: number }[]; more?: { href: string; label: string } }) {
  if (!links.length) return null;
  return (
    <section className="flex flex-col gap-3">
      <h2 className="t-title2 text-ink">{title}</h2>
      <ul className="flex flex-wrap gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className={filterChipClass()}>
              {l.label}
              {l.count !== undefined ? <span className="text-muted">{l.count}</span> : null}
            </Link>
          </li>
        ))}
        {more ? (
          <li>
            <Link href={more.href} className={cn(filterChipClass(), 'text-accent-ink')}>
              {more.label}
            </Link>
          </li>
        ) : null}
      </ul>
    </section>
  );
}

/** The feature pages as chips (every landing page links them). */
export function featureLinks(landing: Landing, except?: string) {
  return landing.features.filter((f) => f.slug !== except).map((f) => ({ href: routes.lakesFeature(f.slug), label: f.name, count: f.lakes.length }));
}

/** A lake collection page: county, species or feature. */
export function LakeCollectionPage({
  title,
  description,
  intro,
  path,
  trail,
  back,
  lakes,
  children,
}: {
  /** The h1 (and the JSON-LD name). */
  title: string;
  /** The meta description (JSON-LD description). */
  description: string;
  intro: string;
  path: string;
  /** The breadcrumb trail, the page itself last (without href). */
  trail: Crumb[];
  back: { href: string; label: string };
  lakes: LandingLake[];
  /** The link sections under the grid. */
  children?: ReactNode;
}) {
  return (
    <>
      <BreadcrumbBand trail={trail} jsonLd />
      <CollectionJsonLd name={title} description={description} path={path} items={lakes.map((l) => ({ name: l.name, path: routes.lake(l.documentId) }))} />
      <ListPage header={<ListHeader title={title} description={lakesCount(lakes.length)} back={back} />}>
        <p className={cn('t-body text-ink-2 text-pretty', PROSE_MAX)}>{intro}</p>
        <ul className={cn(LAKE_GRID, 'mt-6 md:mt-8')} aria-label={title}>
          {lakes.map((lake, i) => (
            <li key={lake.documentId} className="min-w-0">
              <LakeGridCard lake={lake} priority={i < 2 ? 'all' : undefined} />
            </li>
          ))}
        </ul>
        {children ? <div className="mt-12 flex flex-col gap-8 md:mt-16">{children}</div> : null}
      </ListPage>
    </>
  );
}

/** A hub tile: the group's first lake photo, its name and its lake count; the whole tile links. */
function GroupTile({ group, href, alt, priority }: { group: LandingGroup; href: string; alt: string; priority?: boolean }) {
  const lead = group.lakes[0];
  const image = lead ? lakeImage(lead) : null;
  return (
    <li className="min-w-0">
      <Link href={href} className="group flex flex-col gap-2.5 rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <div className="relative aspect-4/3 overflow-hidden rounded-card bg-soft-fill">
          {image ? (
            <Image
              src={image.src}
              alt={alt}
              fill
              sizes="(min-width: 1280px) 300px, (min-width: 768px) 33vw, 50vw"
              className="object-cover transition-transform duration-(--duration-medium) group-hover:scale-[1.03]"
              {...(priority ? { loading: 'eager' as const, fetchPriority: 'high' as const } : {})}
              {...(image.blurhash ? { placeholder: 'blur' as const, blurDataURL: blurDataUrl(image.blurhash) } : {})}
            />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="line-clamp-1 t-body-strong text-ink group-hover:underline">{group.name}</span>
          <span className="t-body text-ink-2">{lakesCount(group.lakes.length)}</span>
        </div>
      </Link>
    </li>
  );
}

/** A hub page: every county or every species with its lake count. */
export function LandingHubPage({
  title,
  description,
  summary,
  intro,
  path,
  trail,
  groups,
  hrefOf,
  altOf,
  children,
}: {
  title: string;
  description: string;
  /** The caption under the h1 («36 de județe · 201 de bălți»). */
  summary: string;
  intro: string;
  path: string;
  trail: Crumb[];
  groups: LandingGroup[];
  hrefOf: (slug: string) => string;
  altOf: (g: LandingGroup) => string;
  children?: ReactNode;
}) {
  return (
    <>
      <BreadcrumbBand trail={trail} jsonLd />
      <CollectionJsonLd name={title} description={description} path={path} items={groups.map((g) => ({ name: g.name, path: hrefOf(g.slug) }))} />
      <ListPage header={<ListHeader title={title} description={summary} back={{ href: routes.lakes(), label: 'Înapoi la bălți' }} />}>
        <p className={cn('t-body text-ink-2 text-pretty', PROSE_MAX)}>{intro}</p>
        <ul className={cn(LAKE_GRID, 'mt-6 md:mt-8')} aria-label={title}>
          {groups.map((g, i) => (
            <GroupTile key={g.slug} group={g} href={hrefOf(g.slug)} alt={altOf(g)} priority={i < 2} />
          ))}
        </ul>
        {children ? <div className="mt-12 flex flex-col gap-8 md:mt-16">{children}</div> : null}
      </ListPage>
    </>
  );
}
