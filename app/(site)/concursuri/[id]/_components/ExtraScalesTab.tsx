'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { CheckCircleIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { extraScaleStand, extraScaleState, formatCount, type CompetitionWithMyStatus, type ExtraScale } from '@/core/competitions';
import { extraScalesListQuery } from '@/core/organizer';
import type { Transport } from '@/core/transport';
import { ScaleIcon } from '@/components/icons/brand';
import { CardShell } from '@/components/cards';
import { ErrorState } from '@/components/surfaces/StateCard';
import { listGridClass } from '@/components/templates/T1';
import { DetailAsideCard, DetailBody, DetailSection, DetailSectionState } from '@/components/templates/T3';
import { STATE_CARD_FRAME } from '@/components/templates/stateCard';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../_shell/Toast';
import { dayMonthTime, timeAgo } from './dates';
import { isOfflineEmpty, OfflineState } from './offline';
import { QueryRetry } from './QueryRetry';
import { LIVE_POLL_MS, PAGE_RETRY } from './retry-policy';
import { StackedFacts } from './infoParts';
import { nationalStandLabel } from './stand';
import { Bone } from './tabParts';

/*
 * Concurs · Extra Cântare — fish components/CompetitionExtraScales.tsx + ScaleItem.tsx (parity
 * competition-page.extra-cantare). The list is the public, edge-cached
 * /competitions/:id/extra-scale, read in the browser (its «acum 5 minute» is the reader's clock).
 *
 * Before the start the explanation («După începerea competiției…») — known on the server, so the
 * list is not read and the skeleton is already that card (fish checks loading and error first and
 * reads the list anyway: a failed read there showed an error in place of the explanation). Then an
 * empty list, or the requests — an auto-fill grid of cards (more per row as the screen grows, never
 * wider cards: the kit T1 grid, kit CardShell cards). While running the list is re-read every
 * LIVE_POLL_MS (b.live-refresh); a re-read that fails after a first answer keeps the list and says
 * so under the title, with the page's retry.
 *
 * From 1280 a right column (ROADMAP §4 — the grid keeps the centre): «Cum funcționează», and with a
 * list its counts; the list's title is the plain header the Clasament tab uses. Below 1280 the
 * column is not shown (the count is the title's description).
 *
 * A request opens the stand's weighings. fish goes to the scale area's stand history
 * (/scale/[id]/history, M6 on the web); until then the web opens the Clasament's Cântare view on
 * that stand (routes.competitionWeighings), which lists the same weighings.
 *
 * The stand label: «Sector B Stand 12», or — national championship only (fish passes isNc for
 * `rankingType === 'nationalChampionship'`, not fipsed) — fish formatNationalStand's bare «B3(12)».
 *
 * Web differences: «Finalizat la» shows when the request was closed (`updatedAt`; fish prints
 * `createdAt`, the request time, under that label — a fish bug); a request whose account was
 * deleted shows «Cont șters» (fish would crash on the missing author); copy carries diacritics; a
 * done request keeps ink text and its chevron (it still opens the stand: fish greys it like a
 * disabled row), «done» is the grey icon and a check by «Finalizat la».
 */

/** The kit grid (T1, 280px cards) — the phone's rows edge to edge, 8px apart. */
const GRID = cn(listGridClass('md'), 'max-md:-mx-4 max-md:gap-2');
/** A card's row (inside CardShell; the phone's edge-to-edge row has no radius or shadow). */
const ROW = 'flex min-h-16 items-center gap-3 px-4 py-3';
const SHELL = 'max-md:rounded-none max-md:shadow-none!';
const NO_STAND_DATA = 'Nu există suficiente date pentru a deschide acest stand';
export const LIST_TITLE = 'Cereri de extra cântar';
/**
 * An error / offline row in the state cards' frame (720, centred — as the empty and not-started
 * states), full-bleed on the phone like them (no rounded card touching the screen edges).
 */
const STATE_ROW = cn(STATE_CARD_FRAME, 'max-md:rounded-none');

