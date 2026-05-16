import type { Metadata } from "next";
import { LakeCard } from "@/components/domain/lake-card";
import { Pagination } from "@/components/ui/pagination";
import { Typography } from "@/components/ui/typography";
import { safeStrapiGet } from "@/lib/strapi";
import type { Lake, StrapiPaginatedResponse } from "@/types";

export const metadata: Metadata = {
  title: "Balti",
  description: "Catalogul baltilor Bluvi.",
};

export default async function LakesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = Number(params.page || 1);
  const q = typeof params.q === "string" ? params.q : "";

  const lakes =
    (await safeStrapiGet<StrapiPaginatedResponse<Lake>>(
      "/lakes",
      {
        "pagination[page]": page,
        "pagination[pageSize]": 9,
        "filters[$or][0][name][$containsi]": q,
        "filters[$or][1][address][$containsi]": q,
        populate: ["images", "facility", "fishSpecies.fish"],
        sort: "updatedAt:desc",
      },
      { tags: ["lakes"], revalidate: 300 },
    )) ??
    ({
      data: [],
      meta: { pagination: { page: 1, pageSize: 9, total: 0, pageCount: 0 } },
    } satisfies StrapiPaginatedResponse<Lake>);

  const totalPages = Math.max(1, lakes.meta.pagination.pageCount ?? Math.ceil(lakes.meta.pagination.total / lakes.meta.pagination.pageSize));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Typography preset="heading1">Balti Bluvi</Typography>
          <p className="mt-2 text-sm text-gray-5">Exploreaza baltile disponibile pe platforma Bluvi.</p>
        </div>
        <form className="flex gap-2">
          <input
            defaultValue={q}
            name="q"
            placeholder="Cauta dupa nume sau adresa"
            className="h-10 rounded-card border border-gray-2 bg-white px-4 text-sm text-gray-7 placeholder:text-gray-5 focus:border-indigo-4 focus:outline-none focus:ring-2 focus:ring-indigo-1"
          />
          <button className="rounded-card bg-indigo-5 px-5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(99,102,241,0.2)]">Cauta</button>
        </form>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {lakes.data.map((lake) => (
          <LakeCard key={lake.documentId} lake={lake} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} createHref={(targetPage) => `/lakes?q=${encodeURIComponent(q)}&page=${targetPage}`} />
    </div>
  );
}
