import { auth } from "@/lib/auth";
import { safeStrapiGet } from "@/lib/strapi";
import { isOrganizerRole } from "@/lib/utils";
import { DashboardGreeting } from "@/components/domain/dashboard/dashboard-greeting";
import { DashboardQuickStats } from "@/components/domain/dashboard/dashboard-quick-stats";
import { LakesHomeCarousel } from "@/components/domain/dashboard/lakes-home-carousel";
import { LiveCompetitionCard } from "@/components/domain/dashboard/live-competition-card";
import { PollCard } from "@/components/domain/dashboard/poll-card";
import { MyCompetitionsSection } from "@/components/domain/dashboard/my-competitions-section";
import { NewsSection } from "@/components/domain/dashboard/news-section";
import { OrganizerBanner } from "@/components/domain/dashboard/organizer-banner";
import { ProfileCompletionNudge } from "@/components/domain/dashboard/profile-completion-nudge";
import { SponsorsStrip } from "@/components/domain/dashboard/sponsors-strip";
import type { Competition, NewsArticle, Profile, StrapiPaginatedResponse } from "@/types";

export default async function DashboardPage() {
  const session = await auth();
  const token = session?.strapiJwt;

  const [profile, competitions, news] = await Promise.all([
    safeStrapiGet<Profile>("/user/profile", undefined, { token }),
    safeStrapiGet<{ data: Competition[] }>("/competitions/me", undefined, { token }),
    safeStrapiGet<StrapiPaginatedResponse<NewsArticle>>(
      "/announcements",
      { "pagination[pageSize]": 4, sort: "createdAt:desc", populate: ["banner"] },
      { tags: ["news"], revalidate: 300 },
    ),
  ]);

  const myCompetitions = competitions?.data ?? [];
  const isOrganizer = isOrganizerRole(session?.user?.role?.name);
  const username = profile?.username || session?.user?.username || null;

  return (
    <div className="space-y-6">
      <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <DashboardGreeting username={username} />
        <DashboardQuickStats
          competitionsCount={myCompetitions.length}
          phone={profile?.phone}
          isOrganizer={isOrganizer}
        />
      </section>

      <OrganizerBanner isOrganizer={isOrganizer} />
      <ProfileCompletionNudge profile={profile} />

      <LiveCompetitionCard />

      <MyCompetitionsSection competitions={myCompetitions} />

      <LakesHomeCarousel />

      <PollCard />

      <SponsorsStrip />

      <NewsSection articles={news?.data ?? []} />
    </div>
  );
}
