import { DetailNotFound } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { SiteShell } from '../../../(site)/_shell/SiteShell';

/*
 * The T3 demo's not-found: what a T3 route renders when its main read answers 404 (`notFound()` in
 * page.tsx — data.ts isNotFound), instead of the retryable page error. The demo's screen lives in
 * the query string, which this file cannot read, so the copy is the generic one; a real route's
 * not-found names its thing («Balta nu a fost găsită.», ?state=not-found). Inside the same
 * SiteShell as page.tsx (skip link, top bar, <main>).
 */
export default function T3NotFound() {
  return (
    <SiteShell>
      <DetailNotFound
        title="Pagina nu a fost găsită."
        description="Poate a fost ștearsă sau linkul e greșit."
        href={routes.home()}
        cta="Mergi la Acasă"
      />
    </SiteShell>
  );
}
