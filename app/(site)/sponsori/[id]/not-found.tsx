import { DetailBackButton, DetailNotFound } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { MarkNotFound } from '../../_shell/SiteHeader';
import { HOME_CRUMB } from '../../stiri/_content/crumbs';

/*
 * An unknown sponsor id (fish: `!sponsor` → ErrorScreen with back). A soft 404 + noindex (see the
 * page). The way on is Acasă, where the sponsors are listed (there is no sponsors page in fish);
 * from 768 the band (Acasă / «Pagină inexistentă»), as loading and error have theirs.
 */
export default function SponsorNotFound() {
  return (
    <>
      <MarkNotFound />
      <DetailNotFound
        title="Sponsorul nu a fost găsit"
        description="Poate a fost șters sau linkul e greșit. Sponsorii Bluvi sunt pe pagina principală."
        href={routes.home()}
        cta="Mergi la Acasă"
        trail={[HOME_CRUMB]}
        back={<DetailBackButton fallbackHref={routes.home()} ground="page" />}
      />
    </>
  );
}
