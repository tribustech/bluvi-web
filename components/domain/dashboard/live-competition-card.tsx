"use client";

import Link from "next/link";
import { ArrowRight, Radio, Scale } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLiveCompetition } from "@/services/queries/use-competitions";
import type { ExtraScaleRequest, LiveCompetition } from "@/types";

const MAX_PREVIEW_REQUESTS = 3;

function formatStandLabel(request: ExtraScaleRequest, isNc: boolean) {
  const sectorName = request.stand.sectors[0]?.name ?? "";
  const standName = request.stand.name ?? "";

  if (isNc) {
    const draw = request.stand.sectorDrawPosition;
    return [sectorName, draw, standName].filter(Boolean).join(" / ");
  }

  return `${sectorName}${standName}`;
}

function LiveCard({ liveCompetition }: { liveCompetition: LiveCompetition }) {
  const isNc = liveCompetition.competition.rankingType === "nationalChampionship";
  const extraScales = liveCompetition["extra-scales"] ?? [];
  const pendingRequests = extraScales.filter((request) => request.extraStatus === "new");
  const visiblePreview = pendingRequests.slice(0, MAX_PREVIEW_REQUESTS);

  return (
    <Card className="border-l-4 border-l-red-5">
      <CardContent className="space-y-4 py-5">
        <Link
          href={`/competitions/${liveCompetition.competition.documentId}`}
          className="flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 rounded-full bg-red-5 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-white">
              <Radio className="h-3 w-3 animate-pulse" />
              Live
            </span>
            <p className="text-lg font-bold text-gray-7">{liveCompetition.competition.name}</p>
          </div>
          <ArrowRight className="h-5 w-5 text-gray-5" />
        </Link>

        {pendingRequests.length > 0 ? (
          <div className="rounded-card bg-gray-1 p-3">
            <div className="flex items-center gap-2 text-sm font-bold text-gray-7">
              <Scale className="h-4 w-4 text-indigo-5" />
              <span>Solicitari cantar extra ({pendingRequests.length})</span>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm text-gray-7">
              {visiblePreview.map((request) => (
                <li key={request.documentId} className="flex items-center justify-between gap-2">
                  <span className="truncate">
                    Stand {formatStandLabel(request, isNc)}
                    {request.author?.username ? (
                      <span className="text-gray-5"> &mdash; {request.author.username}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {pendingRequests.length > MAX_PREVIEW_REQUESTS ? (
              <p className="mt-2 text-xs text-gray-5">
                +{pendingRequests.length - MAX_PREVIEW_REQUESTS} alte solicitari
              </p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function LiveCompetitionCard() {
  const { data: liveCompetition, isLoading } = useLiveCompetition();

  if (isLoading) return null;
  if (!liveCompetition?.competition?.documentId) return null;

  return <LiveCard liveCompetition={liveCompetition} />;
}
