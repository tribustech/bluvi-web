import type { Competition } from "@/types/competition";
import type { Lake } from "@/types/lake";
import type { NewsArticle } from "@/types/news";
import { resolveMediaUrl } from "./utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bluvi",
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description: "Platforma Bluvi pentru competitii de pescuit sportiv din Romania.",
  };
}

export function competitionEventJsonLd(competition: Competition) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: competition.name,
    startDate: competition.startDate,
    endDate: competition.endDate,
    eventStatus:
      competition.competitionStatus === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: competition.lake
      ? {
          "@type": "Place",
          name: competition.lake.name,
          address: competition.lake.address || competition.lake.county || "Romania",
          ...(competition.lake.coordinates
            ? {
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: competition.lake.coordinates.lat,
                  longitude: competition.lake.coordinates.long,
                },
              }
            : {}),
        }
      : undefined,
    image: competition.banner?.url ? resolveMediaUrl(competition.banner.url) : undefined,
    organizer: competition.author
      ? { "@type": "Person", name: competition.author.username }
      : { "@type": "Organization", name: "Bluvi" },
    offers: {
      "@type": "Offer",
      price: competition.registerFee,
      priceCurrency: "RON",
      availability:
        competition.competitionStatus === "notStarted"
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
    },
    maximumAttendeeCapacity: competition.participantsLimit,
  };
}

export function lakePlaceJsonLd(lake: Lake) {
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name: lake.name,
    description: typeof lake.description === "string" ? lake.description : undefined,
    address: lake.address || lake.county || "Romania",
    ...(lake.coordinates
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: lake.coordinates.lat,
            longitude: lake.coordinates.long,
          },
        }
      : {}),
    image: lake.images?.[0]?.url ? resolveMediaUrl(lake.images[0].url) : undefined,
    ...(lake.reviewsMeta?.averageRating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: lake.reviewsMeta.averageRating,
            reviewCount: lake.reviewsMeta.totalReviews,
          },
        }
      : {}),
  };
}

export function articleJsonLd(article: NewsArticle) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.createdAt,
    dateModified: article.updatedAt,
    image: article.banner?.url ? resolveMediaUrl(article.banner.url) : undefined,
    publisher: {
      "@type": "Organization",
      name: "Bluvi",
      logo: { "@type": "ImageObject", url: `${SITE_URL}/logo.svg` },
    },
  };
}
