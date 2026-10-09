import { formatBookingPeriod } from '@/core/booking';
import { keepValidTags, type CreateAnglerReviewInput, type ReviewTag } from '@/core/social';
import { GENERIC_ERROR_MESSAGE } from '@/core/transport';

/*
 * operator.evalueaza-pescar — the pure half of fish app/(app)/operator/rate-angler/[bookingId].tsx:
 * the route's params (validated: they come from the address bar, so anyone can type anything), the
 * score's words, the comment rule, the request body and the refusal copy.
 */

/**
 * The review opens at five stars (fish DEFAULT_STARS): most stays are unremarkable, so rating is
 * one tap to confirm and an act of deduction otherwise.
 */
export const DEFAULT_STARS = 5;

/** The CMS keeps the first 1000 characters of a comment (feed/controllers/reviews.ts sanitizeComment). */
export const COMMENT_MAX = 1000;

export const NAME_FALLBACK = 'pescarul';

/** The screen's title (c2): the h1, the document title and the breadcrumb. */
export const RATE_TITLE = 'Evaluează pescarul';

// ── params ──────────────────────────────────────────────────────────────────────────────────────

/** Length caps: past these a value is not something the CMS sent (a username, a stand name). */
const CAP = { name: 80, stand: 40, id: 64, date: 40, url: 2048 } as const;

/** A CMS documentId (cuid2) or any id the CMS could hand out: letters, digits, «-» and «_». */
const ID = /^[A-Za-z0-9_-]+$/;

/** The public S3 buckets the CMS uploads to (next.config.ts images.remotePatterns). */
export const S3_IMAGE_ORIGINS = [
  'https://fir-intins-strapi.s3.eu-central-1.amazonaws.com',
  'https://bluvi-staging.s3.eu-central-1.amazonaws.com',
] as const;

export type RateParams = {
  bookingId: string;
  /** Trimmed, or null: the screen says «pescarul». */
  anglerName: string | null;
  anglerId: string | null;
  /** An http(s) URL on the CMS or its S3 bucket, else null (initials). */
  anglerAvatar: string | null;
  standName: string | null;
  /** Both ISO instants, or both null (a half period is no period). */
  startDate: string | null;
  endDate: string | null;
};

type Raw = Record<string, string | string[] | undefined>;

function one(sp: Raw, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Plain one-line text: control characters out, whitespace collapsed, trimmed, capped (by code point). */
export function cleanText(value: string | undefined, max: number): string | null {
  if (typeof value !== 'string') return null;
  const flat = value.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!flat) return null;
  return Array.from(flat).slice(0, max).join('').trim() || null;
}

/** A documentId-shaped id, else null. */
export function cleanId(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length > 0 && v.length <= CAP.id && ID.test(v) ? v : null;
}

/** An instant the Date parser reads (ISO from the CMS), else null. */
function cleanDate(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > CAP.date || !/^\d{4}-\d{2}-\d{2}T/.test(v)) return null;
  return Number.isFinite(Date.parse(v)) ? v : null;
}

/**
 * The avatar only when it is a picture the CMS serves: https on its S3 bucket, or the CMS's own
 * origin (http locally). No credentials, no other host — the address bar must not be able to make
 * this page load an arbitrary third-party URL with the operator's eyes on it.
 */
export function cleanAvatar(value: string | undefined, allowedOrigins: readonly string[]): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v || v.length > CAP.url) return null;
  let url: URL;
  try {
    url = new URL(v);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (!allowedOrigins.includes(url.origin)) return null;
  return url.href;
}

/** The image origins this deployment accepts: its CMS (from the API base URL) and the S3 buckets. */
export function imageOrigins(cmsApiUrl: string | undefined): string[] {
  const origins: string[] = [...S3_IMAGE_ORIGINS];
  if (cmsApiUrl) {
    try {
      origins.push(new URL(cmsApiUrl).origin);
    } catch {
      /* no CMS origin: S3 only */
    }
  }
  return origins;
}

/**
 * The route's params (routes.operatorRateAngler, fish openRateAngler), or null when the booking id
 * is not an id (nothing to rate: the page is a 404). Every other param is optional — a deep link or
 * an older caller still gets a usable screen.
 */
