import Image from "next/image";
import Link from "next/link";
import { safeStrapiGet } from "@/lib/strapi";
import { resolveMediaUrl } from "@/lib/utils";
import type { Sponsor } from "@/types";

export async function SponsorsStrip() {
  const response = await safeStrapiGet<{ data: Sponsor[] }>(
    "/sponsors",
    { "pagination[pageSize]": 12, populate: ["logo"] },
    { tags: ["sponsors"], revalidate: 300 },
  );

  const sponsors = response?.data ?? [];
  if (!sponsors.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-7">Sponsori</h2>
      <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {sponsors.map((sponsor) => {
          const logo = resolveMediaUrl(sponsor.logo?.url);
          return (
            <Link
              key={sponsor.documentId}
              href={`/sponsors/${sponsor.documentId}`}
              className="flex h-[120px] w-[180px] shrink-0 items-center justify-center rounded-card bg-white p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-md"
            >
              {logo ? (
                <Image
                  src={logo}
                  alt={sponsor.name}
                  width={140}
                  height={80}
                  className="max-h-[80px] w-auto object-contain"
                />
              ) : (
                <span className="text-sm font-bold text-gray-7">{sponsor.name}</span>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
