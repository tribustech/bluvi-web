import { auth } from "@/lib/auth";
import { safeStrapiGet } from "@/lib/strapi";
import { isOrganizerRole } from "@/lib/utils";
import { DashboardGreeting } from "@/components/domain/dashboard/dashboard-greeting";
import { DashboardQuickStats } from "@/components/domain/dashboard/dashboard-quick-stats";
import { MyCompetitionsSection } from "@/components/domain/dashboard/my-competitions-section";
import { NewsSection } from "@/components/domain/dashboard/news-section";
import { RecommendedLakesSection } from "@/components/domain/dashboard/recommended-lakes-section";
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
  const isOrganizer = isOrganizerRole(session?.user?.role?.name);
  const username = profile?.username || session?.user?.username || null;

  return (
    <div className="space-y-8">
      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <DashboardGreeting username={username} />
        <DashboardQuickStats
          competitionsCount={myCompetitions.length}
          phone={profile?.phone}
          isOrganizer={isOrganizer}
        />
      </section>

      <MyCompetitionsSection competitions={myCompetitions} />

      <section className="grid gap-8 lg:grid-cols-2">
        <RecommendedLakesSection lakes={lakes?.data ?? []} />
        <NewsSection articles={news?.data ?? []} />
      </section>
    </div>
  );
}
