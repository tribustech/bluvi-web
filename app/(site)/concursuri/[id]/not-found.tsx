import { DetailNotFound } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { MarkNotFound } from '../../_shell/SiteHeader';

/*
 * An unknown competition id. A SOFT 404: loading.tsx's Suspense boundary has already committed the
 * 200 when page.tsx calls `notFound()` (and production serves non-prerendered ids from the shell),
 * so the answer is this UI + `noindex` with HTTP 200; a real 404 needs an existence check in
 * proxy.ts (page.tsx). The T3 not-found card: what is missing and
 * the way on. The competitions list (/concursuri) is not a page yet, so the way on is Acasă, where
 * the live and upcoming competitions are. MarkNotFound keeps the bar from highlighting a section
 * and drops the breadcrumb band (its «Competiții» parent would be a dead link).
 */
export default function CompetitionNotFound() {
  return (
    <>
      <MarkNotFound />
      <DetailNotFound
        title="Concursul nu a fost găsit"
        description="Poate a fost șters sau linkul e greșit. Găsești concursurile live și pe cele viitoare pe pagina principală."
        href={routes.home()}
        cta="Mergi la Acasă"
      />
    </>
  );
}
