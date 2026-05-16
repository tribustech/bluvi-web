import Link from "next/link";
import { ArrowRight, ChevronRight, Trophy } from "lucide-react";
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
