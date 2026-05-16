import type { Metadata } from "next";
import Image from "next/image";
import { articleJsonLd } from "@/lib/structured-data";
import { renderRichText } from "@/lib/content";
import { safeStrapiGet } from "@/lib/strapi";
import { resolveMediaUrl, formatDate } from "@/lib/utils";
import type { NewsArticle } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await safeStrapiGet<{ data: NewsArticle }>(
    `/announcements/${slug}`,
    { populate: ["banner"] },
    { tags: ["news"] },
  );
  const data = article?.data;

  return {
    title: data?.title || "Articol",
    description: data?.excerpt || "Articol Bluvi.",
    openGraph: {
      images: data?.banner?.url ? [{ url: resolveMediaUrl(data.banner.url) as string }] : [],
    },
  };
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const articleResult = await safeStrapiGet<{ data: NewsArticle }>(
    `/announcements/${slug}`,
    {
      populate: ["banner", "content"],
    },
    { tags: ["news"], revalidate: 300 },
  );
  const article = articleResult?.data;

  if (!article) {
    return <div className="rounded-card border border-dashed border-gray-2 bg-white p-8 text-sm text-gray-5">Articolul nu a fost gasit.</div>;
  }

  return (
    <article className="mx-auto max-w-4xl space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(article)) }} />
      <div className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-indigo-5">
          {article.createdAt ? formatDate(article.createdAt) : "Bluvi"}
        </p>
        <h1 className="text-4xl font-bold text-gray-7">{article.title}</h1>
        <p className="text-lg text-gray-5">{article.excerpt}</p>
      </div>
      <div className="relative h-[420px] overflow-hidden rounded-sheet bg-white shadow-card">
        <Image
          src={resolveMediaUrl(article.banner?.url) || "/logo.svg"}
          alt={article.title}
          fill
          className="object-cover"
        />
      </div>
      <div className="prose-bluvi rounded-card bg-white p-8">{renderRichText(article.content)}</div>
    </article>
  );
}