export function parseRateParams(bookingId: string, sp: Raw, allowedOrigins: readonly string[]): RateParams | null {
  const id = cleanId(safeDecode(bookingId));
  if (!id) return null;
  const start = cleanDate(one(sp, 'startDate'));
  const end = cleanDate(one(sp, 'endDate'));
  const period = start && end && Date.parse(start) <= Date.parse(end);
  return {
    bookingId: id,
    anglerName: cleanText(one(sp, 'anglerName'), CAP.name),
    anglerId: cleanId(one(sp, 'anglerId')),
    anglerAvatar: cleanAvatar(one(sp, 'anglerAvatar'), allowedOrigins),
    standName: cleanText(one(sp, 'standName'), CAP.stand),
    startDate: period ? start : null,
    endDate: period ? end : null,
  };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** The name the screen says (fish: anglerName, else «pescarul»). */
export function displayName(p: Pick<RateParams, 'anglerName'>): string {
  return p.anglerName ?? NAME_FALLBACK;
}

/**
 * «Standul 3 · Sâmbătă, 15 aug · 06:00–18:00» — the parts that are known, «» when neither is (the
 * line is hidden). `timeZone` undefined = the device's (fish: date-fns, device-local).
 */
export function stayLine(p: Pick<RateParams, 'standName' | 'startDate' | 'endDate'>, timeZone?: string): string {
  return [
    p.standName ? `Standul ${p.standName}` : null,
    p.startDate && p.endDate ? formatBookingPeriod(p.startDate, p.endDate, 0, timeZone) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ── the form ────────────────────────────────────────────────────────────────────────────────────

export type VerdictTone = 'success' | 'neutral' | 'danger';

/** The score in words under the stars (fish verdict): green 5–4, neutral 3, red 2–1. */
export function verdict(stars: number): { label: string; tone: VerdictTone } {
  if (stars >= 5) return { label: 'Excelent', tone: 'success' };
  if (stars === 4) return { label: 'Bine', tone: 'success' };
  if (stars === 3) return { label: 'Acceptabil', tone: 'neutral' };
  if (stars === 2) return { label: 'Slab', tone: 'danger' };
  return { label: 'Foarte slab', tone: 'danger' };
}

/** Under 3 stars the comment is required (the server's COMMENT_REQUIRED rule). */
export function commentRequired(stars: number): boolean {
  return stars < 3;
}

export function isValid(stars: number, comment: string): boolean {
  return stars >= 1 && stars <= 5 && (!commentRequired(stars) || comment.trim().length > 0);
}

export type RateState = { stars: number; tags: ReviewTag[] };

/**
 * A new score (fish handleStars): the same score changes nothing (a score is always set); a new one
 * keeps the tags it still offers — going up to five withdraws the faults, praise always survives.
 */
export function withStars(state: RateState, next: number): RateState {
  const stars = Math.min(5, Math.max(1, Math.round(next)));
  if (stars === state.stars) return state;
  return { stars, tags: keepValidTags(state.tags, stars) };
}

/** A chip pressed: on when off, off when on (fish toggleTag). */
export function toggleTag(tags: ReviewTag[], tag: ReviewTag): ReviewTag[] {
  return tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
}

/** POST /feed/angler-reviews body (fish handleSubmit): the comment trimmed, omitted when empty. */
export function reviewInput(bookingId: string, stars: number, comment: string, tags: ReviewTag[]): CreateAnglerReviewInput {
  const text = comment.trim();
  return { booking: bookingId, stars, ...(text ? { comment: text } : {}), tags };
}

export const SENT_MESSAGE = 'Evaluare trimisă';
export const FAILED_MESSAGE = 'Evaluarea nu a putut fi trimisă.';

export const FORBIDDEN_MESSAGE = 'Nu ai acces la această rezervare.';
export const GONE_MESSAGE = 'Rezervarea nu mai există.';

type ReviewError = { status?: number; bluCode?: string; message?: string } | null | undefined;

/**
 * fish friendlyReviewError — the operator never reads a raw code. fish switches on the message,
 * which an older CMS set to the code; today's CMS sends a sentence with the code in
 * `details.bluCode` (core ApiError.bluCode), so the code is read from either. The CMS's code-less
 * refusals are read off the status (feed/controllers/reviews.ts createAnglerReview): 403 = not
 * this owner's lake (the operator contract's «Nu ai acces»), 404 = the booking is gone or detached
 * (fish shows its generic line for both). Anything else: the server's own sentence, or the
 * screen's line when the transport only has its generic one.
 */
export function friendlyReviewError(error: ReviewError): string {
  switch (error?.bluCode ?? error?.message) {
    case 'ANGLER_DID_NOT_SHOW':
      return 'Pescarul e marcat ca neprezentat — neprezentarea ține deja loc de evaluare.';
    case 'ALREADY_REVIEWED':
      return 'Ai evaluat deja această rezervare.';
    case 'INVALID_STATUS':
      return 'Poți evalua doar după ce se încheie rezervarea.';
    case 'COMMENT_REQUIRED':
      return 'La un punctaj mic, comentariul este obligatoriu.';
  }
  if (error?.status === 403) return FORBIDDEN_MESSAGE;
  if (error?.status === 404) return GONE_MESSAGE;
  return error?.message && error.message !== GENERIC_ERROR_MESSAGE ? error.message : FAILED_MESSAGE;
}

/**
 * A refusal no second press can change (not this owner's, gone, already rated, a no-show): the
 * CTA stays off after it. The others (a stay not yet ended, a missing comment, a 5xx) can be retried.
 */
export function isFinalRefusal(error: ReviewError): boolean {
  const code = error?.bluCode ?? error?.message;
  return code === 'ALREADY_REVIEWED' || code === 'ANGLER_DID_NOT_SHOW' || error?.status === 403 || error?.status === 404;
}
