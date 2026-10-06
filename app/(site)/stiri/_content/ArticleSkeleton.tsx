import type { CSSProperties, ReactNode } from 'react';
import { BreadcrumbBand, type Crumb } from '@/components/nav/Breadcrumbs';
import { cn } from '@/components/ui/cn';
import { ArticleFrame, AsideSkeleton } from './ArticleFrame';
import { NEWS_HERO_HEIGHT, SPONSOR_HERO_HEIGHT } from './hero';

/*
 * The article in grey while its read is in flight (fish LoadingScreen): the same frame (the T3
 * tracks, the right column reserved from 1280), the picture header at the loaded page's height
 * (the sponsor band reads Gallery's own constant; an article's strip, whose ratio comes with the
 * article, takes its 16:9 default), the date row, the title and the text — so nothing moves when
 * the content lands. `variant="sponsor"`: the logo band, the name, the description.
 *
 * For assistive tech the skeleton is only its status and the page's <h1> («Se încarcă…»): the
 * grey frame is hidden whole (no empty article or side-column landmark). The phone keeps the
 * back chip (parity «skeleton + back»); from 768 the breadcrumb band, its current crumb pending.
 */
export function ArticleSkeleton({
  variant = 'news',
  label,
  trail,
  back,
}: {
  variant?: 'news' | 'sponsor';
  label: string;
  /** The loaded page's parents (Noutăți / Acasă); the current crumb is a placeholder. */
  trail: Crumb[];
  /** Phone: the back chip (DetailBackButton), where the loaded page has it. */
  back: ReactNode;
}) {
  const bar = 'block animate-shimmer rounded-full';
  return (
    <div aria-busy="true" className="relative">
      <p role="status" className="sr-only">
        {label}
      </p>
      <h1 className="sr-only">{label}</h1>
      <BreadcrumbBand trail={trail} pendingCurrent />
      <div className="relative">
        <div className="absolute top-4 left-4 z-above md:hidden">{back}</div>
        <div aria-hidden>
          <ArticleFrame
            hero={
              <span
                className={cn('block animate-shimmer', variant === 'sponsor' ? SPONSOR_HERO_HEIGHT : NEWS_HERO_HEIGHT)}
                style={variant === 'sponsor' ? undefined : ({ '--strip-ratio': String(16 / 9) } as CSSProperties)}
              />
            }
            asideLabel="Se încarcă"
            asideBelowXl="hidden"
            aside={<AsideSkeleton variant={variant === 'sponsor' ? 'tiles' : 'rows'} />}
          >
            {variant === 'news' ? (
              <span className="flex items-center gap-3 max-md:justify-between">
                <span className={`${bar} h-3 w-32`} />
                <span className="h-4.5 w-16 animate-shimmer rounded-badge" />
              </span>
            ) : null}
            <span className={`${bar} h-6 w-[80%] md:h-7`} />
            {variant === 'news' ? <span className={`${bar} h-6 w-[50%] md:h-7`} /> : null}
            <span className="mt-2 flex flex-col gap-3">
              {['w-full', 'w-[95%]', 'w-[88%]', 'w-full', 'w-[70%]'].map((w, i) => (
                <span key={i} className={`${bar} h-3.5 ${w}`} />
              ))}
            </span>
          </ArticleFrame>
        </div>
      </div>
    </div>
  );
}
