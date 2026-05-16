import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CompetitionCard } from "@/components/domain/competition-card";
import { safeStrapiGet } from "@/lib/strapi";
import type { Competition, CompetitionStatus, StrapiPaginatedResponse } from "@/types";

interface CompetitionsHorizontalSectionProps {
  status: CompetitionStatus;
  title: string;
  ctaHref?: string;
  ctaLabel?: string;
  pageSize?: number;
}

export async function CompetitionsHorizontalSection({
  status,
  title,
  ctaHref,
  ctaLabel = "Vezi toate",
  pageSize = 6,
}: CompetitionsHorizontalSectionProps) {
  const response = await safeStrapiGet<StrapiPaginatedResponse<Competition>>(
    "/competitions",
    {
      "filters[competitionStatus][$eq]": status,
      "pagination[pageSize]": pageSize,
      sort: status === "completed" ? "startDate:desc" : "startDate:asc",
      populate: ["lake", "banner"],
    },
    { tags: ["competitions"], revalidate: 120 },
  );

  const competitions = response?.data ?? [];
  if (!competitions.length) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-2xl font-bold text-gray-7">{title}</h2>
        {ctaHref ? (
          <Link
            href={ctaHref}
            className="flex items-center gap-1 text-sm font-bold text-indigo-7 hover:text-indigo-5"
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {competitions.map((competition) => (
          <div key={competition.documentId} className="w-[300px] shrink-0 md:w-[340px]">
            <CompetitionCard competition={competition} />
          </div>
        ))}
      </div>
    </section>
  );
}
