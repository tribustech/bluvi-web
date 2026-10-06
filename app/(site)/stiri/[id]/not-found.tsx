import { DetailBackButton, DetailNotFound } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { MarkNotFound } from '../../_shell/SiteHeader';
import { NEWS_CRUMB } from '../_content/crumbs';

/*
 * An unknown article id (fish: `!news` → ErrorScreen with back). A SOFT 404 + noindex: with Cache
 * Components the static shell streams first, so the 200 is committed before notFound() (checked
 * 2026-10-05 with loading.tsx removed: still 200; a real 404 needs a proxy.ts check). The T3
 * not-found card: what is missing and the way on — Noutăți; the phone keeps the back chip, from
 * 768 the band (Noutăți / «Pagină inexistentă»), as loading and error have theirs.
 */
export default function NewsItemNotFound() {
  return (
    <>
      <MarkNotFound />
      <DetailNotFound
        title="Știrea nu a fost găsită"
        description="Poate a fost ștearsă sau linkul e greșit. Găsești toate noutățile pe pagina lor."
        href={routes.news()}
        cta="Vezi noutățile"
        trail={[NEWS_CRUMB]}
        back={<DetailBackButton fallbackHref={routes.news()} ground="page" />}
      />
    </>
  );
}
