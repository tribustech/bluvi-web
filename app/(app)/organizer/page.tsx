import Link from "next/link";
import { auth } from "@/lib/auth";
import { safeStrapiGet } from "@/lib/strapi";
import { CompetitionCard } from "@/components/domain/competition-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Competition, OrganizerDashboardStats } from "@/types";

export default async function OrganizerPage() {
  const session = await auth();
  const [dashboard, competitions] = await Promise.all([
    safeStrapiGet<OrganizerDashboardStats>("/competitions/organizer/dashboard", undefined, {
      token: session?.strapiJwt,
      revalidate: 60,
    }),
    safeStrapiGet<Competition[]>("/competitions/organizer/me", undefined, {
      token: session?.strapiJwt,
      revalidate: 60,
    }),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-7">Organizer dashboard</h1>
          <p className="mt-2 text-sm text-gray-5">
            Backend stats sunt consumate direct din Strapi cand endpoint-ul exista.
          </p>
        </div>
        <Button asChild>
          <Link href="/create-competition/basics">Creeaza competitie</Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Drafturi</CardTitle>
          </CardHeader>
          <CardContent>{dashboard?.draftsCount ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inscrieri in asteptare</CardTitle>
          </CardHeader>
          <CardContent>{dashboard?.pendingRegistrations ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Locuri libere</CardTitle>
          </CardHeader>
          <CardContent>{dashboard?.emptySpots ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fill rate</CardTitle>
          </CardHeader>
          <CardContent>{dashboard?.fillRate ?? 0}%</CardContent>
        </Card>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(competitions ?? []).map((competition) => (
          <CompetitionCard key={competition.documentId} competition={competition} />
        ))}
      </div>
    </div>
  );
}
