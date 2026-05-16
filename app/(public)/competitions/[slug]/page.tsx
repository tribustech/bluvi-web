import type { Metadata } from "next";
import Image from "next/image";
import { competitionEventJsonLd } from "@/lib/structured-data";
import { CompetitionInfo } from "@/components/domain/competition-info";
import { ExtraScales } from "@/components/domain/extra-scales";
import { ParticipantsList } from "@/components/domain/participants-list";
import { RankingTable } from "@/components/domain/ranking-table";
import { RegistrationForm } from "@/components/domain/registration-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { auth } from "@/lib/auth";
import { safeStrapiGet } from "@/lib/strapi";
import { formatDate, resolveMediaUrl } from "@/lib/utils";
import type { Competition, RankingResponse } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competition = await safeStrapiGet<{ data: Competition }>(
    `/competitions/${slug}`,
    { populate: ["banner"] },
    { tags: ["competitions"], revalidate: 300 },
  );
  const data = competition?.data;

  return {
    title: data?.name || "Competitie",
    description: data?.name ? `Competitia ${data.name} pe platforma Bluvi.` : "Detalii competitie Bluvi.",
    openGraph: {
      images: data?.banner?.url ? [{ url: resolveMediaUrl(data.banner.url) as string }] : [],
    },
  };
}

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();
  const competitionResult = await safeStrapiGet<{ data: Competition }>(
    `/competitions/${slug}`,
    {
      populate: ["lake", "banner", "sponsors.logo", "registrations.participants", "author.avatar"],
    },
    { token: session?.strapiJwt, tags: ["competitions"], revalidate: 300 },
  );
  const ranking = await safeStrapiGet<RankingResponse>(`/rankings/competition/${slug}`, undefined, {
    token: session?.strapiJwt,
    tags: ["competitions"],
    revalidate: 60,
  });
  const extraScales = await safeStrapiGet<unknown[]>(`/competitions/${slug}/extra-scale`, undefined, {
    token: session?.strapiJwt,
    revalidate: 60,
  });
  const competition = competitionResult?.data;

  if (!competition) {
    return <div className="rounded-card border border-dashed border-gray-2 bg-white p-8 text-sm text-gray-5">Competitia nu a fost gasita.</div>;
  }

  return (
    <div className="space-y-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(competitionEventJsonLd(competition)) }} />
      <div className="overflow-hidden rounded-sheet bg-white shadow-card">
        <div className="relative h-72 w-full">
          <Image
            src={resolveMediaUrl(competition.banner?.url) || "/logo.svg"}
            alt={competition.name}
            fill
            className="object-cover"
          />
        </div>
        <div className="grid gap-6 p-6 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-3xl font-bold text-gray-7">{competition.name}</h1>
            <p className="mt-3 text-sm text-gray-5">
              {formatDate(competition.startDate)} - {formatDate(competition.endDate)} la {competition.lake?.name || "locatie Bluvi"}
            </p>
          </div>
          <div className="rounded-card bg-indigo-1 p-5">
            <p className="text-sm font-bold text-indigo-7">Taxa</p>
            <p className="mt-2 text-2xl font-bold text-gray-7">{competition.registerFee} lei</p>
            <p className="mt-2 text-sm text-gray-5">
              {competition.participantsRegistered ?? 0}/{competition.participantsLimit ?? "-"} locuri ocupate
            </p>
          </div>
        </div>
      </div>

      {session ? (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <CompetitionInfo competition={competition} />
          <div className="space-y-4">
            <RegistrationForm competitionId={competition.documentId} />
            <ExtraScales requestedCount={extraScales?.length ?? 0} />
          </div>
        </div>
      ) : null}

      <Tabs defaultValue={session ? "rankings" : "info"}>
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="rankings">Clasamente</TabsTrigger>
          <TabsTrigger value="participants">Participanti</TabsTrigger>
          <TabsTrigger value="rules">Regulament</TabsTrigger>
        </TabsList>
        <TabsContent value="info">
          <CompetitionInfo competition={competition} />
        </TabsContent>
        <TabsContent value="rankings">
          <RankingTable ranking={ranking} />
        </TabsContent>
        <TabsContent value="participants">
          <ParticipantsList registrations={competition.registrations ?? []} />
        </TabsContent>
        <TabsContent value="rules">
          <CompetitionInfo competition={{ ...competition, description: competition.regulation, reward: null }} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
