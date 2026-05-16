import { type ClassValue, clsx } from "clsx";
import { format, formatDistanceToNow } from "date-fns";
import { ro } from "date-fns/locale";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function absoluteUrl(path = "") {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  return new URL(path, base).toString();
}

export function formatDate(date: string | Date, dateFormat = "dd MMM yyyy") {
  return format(new Date(date), dateFormat, { locale: ro });
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), "dd MMM yyyy, HH:mm", { locale: ro });
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ro });
}

export function isOrganizerRole(roleName?: string | null) {
  return roleName?.toLowerCase().includes("organizer") ?? false;
}

export function resolveMediaUrl(url?: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const base =
    process.env.NEXT_PUBLIC_STRAPI_MEDIA_BASE_URL ||
    process.env.NEXT_PUBLIC_STRAPI_URL ||
    "http://localhost:1337";
  return new URL(url, base).toString();
}
