import { DetailBackButton } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { ArticleSkeleton } from '../../stiri/_content/ArticleSkeleton';
import { HOME_CRUMB } from '../../stiri/_content/crumbs';

/** fish sponsors/[sponsorId].tsx `if (isLoading) return <LoadingScreen />` — the page's frame in grey. */
export default function SponsorLoading() {
  return (
    <ArticleSkeleton
      variant="sponsor"
      label="Se încarcă sponsorul…"
      trail={[HOME_CRUMB]}
      back={<DetailBackButton fallbackHref={routes.home()} ground="page" />}
    />
  );
}
