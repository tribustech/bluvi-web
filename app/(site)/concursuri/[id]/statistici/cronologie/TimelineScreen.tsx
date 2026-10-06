'use client';

import { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { competitionQuery } from '@/core/competitions';
import {
  DetailBackButton,
  DetailBand,
  DetailBody,
  DetailHeader,
  DetailPage,
  DetailSection,
  DetailSectionState,
} from '@/components/templates/T3';
import { SignInGate } from '@/components/templates/SignInGate';
import { ErrorState } from '@/components/surfaces/StateCard';
import { routes } from '@/lib/routes';
import { signInHref } from '../../../../_shell/SiteHeader';
import { isUnknownViewer, useViewerState } from '../../../../_shell/viewer-context';
import { isOfflineEmpty, OfflineState } from '../../_components/offline';
import { QueryRetry } from '../../_components/QueryRetry';
import { PAGE_RETRY } from '../../_components/retry-policy';
import { StandTimeline, TimelineChartSkeleton } from '../../_components/StandTimeline';
import { pageTransport } from '../../_components/transport';
import { RefreshRetry } from '../../_components/RefreshRetry';

/*
 * The page's frame (fish stand-timeline screen: back control + «Cronologia standurilor», then the
 * chart): the T3 header in its band — the back chip on the phone only (from 768 the breadcrumb is
 * the way back, as on the competition page), the title on the page gutter; the chart in the centre
 * column; from 1280 the competition on the left (where this is) and how to read the chart on the
 * right. Every loading step is the chart's own shape (TimelineChartSkeleton), so nothing jumps.
 */

const TITLE = 'Cronologia standurilor';

function Band({ id }: { id?: string }) {
  return (
    <DetailBand>
      <DetailHeader
        title={TITLE}
        phoneStart={
          <DetailBackButton fallbackHref={id ? routes.competitionStatistics(id) : routes.competitions()} ground="surface" label="Înapoi la statistici" />
        }
      />
    </DetailBand>
  );
}

/** How to read the chart (the right column from 1280): static, so the loading page has it too. */
const ASIDE = (
  <DetailSection title="Cum citești graficul" as="h2">
    <ul className="flex list-disc flex-col gap-2 pl-5 t-body text-ink-2">
      <li>Fiecare bară este un stand, ordonat după valoarea lui la momentul ales.</li>
      <li>Trage cursorul timpului sau apasă redare ca să vezi cum s-a schimbat clasamentul.</li>
      <li>Apasă un stand ca să-l urmărești; apasă din nou ca să renunți.</li>
    </ul>
  </DetailSection>
);

/** The chart's frame (the three columns, the centre card) around the chart's loading shape. */
function ChartLoading({ label }: { label?: string }) {
  return (
    <DetailBody
      left={
        <DetailSection title="Concursul" as="h2">
          <span aria-hidden className="block h-4 w-4/5 animate-shimmer rounded-full" />
          <span aria-hidden className="mt-2 block h-3 w-3/5 animate-shimmer rounded-full" />
        </DetailSection>
      }
      aside={ASIDE}
      asideBelowXl="hidden"
    >
      <DetailSection tone="card" className="max-md:rounded-none">
        <TimelineChartSkeleton label={label} />
      </DetailSection>
    </DetailBody>
  );
}

export function TimelineScreenSkeleton({ id }: { id?: string }) {
  return (
    <DetailPage phoneGround="surface">
      <Band id={id} />
      <ChartLoading />
    </DetailPage>
  );
}

export function TimelineScreen({ id }: { id: string }) {
  return (
    <DetailPage phoneGround="surface">
      <Band id={id} />
      <Suspense fallback={<ChartLoading label="Se verifică sesiunea" />}>
        <Content id={id} />
      </Suspense>
    </DetailPage>
  );
}

function Content({ id }: { id: string }) {
  const viewer = useViewerState();
  const pathname = usePathname() ?? routes.competitionStandTimeline(id);
  const t = useMemo(() => pageTransport(), []);
  const q = useQuery({ ...competitionQuery(t, id, { isAuthenticated: false }), ...PAGE_RETRY });
  const competition = q.data;

  if (isUnknownViewer(viewer)) {
    return (
      <DetailBody>
        {/* In the section's gutter: never a card edge to edge on the phone. */}
        <DetailSection tone="plain">
          <ErrorState
            title="Nu am putut verifica sesiunea."
            description="Cronologia este pentru utilizatorii autentificați."
            action={<RefreshRetry />}
          />
        </DetailSection>
      </DetailBody>
    );
  }
  if (!viewer) {
    return (
      <DetailBody>
        <DetailSection tone="plain">
          {/* The kit's one signed-out gate, as Statistici and Statistici pescar. */}
          <SignInGate
            title="Statisticile concursului"
            description="Trebuie să fii autentificat pentru a vedea statisticile."
            icon={<LockClosedIcon />}
            href={signInHref(pathname)}
          />
        </DetailSection>
      </DetailBody>
    );
  }
  if (!competition) {
    // Offline with nothing cached: the read is paused and stays pending (offline.tsx) — never the
    // chart's bones for ever.
    if (isOfflineEmpty(q)) {
      return (
        <DetailBody>
          <DetailSection tone="plain">
            <OfflineState fetching={q.isFetching} onRetry={() => void q.refetch()} />
          </DetailSection>
        </DetailBody>
      );
    }
    return q.isError ? (
      <DetailBody>
        <DetailSection tone="plain">
          <ErrorState
            title="Concursul nu a putut fi încărcat."
            action={<QueryRetry fetching={q.isFetching} failed onRetry={() => void q.refetch()} size="compact" />}
          />
        </DetailSection>
      </DetailBody>
    ) : (
      <ChartLoading label="Se încarcă concursul" />
    );
  }

  // fish draws nothing for these (no weighing can exist yet, or the competition is off): the page
  // says so instead of an empty column.
  if (['draft', 'notStarted', 'cancelled'].includes(competition.competitionStatus ?? '')) {
    return (
      <DetailBody>
        <DetailSectionState
          heading="Cronologia apare după primul cântar."
          description={competition.competitionStatus === 'cancelled' ? 'Concursul a fost anulat.' : 'Concursul nu a început încă.'}
        />
      </DetailBody>
    );
  }

  return (
    <DetailBody
      left={
        <DetailSection title="Concursul" as="h2">
          <p className="t-body-strong text-ink">{competition.name}</p>
          {competition.lake?.name ? <p className="t-caption text-muted">{competition.lake.name}</p> : null}
          <Link href={routes.competitionStatistics(id)} className="mt-3 inline-block rounded-control t-label text-accent-ink hover:underline">
            Toate statisticile →
          </Link>
        </DetailSection>
      }
      aside={ASIDE}
      asideBelowXl="hidden"
    >
      <DetailSection tone="card" className="max-md:rounded-none">
        <StandTimeline t={t} competition={competition} variant="page" />
      </DetailSection>
    </DetailBody>
  );
}
