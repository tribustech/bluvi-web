import { DetailBackButton, DetailNotFound } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { MarkNotFound } from '../../_shell/SiteHeader';

/*
 * An unknown angler (GET /feed/anglers/:id → 404 ANGLER:NOT_FOUND, signed in; parity
 * account.b.deep-link-angler): the T3 not-found card with the way home — never a blank page. A soft
 * 404 (the header is read in the browser): the UI plus the page's own `noindex`.
 */
export default function AnglerNotFound() {
  return (
    <>
      <MarkNotFound />
      <DetailNotFound
        back={<DetailBackButton fallbackHref={routes.home()} ground="page" />}
        title="Pescarul nu a fost găsit"
        description="Poate și-a șters contul sau linkul e greșit."
        href={routes.home()}
        cta="Mergi acasă"
      />
    </>
  );
}
