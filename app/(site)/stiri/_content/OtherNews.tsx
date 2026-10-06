import Image from 'next/image';
import Link from 'next/link';
import { NewspaperIcon } from '@heroicons/react/24/outline';
import type { AnnouncementListItem } from '@/core/news';
import { routes } from '@/lib/routes';
import { AsideCard } from './ArticleFrame';
import { blurDataUrl } from '@/lib/blurhash';
import { cardImage } from './content';
import { newsDate } from './format';
import { latestNews } from './load';

/*
 * «Alte noutăți» — the article's side column (web: fish shows the article alone; on a wide screen the
 * right track of T3 holds the way on). The newest items of Noutăți's first page (the same cached
 * read, tag `announcements-list`) without the open one, and «Vezi toate» → Noutăți.
 *
 * Its own async slot (OtherNewsSlot) inside a <Suspense>: the article never waits for this read
 * (bounded at 8s, never throws). When the read failed or there is nothing else, the card stays
 * with the way on to Noutăți, so the right track never collapses after paint.
 */
export function otherNews(news: AnnouncementListItem[] | null, currentId: string, max = 4): AnnouncementListItem[] {
  return (news ?? []).filter((n) => n.documentId !== currentId).slice(0, max);
}

const SEE_ALL_CLASS = 'rounded-control t-body-strong text-accent-ink underline-offset-2 hover:underline';

export async function OtherNewsSlot({ currentId }: { currentId: string }) {
  return <OtherNews others={otherNews(await latestNews(), currentId)} />;
}

export function OtherNews({ others }: { others: AnnouncementListItem[] }) {
  if (others.length === 0) {
    return (
      <AsideCard title="Alte noutăți">
        <p className="t-body text-muted">
          Toate anunțurile Bluvi sunt pe pagina{' '}
          <Link href={routes.news()} className={SEE_ALL_CLASS}>
            Noutăți
          </Link>
          .
        </p>
      </AsideCard>
    );
  }
  return (
    <AsideCard
      title="Alte noutăți"
      action={
        <Link href={routes.news()} className={SEE_ALL_CLASS}>
          Vezi toate<span className="sr-only"> noutățile</span>
        </Link>
      }
    >
      {/* Two columns while the card spans the page (768–1279), the stack in the 1280+ rail. */}
      <ul className="flex flex-col md:grid md:grid-cols-2 md:gap-x-6 xl:flex xl:flex-col">
        {others.map((n, i) => {
          const img = cardImage(n.banner);
          const blur = blurDataUrl(img?.blurhash);
          return (
            <li
              key={n.documentId}
              className={
                // The divider per item: above every row but the first (the first two side by side).
                i === 0
                  ? 'relative flex items-start gap-3 pb-3'
                  : i === 1
                    ? 'relative flex items-start gap-3 border-t border-hairline py-3 md:border-t-0 md:pt-0 xl:border-t xl:pt-3'
                    : 'relative flex items-start gap-3 border-t border-hairline py-3'
              }
            >
              <span className="relative size-16 shrink-0 overflow-hidden rounded-control bg-soft-fill">
                {img ? (
                  <Image
                    src={img.src}
                    alt=""
                    fill
                    sizes="64px"
                    {...(blur ? { placeholder: 'blur' as const, blurDataURL: blur } : {})}
                    className="object-cover"
                  />
                ) : (
                  <span aria-hidden className="flex h-full items-center justify-center text-muted">
                    <NewspaperIcon className="size-6" />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="t-caption text-muted">
                  <time dateTime={n.createdAt}>{newsDate(n.createdAt)}</time>
                </span>
                <Link
                  href={routes.newsItem(n.documentId)}
                  className="line-clamp-2 t-body-strong text-ink outline-none after:absolute after:inset-0 after:content-[''] hover:text-accent-ink focus-visible:after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-accent"
                >
                  {n.title}
                </Link>
              </span>
            </li>
          );
        })}
      </ul>
    </AsideCard>
  );
}
