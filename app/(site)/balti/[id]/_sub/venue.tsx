'use client';

import Link from 'next/link';
import { useCallback, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { lakeHref } from '../_components/availability';

/*
 * Pieces the lake's community pages share (partide, statistici, clasament): photos with a load
 * fallback, the angler link, the empty-state glyph, Romania-time dates. Avatars are the kit's
 * (components/ui/Avatar: the tone from the name on every page).
 * TODO(kit): ape-publice/_components/venue/bits.tsx draws the same pieces for a public water (that
 * unit's files) — one venue kit in components/ once both land.
 */

/* ------------------------------------------------------------------------------------------------
 * Dates in Romania's time (server and browser agree; fish format.ts copy)
 * ---------------------------------------------------------------------------------------------- */

const MONTHS = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC'];
const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Bucharest',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(iso: string) {
  const p = Object.fromEntries(PARTS.formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { year: Number(p.year), day: Number(p.day), month: Number(p.month) - 1, time: `${p.hour}:${p.minute}` };
}

/** fish fmtRecordDate: «12 IUL». */
export function dayMonth(iso: string): string {
  const p = parts(iso);
  return `${p.day} ${MONTHS[p.month]}`;
}

/** fish fmtRange: «26 IUL · 06:40 – 18:10»; past midnight both days are named. */
export function dateRange(startedAt: string, endedAt: string): string {
  const s = parts(startedAt);
  const e = parts(endedAt);
  if (s.year === e.year && s.month === e.month && s.day === e.day) return `${s.day} ${MONTHS[s.month]} · ${s.time} – ${e.time}`;
  return `${s.day} ${MONTHS[s.month]} ${s.time} – ${e.day} ${MONTHS[e.month]} ${e.time}`;
}

/* ------------------------------------------------------------------------------------------------
 * Photos and avatars that never show the broken-image glyph
 * ---------------------------------------------------------------------------------------------- */

/** A photo that failed before hydration is caught by the ref (its onError fired before React listened). */
function usePhotoFailed(src: string | null | undefined) {
  const [failed, setFailed] = useState<string | null>(null);
  const check = useCallback(
    (img: HTMLImageElement | null) => {
      if (img && src && img.complete && img.naturalWidth === 0) setFailed(src);
    },
    [src],
  );
  return [!!src && failed === src, check, () => setFailed(src ?? null)] as const;
}

/** A CMS photo that disappears when it fails, leaving its box's ground. */
export function SafePhoto({ src, className, loading = 'lazy' }: { src: string; className?: string; loading?: 'lazy' | 'eager' }) {
  const [failed, check, onError] = usePhotoFailed(src);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element -- CMS rendition, already sized.
  return <img ref={check} src={src} alt="" loading={loading} onError={onError} className={className} />;
}

const AVATAR_PX = { 32: 'size-8', 44: 'size-11' } as const;

/**
 * The kit Avatar with a photo load fallback: its initials disc (the kit's tone, from the NAME — the
 * same face as in Clasament and the kit's FaceStack) always drawn, the photo over it, dropped when
 * it fails (a broken-image glyph never shows). TODO(kit): Avatar / FaceStack `onError` fallback —
 * then this goes (this unit may only touch the lake pages).
 */
export function AnglerAvatar({ name, src, size, ring }: { name: string; src: string | null; size: keyof typeof AVATAR_PX; ring?: boolean }) {
  const [failed, check, onError] = usePhotoFailed(src);
  return (
    <span className={cn('relative inline-flex shrink-0 rounded-full', AVATAR_PX[size])}>
      <Avatar name={name} src={null} size={size} ring={ring} />
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote CMS photo at avatar size.
        <img
          ref={check}
          src={src}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          onError={onError}
          className={cn('absolute rounded-full object-cover', ring ? 'inset-0.5 size-[calc(100%-(--spacing(1)))]' : 'inset-0 size-full')}
        />
      ) : null}
    </span>
  );
}

/**
 * The kit FaceStack (32: a quarter overlap, the 2px surface ring) drawn with AnglerAvatar, so a
 * failed photo falls back to the initials. Decorative: the names are printed beside it.
 */
export function FaceRow({ people, className }: { people: { name: string; src: string | null }[]; className?: string }) {
  return (
    <span aria-hidden className={cn('flex shrink-0 items-center *:not-first:-ml-2', className)}>
      {people.map((p, i) => (
        <AnglerAvatar key={`${p.name}-${i}`} name={p.name} src={p.src} size={32} ring />
      ))}
    </span>
  );
}

/** An angler as a link to /pescari/<uid> once the web has that page (availability.ts `angler`), else a block. */
export function AnglerLink({ uid, label, className, children }: { uid: string; label: string; className?: string; children: ReactNode }) {
  const href = lakeHref('angler', routes.angler(uid));
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn('transition-colors hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent', className)}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Numbers and states
 * ---------------------------------------------------------------------------------------------- */

/** The 48 slot of an empty card: a 24 outline glyph on the accent-tint disc. */
export function EmptyIcon({ children }: { children: ReactNode }) {
  return <span className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-ink [&>svg]:size-6">{children}</span>;
}