export function ExtraScalesTab({ t, competition }: { t: Transport; competition: CompetitionWithMyStatus }) {
  const id = competition.documentId;
  const status = competition.competitionStatus;
  // Before the start the answer is known on the server (the explanation): the list is not read. While
  // running it is re-read as the Clasament's live parts are (b.live-refresh; paused in a hidden tab).
  const q = useQuery({
    ...extraScalesListQuery(t, id),
    ...PAGE_RETRY,
    enabled: status !== 'notStarted',
    refetchInterval: status === 'started' ? LIVE_POLL_MS : false,
  });
  const isNc = competition.rankingType === 'nationalChampionship';
  const now = useNow();
  const failedOnce = !q.data && q.errorUpdatedAt > 0;

  let body;
  if (status === 'notStarted') {
    body = <NotStartedState />;
  } else if (isOfflineEmpty(q)) {
    body = <OfflineState className={STATE_ROW} onRetry={() => void q.refetch()} fetching={q.isFetching} />;
  } else if (q.isPending && !failedOnce) {
    // The loaded list's frame (title, count, the same cards, the right column), so nothing moves when it lands.
    return (
      <DetailBody aside={<HowItWorks />} asideLabel="Despre extra cântare" asideBelowXl="hidden">
        <DetailSection tone="plain" title={LIST_TITLE} description={<Bone className="w-24 t-caption" />}>
          <div aria-busy="true">
            <p role="status" className="sr-only">
              Se încarcă cererile de extra cântar…
            </p>
            <ExtraScaleBones />
          </div>
        </DetailSection>
      </DetailBody>
    );
  } else if (failedOnce) {
    // Kept while the retry runs (TanStack puts a data-less query back to pending on refetch), so
    // QueryRetry stays busy and can say «Tot nu s-a putut încărca.».
    // fish ErrorScreen without a back button: the page around it stands, the retry re-reads the list.
    body = (
      <ErrorState
        className={STATE_ROW}
        title="Cererile de extra cântar nu au putut fi încărcate."
        description="Verifică conexiunea și încearcă din nou."
        action={<QueryRetry fetching={q.isFetching} failed onRetry={() => void q.refetch()} size="compact" />}
      />
    );
  } else if (!q.data?.length) {
    body = <DetailSectionState icon={<StateIcon />} heading="Nu există nicio cerere de extra cântar." />;
  } else {
    const done = q.data.filter(s => extraScaleState(s, status).completed).length;
    const open = q.data.length - done;
    // A re-read that failed after the list had loaded: the list stays, and says it may be stale.
    const stale = q.isError;
    return (
      <DetailBody
        aside={
          <>
            <HowItWorks />
            <DetailAsideCard title="Pe scurt">
              <StackedFacts
                facts={[
                  { key: 'total', label: 'Cereri', value: q.data.length },
                  ...(status !== 'completed' ? [{ key: 'open', label: 'În așteptare', value: open }] : []),
                  { key: 'done', label: 'Finalizate', value: done },
                ]}
              />
            </DetailAsideCard>
          </>
        }
        asideLabel="Despre extra cântare"
        asideBelowXl="hidden"
      >
        <DetailSection
          tone="plain"
          title={LIST_TITLE}
          description={
            <>
              {formatCount(q.data.length, 'cerere', 'cereri') +
                (open > 0 && status !== 'completed' ? ` · ${open} în așteptare` : '')}
              {stale ? (
                <span role="alert" className="mt-1 flex flex-wrap items-center gap-x-2 text-ink-2">
                  Lista nu s-a putut actualiza.
                  <QueryRetry fetching={q.isFetching} failed onRetry={() => void q.refetch()} size="compact" />
                </span>
              ) : null}
            </>
          }
        >
          <ul className={GRID}>
            {q.data.map(scale => (
              <li key={scale.documentId}>
                <RequestItem scale={scale} competitionId={id} status={status} isNc={isNc} now={now} />
              </li>
            ))}
          </ul>
        </DetailSection>
      </DetailBody>
    );
  }
  return <DetailBody aside={status === 'notStarted' ? undefined : <HowItWorks />} asideLabel="Despre extra cântare" asideBelowXl="hidden">{body}</DetailBody>;
}

/**
 * The right column's explanation (≥1280): what a request is and what opening one does — fish's
 * flow (the participant's «Cere extra cântar» in the ranking's action bar, the request listed here
 * until it is closed). Also in the tab's skeleton (CompetitionSkeleton TabBones).
 */
export function HowItWorks() {
  return (
    <DetailAsideCard title="Cum funcționează">
      <div className="flex flex-col gap-2 t-body text-ink-2">
        <p>În timpul concursului, un participant poate cere un extra cântar din bara de acțiuni a clasamentului.</p>
        <p>Cererile rămân în listă și după ce sunt finalizate. Apasă pe o cerere pentru a vedea cântarele standului.</p>
      </div>
    </DetailAsideCard>
  );
}

