import type { ReactNode } from 'react';
import { PROSE_MAX } from '@/components/nav/shell';
import { DetailAsideCard, DetailBody, DetailPage } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';

/*
 * The page frame of Știre and Sponsor — fish ScreenWithFakeSheet, built from the T3 parts
 * (DetailPage on the white phone ground + DetailBody's tracks, gutters and sticky right column),
 * so the two pages move with the template:
 *  - phone (the fish screen): all white; the pictures full bleed at the top, then the «sheet» — the
 *    text lifted 24px over them with rounded top corners (fish `marginTop -24`, radius 10, padding
 *    20); the side column follows the article, under a hairline;
 *  - 768–1279: the grey page, the article a card inside the 24px gutters (pictures at its top),
 *    the side column a card under it;
 *  - from 1280: centre · right on the template tracks, the side column sticky under the top bar.
 * The article's text holds the reading measure (PROSE_MAX, ROADMAP §4: only reading text is
 * capped), CENTRED in the card under the full-width pictures: the sheet has the card's own 32 | 40
 * padding and an inner column of `mx-auto PROSE_MAX`. The side cards centre their content on the
 * same measure while they are stacked under the article (768–1279), so every heading of the page
 * starts on one left edge.
 *
 * The one part T3 does not have yet — the article sheet (a white centre card with the pictures at
 * its top and the phone lift) — is this file's <article>. Kit gap: a T3 `DetailArticle`.
 */

export function ArticleFrame({
  hero,
  titleId,
  aside,
  asideLabel,
  asideBelowXl = 'end',
  children,
}: {
  /** The Gallery (or nothing). */
  hero?: ReactNode;
  /** id of the article's <h1>: the <article> is labelled by it. None: a plain block (the skeleton). */
  titleId?: string;
  /**
   * The side column («Alte noutăți» / «Alți sponsori»): always given, so the right track is kept
   * from 1280 whatever the column turns out to hold (its slot streams after the article).
   */
  aside: ReactNode;
  asideLabel: string;
  /** Below 1280: after the article (default) or not at all (the skeleton). */
  asideBelowXl?: 'end' | 'hidden';
  children: ReactNode;
}) {
  const Root = titleId ? 'article' : 'div';
  return (
    <DetailPage phoneGround="surface">
      <DetailBody aside={aside} asideLabel={asideLabel} asideSticky asideBelowXl={asideBelowXl} className="max-md:gap-0 max-md:pt-0">
        <Root aria-labelledby={titleId} className="flex min-w-0 flex-col bg-surface md:overflow-hidden md:rounded-card md:shadow-e0">
          {hero}
          <div
            className={cn(
              'relative bg-surface px-5 pt-5 pb-6 md:p-8 xl:p-10',
              // The fish sheet over the pictures (phone only, and only under a picture header).
              hero ? 'max-md:-mt-6 max-md:rounded-t-card' : null,
            )}
          >
            <div className={cn('mx-auto flex w-full flex-col gap-4', PROSE_MAX)}>{children}</div>
          </div>
        </Root>
      </DetailBody>
    </DetailPage>
  );
}

/**
 * A card of the side column: T3 DetailAsideCard, its title an h2 (the side column follows the
 * article's h1 directly). Phone: a white block of the sheet under a hairline, at the sheet's 20px
 * inset; 768–1279 the article sheet's 32px padding with the title row and the content centred on
 * the same measure (`max-w-180` = PROSE_MAX: a variant cannot be prefixed onto the constant); from
 * 1280 the rail card's own padding, full width.
 */
export function AsideCard({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <DetailAsideCard
      as="h2"
      title={title}
      action={action}
      className="max-md:border-t max-md:border-hairline max-md:px-5 md:px-8 md:py-6 md:*:mx-auto md:*:max-w-180 xl:p-6 xl:*:max-w-none"
    >
      {children}
    </DetailAsideCard>
  );
}

/** «Alți sponsori»'s grid of logo tiles (OtherSponsors), shared with its skeleton. */
export const SPONSOR_TILE_GRID = 'grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(--spacing(36),1fr))] xl:grid-cols-2';

/**
 * A side card in grey while its read streams in (the Suspense fallback, and the page skeleton's
 * right column): the SAME AsideCard shell (so its padding and title row are the loaded card's and
 * nothing moves on stream-in), the title a bar, then the loaded card's shape — `rows` for «Alte
 * noutăți» (64px thumb, date, title), `tiles` for «Alți sponsori» (the 8:5 logo grid).
 */
export function AsideSkeleton({ variant = 'rows' }: { variant?: 'rows' | 'tiles' }) {
  const bar = 'block animate-shimmer rounded-full';
  return (
    <div aria-hidden>
      <AsideCard title={<span className={`${bar} h-4 w-32`} />}>
        {variant === 'tiles' ? (
          <span className={SPONSOR_TILE_GRID}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="block aspect-8/5 animate-shimmer rounded-card" />
            ))}
          </span>
        ) : (
          <span className="flex flex-col md:grid md:grid-cols-2 md:gap-x-6 xl:flex">
            {[0, 1, 2].map((i) => (
              <span key={i} className="flex items-start gap-3 py-3 first:pt-0">
                <span className="size-16 shrink-0 animate-shimmer rounded-control" />
                <span className="flex flex-1 flex-col gap-2 pt-1">
                  <span className={`${bar} h-2.5 w-20`} />
                  <span className={`${bar} h-3.5 w-[85%]`} />
                </span>
              </span>
            ))}
          </span>
        )}
      </AsideCard>
    </div>
  );
}
