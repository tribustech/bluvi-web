import Link from "next/link";
import { Scale, ChevronRight, Layers } from "lucide-react";
import { auth } from "@/lib/auth";
import { safeStrapiGet } from "@/lib/strapi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Competition } from "@/types";

export default async function ScaleCompetitionPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  const session = await auth();
  const competition = await safeStrapiGet<{ data: Competition }>(
    `/competitions/${competitionId}`,
    { populate: ["sectors.stands", "lake"] },
    { token: session?.strapiJwt, revalidate: 30 },
  );

  const sectors = competition?.data.sectors ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-7">
          <Scale className="mr-2 inline h-6 w-6 text-indigo-5" />
          Cantarire
        </h1>
        {competition?.data.name && (
          <p className="mt-1 text-sm text-gray-5">{competition.data.name} — {competition.data.lake?.name}</p>
        )}
      </div>

      {sectors.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-sheet border border-dashed border-gray-2 bg-white p-12 text-center">
          <Layers className="h-12 w-12 text-gray-2" />
          <p className="text-sm text-gray-5">Nu exista standuri configurate pentru aceasta competitie.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sectors.map((sector) => (
            <Card key={sector.documentId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-5 w-5 text-indigo-5" />
                  {sector.name}
                  <Badge variant="indigo">{sector.stands?.length ?? 0} standuri</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {(sector.stands ?? []).map((stand) => (
                  <Link
                    key={stand.documentId}
                    href={`/scale/${competitionId}/${stand.documentId}`}
                    className="group flex items-center justify-between rounded-card border border-gray-2 bg-white p-4 transition hover:border-indigo-4 hover:bg-indigo-1 hover:shadow-card"
                  >
                    <div>
                      <p className="font-bold text-gray-7 group-hover:text-indigo-7">{stand.name}</p>
                      <p className="text-xs text-gray-5">{sector.name}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-5 transition group-hover:text-indigo-5" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
