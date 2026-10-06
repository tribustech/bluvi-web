import { ListPage } from '@/components/templates/T1';
import { FallbackHeader } from './FallbackHeader';
import { MasonrySkeleton } from './Masonry';

/*
 * galerie / capturi while the lake and the first catches page are read: the same T1 ListPage and
 * header the screens render (title, the subtitle line as a shimmer, the back square), then the
 * masonry skeleton — fish shows the header at once and GalleryMasonrySkeleton under it. As
 * RankingFallback / StandsFallback.
 */
export function GalleryFallback({ title, filters = false, label }: { title: string; filters?: boolean; label?: string }) {
  return (
    <div aria-busy>
      <ListPage header={<FallbackHeader title={title} description={<span aria-hidden className="inline-block h-3 w-44 animate-shimmer rounded-full align-middle" />} />}>
        {filters ? (
          <div aria-hidden className="flex w-fit max-w-full gap-2 rounded-card bg-surface p-1.5 shadow-e0">
            {['w-16', 'w-24', 'w-40'].map(w => (
              <span key={w} className={`h-9 animate-shimmer rounded-full ${w}`} />
            ))}
          </div>
        ) : null}
        <MasonrySkeleton label={label} />
      </ListPage>
    </div>
  );
}
