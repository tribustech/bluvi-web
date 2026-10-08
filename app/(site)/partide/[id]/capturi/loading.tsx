import { ListPage } from '@/components/templates/T1';
import { CatchesBodySkeleton } from './_list/CatchesSkeleton';
import { LoadingHeader } from './_list/LoadingHeader';

/*
 * While the partidă and its first catches page are read (parity partide.spectator-capturi.c4; fish
 * CatchListSkeleton): the real title row («Capturi», the way back) over the list skeleton.
 */
export default function PartidaCatchesLoading() {
  return (
    <ListPage header={<LoadingHeader />}>
      <CatchesBodySkeleton />
    </ListPage>
  );
}
