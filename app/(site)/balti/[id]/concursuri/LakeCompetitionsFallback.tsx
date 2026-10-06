import { ListHeader, ListPage, TabsSkeleton } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { FallbackHeader, TitleShimmer } from '../_sub/FallbackHeader';
import { CardsSkeleton } from './LakeCompetitionsScreen';

/**
 * The lake competitions' frame while the tab is read: the header (the lake's name, or its shimmer
 * — c1 has no «Concursuri» title to swap out), the three tabs, the cards' own bones.
 */
export function LakeCompetitionsFallback({ lakeName, lakeId }: { lakeName?: string; lakeId?: string }) {
  const below = <TabsSkeleton count={3} />;
  return (
    <div aria-busy>
      <ListPage
        header={
          lakeId ? (
            <ListHeader title={lakeName ?? <TitleShimmer srLabel="Concursuri" />} back={{ label: 'Înapoi', href: routes.lake(lakeId) }} below={below} />
          ) : (
            <FallbackHeader title={<TitleShimmer srLabel="Concursuri" />} below={below} />
          )
        }
      >
        <CardsSkeleton />
      </ListPage>
    </div>
  );
}
