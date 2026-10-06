import Image from 'next/image';
import { NewspaperIcon } from '@heroicons/react/24/outline';
import type { AnnouncementListItem } from '@/core/news';
import { CardShell, CardTitle, Tag } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { blurDataUrl } from '@/lib/blurhash';
import { cardImage } from './content';
import { categoryLabel, newsDate } from './format';

/*
 * fish components/NewsCard.tsx on the kit card (CardShell: e1 + hairline, the e2 lift on hover, the
 * title's stretched link making the whole card the target):
 *  - the first banner (medium → original) over its blurhash, fish's 200px image header;
 *  - the creation date «DD MMMM YYYY» uppercase, muted, with the green category badge on its row
 *    (badge-green pair: fish green3 on its tint, raised to AA in Fundații);
 *  - the title (heading, at most 3 lines) and the short description (at most 3 lines). fish fixes
 *    the block's height (NEWS_TEXT_BLOCK_HEIGHT) for its horizontal carousel; in the web's grid the
 *    row already stretches its cards to one height (CardShell h-full), so the text takes only what
 *    it needs and short copy leaves no empty band.
 * No banner: an accent-tinted header with the newspaper glyph in accent ink (fish shows its default
 * blurhash) — soft-fill is a step from the page ground, so a row of banner-less cards looked like
 * they started at the date line.
 * `sizes` follows the auto-fill grid (ListGrid min 280): 1 column below 768, 2 to 1023, 3 to 1279,
 * 4+ from 1280. Kit gap: the 200px photo band (fish) is not CardPhoto's 132 — CardPhoto has no
 * height option yet.
 */
export function NewsCard({
  news,
  priority = false,
  as = 'h2',
}: {
  news: AnnouncementListItem;
  /** The first cards of the list: their banner is the LCP. */
  priority?: boolean;
  /** The title's element (h2 under the list's h1). */
  as?: 'h2' | 'h3';
}) {
  const img = cardImage(news.banner);
  const blur = blurDataUrl(img?.blurhash);
  return (
    <CardShell elevated interactive className="h-full">
      <div className={cn('relative h-50 shrink-0 overflow-hidden', img ? 'bg-soft-fill' : 'bg-accent-tint-2')}>
        {img ? (
          <Image
            src={img.src}
            alt=""
            fill
            preload={priority}
            sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
            {...(blur ? { placeholder: 'blur' as const, blurDataURL: blur } : {})}
            className="object-cover"
          />
        ) : (
          <span aria-hidden className="flex h-full items-center justify-center text-accent-ink">
            <NewspaperIcon className="size-8" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="mr-auto t-caption whitespace-nowrap text-muted">
            <time dateTime={news.createdAt}>{newsDate(news.createdAt)}</time>
          </p>
          <Tag tone="green">{categoryLabel(news.category)}</Tag>
        </div>
        <div className="flex flex-col gap-0.5">
          <CardTitle as={as} href={routes.newsItem(news.documentId)} className="line-clamp-3 t-heading text-ink">
            {news.title}
          </CardTitle>
          {news.shortDescription ? <p className="line-clamp-3 t-body text-muted">{news.shortDescription}</p> : null}
        </div>
      </div>
    </CardShell>
  );
}
