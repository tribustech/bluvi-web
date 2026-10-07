import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../_shell/SiteHeader';
import { RankingFallback } from './_ranking/RankingScreen';

/** fish ClasamentSkeleton under the page's real header (partide.clasament c8). */
export default function Loading() {
  return (
    <>
      <SetBreadcrumb trail={[{ label: 'Partide', href: routes.partide() }, { label: 'Clasamente' }]} />
      <RankingFallback />
    </>
  );
}
