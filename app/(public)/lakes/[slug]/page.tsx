import type { Metadata } from "next";
import Image from "next/image";
import { BadgeCheck, Fish, MapPin, Phone, Ruler, Users, Waves } from "lucide-react";
import { ImageCarousel } from "@/components/domain/image-carousel";
import { LakeMap } from "@/components/domain/lake-map";
import { LakeReviews } from "@/components/domain/lake-reviews";
import { CompetitionCard } from "@/components/domain/competition-card";
import { Badge } from "@/components/ui/badge";
import { lakePlaceJsonLd } from "@/lib/structured-data";
import { safeStrapiGet } from "@/lib/strapi";
import { renderRichText } from "@/lib/content";
import { resolveMediaUrl } from "@/lib/utils";
import type { Lake } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lake = await safeStrapiGet<{ data: Lake }>(
    `/lakes/${slug}`,
    { populate: ["images"] },
    { tags: ["lakes"] },
  );
  const data = lake?.data;

  return {
    title: data?.name || "Balta",
    description: data?.address || "Detalii despre balta Bluvi.",
    openGraph: {
      images: data?.images?.[0]?.url
        ? [{ url: resolveMediaUrl(data.images[0].url) as string }]
        : [],
    },
  };
}

export default async function LakeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const lakeResult = await safeStrapiGet<{ data: Lake }>(
    `/lakes/${slug}`,
    {
      populate: [
        "images",
        "facility",
        "fishSpecies.fish.Image",
        "price",
        "contact",
        "coordinates",
        "competitions.banner",
        "competitions.lake",
        "depth",
        "stands",
      ],
    },
    { tags: ["lakes"], revalidate: 300 },
  );
  const lake = lakeResult?.data;

  if (!lake) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="rounded-card border border-dashed border-gray-2 bg-white p-8 text-center text-sm text-gray-5">
          Balta nu a fost gasita.
        </div>
      </div>
    );
  }

  const infoItems = [
    lake.surface ? { icon: Waves, label: "Suprafata", value: `${lake.surface} ha` } : null,
    lake.depth
      ? { icon: Ruler, label: "Adancime", value: `${lake.depth.min ?? "?"} - ${lake.depth.max ?? "?"} m` }
      : null,
    lake.numberOfSeats ? { icon: Users, label: "Locuri", value: `${lake.numberOfSeats}` } : null,
    lake.regime ? { icon: Fish, label: "Regim", value: lake.regime } : null,
    lake.fishingType ? { icon: Fish, label: "Tip pescuit", value: lake.fishingType } : null,
  ].filter(Boolean) as { icon: React.ComponentType<{ className?: string }>; label: string; value: string }[];

  return (
    <div className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(lakePlaceJsonLd(lake)) }}
      />

      {/* Image Carousel */}
      <ImageCarousel images={lake.images ?? []} />

      {/* Lake Header */}
      <section className="rounded-card bg-white p-6 shadow-[0_5px_15px_rgba(0,0,0,0.08)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold text-gray-7">{lake.name}</h1>
              {lake.isVerified && <BadgeCheck className="h-6 w-6 text-indigo-5" />}
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-5">
              <MapPin className="h-4 w-4" />
              {lake.address || lake.county || "Romania"}
            </div>
          </div>
          {lake.reviewsMeta?.averageRating ? (
            <div className="rounded-card bg-indigo-1 px-4 py-2 text-center">
              <p className="text-2xl font-bold text-indigo-7">
                {lake.reviewsMeta.averageRating.toFixed(1)}
              </p>
              <p className="text-xs text-gray-5">{lake.reviewsMeta.totalReviews} recenzii</p>
            </div>
          ) : null}
        </div>

        {infoItems.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-4">
            {infoItems.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <item.icon className="h-4 w-4 text-indigo-5" />
                <span className="text-sm text-gray-5">{item.label}:</span>
                <span className="text-sm font-bold text-gray-7">{item.value}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-8">
          {/* Facilities */}
          {lake.facility?.length ? (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-7">Facilitati</h2>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {lake.facility.map((f) => (
                  <div
                    key={f.documentId || f.name}
                    className="flex items-center gap-2 rounded-card bg-gray-1 px-4 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-2">
                      <BadgeCheck className="h-4 w-4 text-green-7" />
                    </div>
                    <span className="text-sm font-semibold text-gray-7">{f.name}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Fish Species */}
          {lake.fishSpecies?.length ? (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-7">Specii de pesti</h2>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {lake.fishSpecies.map((species, i) => (
                  <div key={species.documentId || i} className="overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
                    {species.fish?.Image?.url ? (
                      <div className="relative h-28 w-full bg-gray-1">
                        <Image
                          src={resolveMediaUrl(species.fish.Image.url) || "/logo.svg"}
                          alt={species.fish?.Name || ""}
                          width={200}
                          height={112}
                          className="h-full w-full object-contain p-2"
                        />
                      </div>
                    ) : (
                      <div className="flex h-28 items-center justify-center bg-gray-1">
                        <Fish className="h-10 w-10 text-gray-2" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="font-bold text-gray-7">{species.fish?.Name || "Specie"}</p>
                      {species.quality && (
                        <Badge variant="indigo" className="mt-1">
                          {species.quality}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Description */}
          {lake.description ? (
            <section className="space-y-4">
              <h2 className="text-xl font-bold text-gray-7">Descriere</h2>
              <div className="prose-bluvi rounded-card bg-white p-6">
                {renderRichText(lake.description)}
              </div>
            </section>
          ) : null}
        </div>

        <div className="space-y-8">
          {/* Pricing */}
          {lake.price?.length ? (
            <section className="rounded-card bg-white p-6 shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
              <h3 className="mb-4 text-lg font-bold text-gray-7">Tarife</h3>
              <div className="space-y-3">
                {lake.price.map((p) => (
                  <div
                    key={p.documentId || p.header}
                    className="flex items-center justify-between rounded-card bg-gray-1 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-7">{p.header}</p>
                      {p.description && <p className="text-xs text-gray-5">{p.description}</p>}
                    </div>
                    <p className="text-lg font-bold text-indigo-7">{p.price} lei</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Contact */}
          {lake.contact?.length ? (
            <section className="rounded-card bg-white p-6 shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
              <h3 className="mb-4 text-lg font-bold text-gray-7">Contact</h3>
              <div className="space-y-3">
                {lake.contact.map((c) => (
                  <div key={c.documentId || c.phone} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-1">
                      <Phone className="h-4 w-4 text-indigo-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-7">{c.header}</p>
                      <p className="text-sm text-gray-5">{c.name}</p>
                      <a
                        href={`tel:${c.phone}`}
                        className="text-sm font-bold text-indigo-5 hover:text-indigo-7"
                      >
                        {c.phone}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {/* Map */}
          {lake.coordinates && (
            <section className="rounded-card bg-white p-6 shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
              <LakeMap coordinates={lake.coordinates} name={lake.name} />
            </section>
          )}

          {/* Website */}
          {lake.website && (
            <a
              href={lake.website}
              target="_blank"
              rel="noreferrer"
              className="block rounded-card bg-indigo-5 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-indigo-7"
            >
              Viziteaza site-ul baltii
            </a>
          )}
        </div>
      </div>

      {/* Reviews */}
      <section className="rounded-card bg-white p-6 shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
        <LakeReviews lakeId={lake.documentId} meta={lake.reviewsMeta} />
      </section>

      {/* Competitions */}
      {lake.competitions?.length ? (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-gray-7">Competitii pe aceasta balta</h2>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {lake.competitions.map((competition) => (
              <CompetitionCard key={competition.documentId} competition={competition} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
