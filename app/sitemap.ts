import type { MetadataRoute } from "next";
import { safeStrapiGet } from "@/lib/strapi";

function toValidDate(value?: string) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const [competitions, lakes, news] = await Promise.all([
    safeStrapiGet<{ data: Array<{ documentId: string; updatedAt: string }> }>("/competitions", {
      "fields[0]": "documentId",
      "fields[1]": "updatedAt",
      "pagination[pageSize]": 1000,
    }),
    safeStrapiGet<{ data: Array<{ documentId: string; updatedAt: string }> }>("/lakes", {
      "fields[0]": "documentId",
      "fields[1]": "updatedAt",
      "pagination[pageSize]": 1000,
    }),
    safeStrapiGet<{ data: Array<{ documentId: string; slug?: string; updatedAt: string }> }>("/announcements", {
      "fields[0]": "documentId",
      "fields[1]": "slug",
      "fields[2]": "updatedAt",
      "pagination[pageSize]": 1000,
    }),
  ]);

  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/competitions`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/lakes`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/news`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
    ...(competitions?.data ?? []).map((item) => ({
      url: `${baseUrl}/competitions/${item.documentId}`,
      lastModified: toValidDate(item.updatedAt),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...(lakes?.data ?? []).map((item) => ({
      url: `${baseUrl}/lakes/${item.documentId}`,
      lastModified: toValidDate(item.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...(news?.data ?? []).map((item) => ({
      url: `${baseUrl}/news/${item.slug || item.documentId}`,
      lastModified: toValidDate(item.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
