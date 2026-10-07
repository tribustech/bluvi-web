'use client';

import type { ReactNode } from 'react';
import { FishIcon } from '@/components/icons/brand';
import { CardShell, CardTitle } from '@/components/cards/CardShell';
import { cn } from '@/components/ui/cn';
import { fmtKg, type CommunityMemberDTO, type CommunitySessionPhotoDTO } from '@/core/partide';
import { MemberFaces, MetaLine, Photo, Ribbon, type RibbonVariant } from './parts';

/*
 * fish features/partide/components/card/* — the one partidă card shell (PartidaCard) and its slots:
 * header (CardHeader), the three-figure strip (StatStrip), the photo strip (PhotoStrip). The footer
 * and the ribbon live in ./parts. On the kit card (CardShell): the title is the card's stretched
 * link (CardTitle) when the card opens something; inner targets (a duel side, a leaderboard row)
 * sit above it (`relative z-above`).
 */

/** fish PartidaCard: white, radius 16 (the kit card), padding 16, slots 14 apart, the ribbon in the corner. */
export function PartidaCardShell({
  ribbon,
  children,
  interactive,
  testId,
}: {
  ribbon?: { variant: RibbonVariant; label: string };
  children: ReactNode;
  interactive: boolean;
  testId?: string;
}) {
  return (
    <div className="flex" data-testid={testId}>
      <CardShell interactive={interactive} className="w-full gap-3.5 p-4">
        {ribbon ? <Ribbon variant={ribbon.variant} label={ribbon.label} /> : null}
        {children}
      </CardShell>
    </div>
  );
}

export type CardThumb = { kind: 'image'; url: string | null } | { kind: 'members'; members: CommunityMemberDTO[] };

/**
 * fish CardHeader: the thumb (the members' faces, or the venue's picture with a fish glyph when it
 * has none), the title (the angler on a community card, the venue on a duel / leaderboard) — the
 * card's link — and the meta line. The title keeps clear of the corner ribbon.
 */
export function CardHeader({
  thumb,
  title,
  href,
  meta,
  ribbonClear = true,
}: {
  thumb: CardThumb;
  title: string;
  href: string | null;
  meta?: { strong?: string | null; text?: string | null };
  ribbonClear?: boolean;
}) {
  return (
    <header className="flex min-h-11 items-center gap-3">
      {thumb.kind === 'members' ? (
        <MemberFaces members={thumb.members} size={44} />
      ) : thumb.url ? (
        <span className="size-11 shrink-0 overflow-hidden rounded-control bg-soft-fill">
          <Photo src={thumb.url} />
        </span>
      ) : (
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-control bg-accent-tint text-accent-ink">
          <FishIcon size={20} />
        </span>
      )}
      <span className={cn('flex min-w-0 flex-1 flex-col gap-0.5', ribbonClear && 'pr-24')}>
        <CardTitle href={href ?? undefined} className="truncate t-heading text-ink">
          {title}
        </CardTitle>
        {meta ? <MetaLine strong={meta.strong} text={meta.text} /> : null}
      </span>
    </header>
  );
}

export type CardStat = { value: string; label: string; accent?: boolean };

/**
 * fish StatStrip — three equal columns under a hairline, separated by hairlines; the middle one
 * (always the kg) in the accent ink. The label carries the unit («kg total»), its own smaller
 * muted element under the figure (owner rule 10).
 */
export function StatStrip({ stats }: { stats: CardStat[] }) {
  return (
    <dl className="grid grid-cols-3 border-t border-hairline pt-3" data-testid="stat-strip">
      {stats.map((s, i) => (
        <div key={s.label} className={cn('flex min-w-0 flex-col-reverse gap-0.5', i > 0 && 'border-l border-hairline pl-3.5')}>
          <dt className="truncate t-micro text-muted">{s.label}</dt>
          <dd className={cn('truncate t-title2 tabular-nums', s.accent ? 'text-accent-ink' : 'text-ink')}>{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const MAX_TILES = 3;

/**
 * fish PhotoStrip — at most three equal tiles (a single photo keeps its third, never stretched across
 * the card), the catch's weight on each; when there are more photos the last tile turns into «+N».
 * Nothing when the partidă has no photo.
 */
export function PhotoStrip({ photos, total }: { photos: CommunitySessionPhotoDTO[]; total: number }) {
  const tiles = photos.slice(0, MAX_TILES);
  if (tiles.length === 0) return null;
  const hidden = Math.max(0, total - tiles.length);
  return (
    <ul className="grid grid-cols-3 gap-2" aria-label={`${total} ${total === 1 ? 'fotografie' : 'fotografii'}`} data-testid="photo-strip">
      {tiles.map((p, i) => {
        const more = hidden > 0 && i === tiles.length - 1;
        return (
          <li key={`${p.url}-${i}`} className="relative h-24 overflow-hidden rounded-control bg-soft-fill">
            <Photo src={p.thumbUrl ?? p.url} />
            {more ? (
              <span className="absolute inset-0 flex items-center justify-center bg-photo-scrim t-heading text-on-photo-scrim">+{hidden}</span>
            ) : p.weightKg != null ? (
              <span className="absolute bottom-1.5 left-1.5 inline-flex items-baseline gap-0.5 rounded-badge bg-photo-scrim px-1.5 py-0.5 t-micro-strong text-on-photo-scrim">
                {fmtKg(p.weightKg)}
                <span className="t-nano">kg</span>
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
