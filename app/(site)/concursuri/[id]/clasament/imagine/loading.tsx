import { DetailBackButton, DetailBand, DetailBody, DetailHeader, DetailPage, DetailSection } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { ImageViewerSkeleton } from './RankingImageScreen';

/*
 * While the competition is read (c6): the image page's own frame, never the competition shell's —
 * the T3 whole-page-state contract (DetailStates): the header with its real <h1> («Imagine
 * clasament» is the loaded title too), the phone's back chip and the two action chips, bones where
 * the competition and the table's name go, and the stage's skeleton with its zoom toolbar. The
 * breadcrumb band from 768 is the shell's, its current crumb a placeholder until the page names it.
 */

const BONE = 'relative inline-block align-top';
const BAR = 'absolute inset-x-0 top-1/2 h-[0.62em] -translate-y-1/2 animate-shimmer rounded-full';

function Word({ className }: { className: string }) {
  return (
    <span aria-hidden className={`${BONE} ${className}`}>
      &nbsp;
      <span className={BAR} />
    </span>
  );
}

function Chip({ className }: { className: string }) {
  return <span aria-hidden className={`block shrink-0 animate-shimmer rounded-control ${className}`} />;
}

export default function Loading() {
  return (
    <DetailPage phoneGround="surface">
      <div aria-busy="true">
        <p role="status" className="sr-only">
          Se încarcă concursul…
        </p>
        <DetailBand>
          <DetailHeader
            title="Imagine clasament"
            eyebrow={<Word className="w-40" />}
            meta={[
              <span key="v" className="flex flex-col">
                <Word className="w-36 md:hidden" />
                <Word className="w-28 md:w-48" />
              </span>,
            ]}
            phoneStart={<DetailBackButton fallbackHref={routes.competitions()} label="Înapoi la clasament" />}
            phoneEnd={
              <span className="flex gap-2">
                <Chip className="size-12" />
                <Chip className="size-12" />
              </span>
            }
            actions={
              <>
                <Chip className="h-12 w-36 xl:h-10 xl:w-56" />
                <Chip className="h-12 w-36 xl:h-10 xl:w-56" />
              </>
            }
          />
        </DetailBand>
        <DetailBody>
          <DetailSection tone="plain">
            <ImageViewerSkeleton tableHref={routes.competitions()} />
          </DetailSection>
        </DetailBody>
      </div>
    </DetailPage>
  );
}
