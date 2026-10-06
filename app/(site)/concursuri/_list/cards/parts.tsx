import { MapPinIcon, TrophyIcon, UserIcon, UsersIcon } from '@heroicons/react/20/solid';
import { CardTitle } from '@/components/cards/CardShell';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { cardRankingLabel, type CardMedia, type CompetitionCard } from '@/core/competitions';
import { blurDataUrl } from '@/lib/blurhash';
import { routes } from '@/lib/routes';

/*
 * The pieces both competition cards share (the poster card ./PosterCard and the compact
 * ../CompetitionCardItem): the poster source, its blurhash placeholder, the one stretched link
 * (the name), the ranking and format chips, the lake line. fish CompetitionCardPreview.
 */

/** What a tapped poster hands the page's photo viewer (fish onOpenPhoto: the thumb and blurhash too). */
export type PhotoRequest = {
  competition: CompetitionCard;
  url: string;
  /** The card's own (already loaded) thumbnail: drawn first, under the original. */
  thumbnailUrl?: string;
  blurhash?: string | null;
  width?: number;
  height?: number;
};

/** fish: banner small → banner original → lake image small → lake image original (c2). */
export function posterOf(c: CompetitionCard) {
  const media: CardMedia | null = c.banner ?? c.lake?.image ?? null;
  const thumb = c.banner?.smallUrl ?? c.banner?.url ?? c.lake?.image?.smallUrl ?? c.lake?.image?.url ?? null;
  return { media, thumb, full: media?.url ?? thumb };
}

export function blur(media: CardMedia | null) {
  const url = blurDataUrl(media?.blurhash);
  return url ? { placeholder: 'blur' as const, blurDataURL: url } : {};
}

/** The name, carrying the card's one link (c1, c7). */
export function CardName({ c, className }: { c: CompetitionCard; className: string }) {
  return (
    <CardTitle href={routes.competition(c.documentId)} className={cn('line-clamp-2 text-ink', className)}>
      {c.name}
    </CardTitle>
  );
}

/** The ranking chip and the format chip (c8). */
export function Chips({ c }: { c: CompetitionCard }) {
  const team = c.format.kind === 'team';
  return (
    <>
      <Badge color="violet" icon={<TrophyIcon aria-hidden />} className="min-w-0 shrink">
        <span className="truncate">{cardRankingLabel(c)}</span>
      </Badge>
      <Badge color="blue" icon={team ? <UsersIcon aria-hidden /> : <UserIcon aria-hidden />}>
        {team ? 'Echipe' : 'Individual'}
      </Badge>
    </>
  );
}

export function LakeLine({ c }: { c: CompetitionCard }) {
  if (!c.lake) return null;
  return (
    <p className="flex min-w-0 items-center gap-1 t-label text-accent-ink">
      <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">{c.lake.name}</span>
    </p>
  );
}

/** The photo viewer's request for a card's poster, or null when it has none. */
export function photoRequestOf(c: CompetitionCard): PhotoRequest | null {
  const { media, thumb, full } = posterOf(c);
  if (!full) return null;
  return {
    competition: c,
    url: full,
    thumbnailUrl: thumb ?? undefined,
    blurhash: media?.blurhash ?? null,
    width: media?.width ?? undefined,
    height: media?.height ?? undefined,
  };
}