/** extra-cantare.c2: before the start (also the tab's skeleton then — CompetitionSkeleton TabBones). */
export function NotStartedState() {
  return (
    <DetailSectionState
      icon={<StateIcon />}
      heading="Extra cântarele încep odată cu competiția"
      description="După începerea competiției, cererile pentru extra cântar vor fi afișate în această secțiune."
    />
  );
}

/** The list's bones: the loaded grid's cards (also the tab's skeleton — CompetitionSkeleton TabBones). */
export function ExtraScaleBones() {
  return (
    <ul aria-hidden className={GRID}>
      {[0, 1, 2, 3].map(i => (
        <li key={i} data-bone="card" className={cn(ROW, 'rounded-card bg-surface shadow-e0 max-md:rounded-none max-md:shadow-none')}>
          <span className="size-6 shrink-0 animate-shimmer rounded-control" />
          <span className="flex min-w-0 flex-1 flex-col">
            <Bone className="w-32 t-body-strong" />
            <Bone className="w-24 t-caption" />
          </span>
          <Bone className="w-20 t-caption" />
        </li>
      ))}
    </ul>
  );
}

function StateIcon() {
  return (
    <span className="flex size-12 items-center justify-center rounded-full bg-accent-tint text-accent-ink">
      <ScaleIcon size={24} />
    </span>
  );
}

/** The reader's clock, ticking every 30 s (null on the server render: the relative times wait for it). */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);
  return now;
}

/** fish ScaleItem. */
function RequestItem({
  scale,
  competitionId,
  status,
  isNc,
  now,
}: {
  scale: ExtraScale;
  competitionId: string;
  status: string;
  isNc: boolean;
  now: Date | null;
}) {
  const toast = useSiteToast();
  const { completed, disabled } = extraScaleState(scale, status);
  const stand = extraScaleStand(scale);
  const sectorName = scale.stand?.sectors[0]?.name;
  const standName = scale.stand?.name;
  const label = isNc ? nationalStandLabel(sectorName, scale.stand?.sectorDrawPosition ?? null, standName ?? '') : `Sector ${sectorName || '-'} Stand ${standName || '-'}`;
  const when = completed ? dayMonthTime(scale.updatedAt ?? scale.createdAt ?? '') : now && scale.createdAt ? timeAgo(scale.createdAt, now) : null;

  // A done request stays a readable, navigable row (it opens the stand's weighings): ink text, the
  // grey icon and a check say «done»; only a row that cannot open (no stand data) is muted.
  const inert = !stand;
  const content = (
    <>
      <ScaleIcon size={24} className={cn('shrink-0', disabled ? 'text-muted' : 'text-status-danger-fg')} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('t-body-strong', inert ? 'text-muted' : 'text-ink')}>{label}</span>
        <span className={cn('truncate t-caption', inert ? 'text-muted' : 'text-ink-2')}>{scale.author?.username ?? 'Cont șters'}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        {completed ? (
          <span className="flex flex-col items-end text-right t-caption">
            <span className="flex items-center gap-1 text-muted">
              <CheckCircleIcon aria-hidden className="size-4" />
              Finalizat la
            </span>
            <span className="text-ink-2 tabular-nums">{when}</span>
          </span>
        ) : when ? (
          <span className={cn('t-caption', inert ? 'text-muted' : 'text-ink-2')}>{when}</span>
        ) : (
          <Bone className="w-20 t-caption" />
        )}
        {inert ? null : <ChevronRightIcon aria-hidden className="size-5 text-muted" />}
      </span>
    </>
  );
  // The card is the kit CardShell (its hover lift from 768); the phone's edge-to-edge row tints.
  const className = cn(
    ROW,
    'w-full cursor-pointer text-left transition-colors duration-(--duration-fast) ease-fast max-md:hover:bg-soft-fill',
    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
  );
  const name = `${label}, ${scale.author?.username ?? 'Cont șters'}${completed ? `, finalizat la ${when}` : when ? `, ${when}` : ''}`;
  return (
    <CardShell interactive className={SHELL}>
      {!stand ? (
        <button type="button" aria-label={name} className={className} onClick={() => toast(NO_STAND_DATA, 'danger')}>
          {content}
        </button>
      ) : (
        <Link href={routes.competitionWeighings(competitionId, stand.standId)} aria-label={`${name}: vezi cântarele standului`} className={className}>
          {content}
        </Link>
      )}
    </CardShell>
  );
}
