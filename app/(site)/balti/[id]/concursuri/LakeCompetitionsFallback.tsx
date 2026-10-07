import { ListHeader, ListPage, TabsSkeleton } from '@/components/templates/T1';
import { routes } from '@/lib/routes';
import { FallbackHeader, TitleShimmer } from '../_sub/FallbackHeader';
import { CardsSkeleton } from './LakeCompetitionsScreen';
import { LAKE_COMPETITIONS_CAPTION } from './tabs';

/**
 * The lake competitions' frame while the tab is read: the header (the lake's name, or its shimmer,
 * over the «Concursuri» caption — the page's own, so nothing shifts when it lands), the three tabs,
 * the cards' own bones.
 */
export function LakeCompetitionsFallback({ lakeName, lakeId }: { lakeName?: string; lakeId?: string }) {
  const below = <TabsSkeleton count={3} />;
  return (
    <div aria-busy>
      <ListPage
        header={
          lakeId ? (
            <ListHeader
              title={lakeName ?? <TitleShimmer srLabel="Concursuri" />}
              description={LAKE_COMPETITIONS_CAPTION}
              back={{ label: 'Înapoi', href: routes.lake(lakeId) }}
              below={below}
            />
          ) : (
            <FallbackHeader title={<TitleShimmer srLabel="Concursuri" />} description={LAKE_COMPETITIONS_CAPTION} below={below} />
          )
        }
      >
        <CardsSkeleton />
      </ListPage>
    </div>
  );
}
