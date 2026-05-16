import Link from "next/link";
import { auth } from "@/lib/auth";
import { safeStrapiGet } from "@/lib/strapi";
import { isOrganizerRole } from "@/lib/utils";
import { CompetitionCard } from "@/components/domain/competition-card";
import { LakeCard } from "@/components/domain/lake-card";
import { NewsCard } from "@/components/domain/news-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Competition, Lake, NewsArticle, Profile, StrapiPaginatedResponse } from "@/types";

export default async function DashboardPage() {
  const session = await auth();
  const token = session?.strapiJwt;
  const [profile, competitions, lakes, news] = await Promise.all([
    safeStrapiGet<Profile>("/user/profile", undefined, { token }),
    safeStrapiGet<{ data: Competition[] }>("/competitions/me", undefined, { token }),
    safeStrapiGet<StrapiPaginatedResponse<Lake>>(
      "/lakes",
      { "pagination[pageSize]": 3, sort: "updatedAt:desc", populate: ["images", "fishSpecies.fish"] },
      { tags: ["lakes"], revalidate: 300 },
    ),
    safeStrapiGet<StrapiPaginatedResponse<NewsArticle>>(
      "/announcements",
      { "pagination[pageSize]": 2, sort: "createdAt:desc", populate: ["banner"] },
      { tags: ["news"], revalidate: 300 },
    ),
  ]);

  const myCompetitions = competitions?.data ?? [];
  const organizer = isOrganizerRole(session?.user?.role?.name);

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Bine ai revenit, {profile?.username || session?.user?.username || "pescar"}.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-5">
            <p>Dashboard-ul combina recomandari publice cu datele private din contul tau Strapi.</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/competitions">Vezi competitii</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/profile">Editeaza profilul</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sumar rapid</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-card bg-indigo-1 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-7">Competitii</p>
              <p className="mt-2 text-2xl font-bold text-gray-7">{myCompetitions.length}</p>
            </div>
            <div className="rounded-card bg-white p-4 ring-1 ring-gray-2">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-5">Telefon</p>
              <p className="mt-2 text-sm text-gray-7">{profile?.phone || "Necompletat"}</p>
            </div>
            {organizer ? (
              <div className="rounded-card bg-green-2 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-7">Organizer mode</p>
                <p className="mt-2 text-sm text-gray-7">Ai acces la dashboard-ul de organizator.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {myCompetitions.length ? (
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-7">Competitiile tale</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {myCompetitions.map((competition) => (
              <CompetitionCard key={competition.documentId} competition={competition} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-7">Balti recomandate</h2>
          {(lakes?.data ?? []).map((lake) => (
            <LakeCard key={lake.documentId} lake={lake} />
          ))}
        </div>
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-7">Noutati recente</h2>
          {(news?.data ?? []).map((article) => (
            <NewsCard key={article.documentId} article={article} />
          ))}
        </div>
      </section>
    </div>
  );
}
