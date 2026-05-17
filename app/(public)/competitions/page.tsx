import type { Metadata } from "next";
import { CompetitionCard } from "@/components/domain/competition-card";
import { Pagination } from "@/components/ui/pagination";
import { Typography } from "@/components/ui/typography";
import { safeStrapiGet } from "@/lib/strapi";
import type { Competition, CompetitionStatus, StrapiPaginatedResponse } from "@/types";

export const metadata: Metadata = {
  title: "Competitii",
  description: "Lista competitiilor Bluvi, filtrata pentru SEO si descoperire.",
};

export default async function CompetitionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page || 1);
  const status = (typeof params.status === "string" ? params.status : "notStarted") as CompetitionStatus;

  const competitions =
    (await safeStrapiGet<StrapiPaginatedResponse<Competition>>(
      "/competitions",
      {
        "filters[competitionStatus][$eq]": status,
        "pagination[page]": page,
        "pagination[pageSize]": 9,
        sort: [status === "completed" ? "startDate:desc" : "startDate:asc"],
        populate: ["lake", "banner"],
      },
      { tags: ["competitions"], revalidate: 300 },
    )) ??
    ({
      data: [],
      meta: { pagination: { page: 1, pageSize: 9, total: 0, pageCount: 0 } },
    } satisfies StrapiPaginatedResponse<Competition>);

  const totalPages = Math.max(1, competitions.meta.pagination.pageCount ?? Math.ceil(competitions.meta.pagination.total / competitions.meta.pagination.pageSize));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Typography preset="heading1">Competitii Bluvi</Typography>
          <p className="mt-2 text-sm text-gray-5">Descopera competitii de pescuit din toata Romania.</p>
        </div>
        <div className="flex gap-2 rounded-button bg-indigo-1 p-1">
          {[
            { key: "notStarted", label: "Urmeaza" },
            { key: "started", label: "Live" },
            { key: "completed", label: "Finalizate" },
          ].map((item) => (
            <a
              key={item.key}
              href={`/competitions?status=${item.key}`}
              className={`rounded-button px-4 py-2 text-sm font-bold ${status === item.key ? "bg-white text-indigo-7 shadow-sm" : "text-gray-5"}`}
            >
              {item.label}
            </a>
          ))}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {competitions.data.map((competition) => (
          <CompetitionCard key={competition.documentId} competition={competition} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} createHref={(targetPage) => `/competitions?status=${status}&page=${targetPage}`} />
    </div>
  );
}
