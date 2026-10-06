import { DetailBackButton, DetailNotFound } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { MarkNotFound } from '../../_shell/SiteHeader';

/*
 * An unknown lake id (parity lakes.detail.c2): the T3 not-found card — what is missing and the
 * way on, the lakes list. A soft 404 (page.tsx): the UI + `noindex`. MarkNotFound keeps the bar
 * from highlighting a section and drops the breadcrumb band.
 */
export default function LakeNotFound() {
  return (
    <>
      <MarkNotFound />
      <DetailNotFound
        back={<DetailBackButton fallbackHref={routes.lakes()} ground="page" />}
        title="Balta nu a fost găsită"
        description="Poate a fost ștearsă sau linkul e greșit. Caut-o în lista de bălți."
        href={routes.lakes()}
        cta="Vezi bălțile"
      />
    </>
  );
}
