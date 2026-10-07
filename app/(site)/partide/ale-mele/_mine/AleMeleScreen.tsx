'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { RailArrows, RailRegistry, type RailHandle } from '@/app/(site)/_home/HorizontalRail';
import { ActivePartidaCard, ActivePartidaDock } from '@/components/partide/ActivePartidaDock';
import { CatchLightbox } from '@/components/partide/CatchLightbox';
import { NoActiveCta } from '@/components/partide/community/NoActiveCta';
import { useNowTick } from '@/components/partide/community/useNowTick';
import { JournalBento, JournalStatistics, JournalStatStrip } from '@/components/partide/own/JournalStatCard';
import { MyCatchesRail } from '@/components/partide/own/MyCatchesRail';
import { OwnPartidaCard } from '@/components/partide/own/OwnPartidaCard';
import { FishingRodIcon } from '@/components/icons/brand';
import { SignInGate } from '@/components/templates/SignInGate';
import { STATE_CARD_FRAME } from '@/components/templates/stateCard';
import { T2Spinner } from '@/components/templates/T2';
import { DashboardEmpty, DashboardError, DashboardLayout, DashboardSection } from '@/components/templates/T5';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { myCatchesInfiniteQuery, partideHistoryQuery, type SessionDetailDTO } from '@/core/partide';
import type { AnglerCatch } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { partideHrefs, signedInHref } from '@/lib/partide-pages';
import { routes } from '@/lib/routes';
import { partideServerClock, usePartideViewer } from '../../_hub/activePartida';
import { AleMeleSkeleton } from './AleMeleSkeleton';
import { aleMeleView } from './view';

/*
 * Partide · Ale mele — fish app/(app)/(tabs)/partide.tsx (sub-tab «alemele») + scenes/AleMeleScene.tsx
 * (parity partide.ale-mele c1–c17), template T5, under the hub's chrome (read as is).
 *
 * Per user and client-side only (/api/cms with the session cookie): the own-sessions list
 * (partideHistoryQuery — every page of /feed/sessions/mine, staleTime 5 min; this page is the tab,
 * so it is read only here, c2) and MY catches (myCatchesInfiniteQuery — /feed/sessions/mine/catches,
 * so partide hidden from the profile still show, c9). The live partidă is the hub's CMS probe
 * (usePartideViewer): it is left out of the rendered lists (the dock / its card shows it) and still
 * counted in the figures (c17). An open partidă that is not the live one is «În desfășurare» (c14),
 * read from the same REST list.
 *
 * States: a guest gets the in-page wall (c1); while the session, the probe or the first list is read
 * the skeleton (c3); a background refetch adds «Se actualizează…» over the content (c4); nothing at
 * all is the empty journal (c6); a failed first read is an error card with a retry (owner rule 4:
 * never an empty journal we are not sure of).
 *
 * Layout: below 1280 fish's single column — the hero (no live partidă, c7), the stat card, the
 * catches rail, «Statistici», «În desfășurare», «Istoric partide» — with the dock pinned while a
 * partidă runs. From 1280 the hero (or the live partidă's card) takes the left column, and the stat
 * card and «Statistici» become one bento leading the centre (owner rules 9, 19).
 */

/** The hero has something to offer only with start or join on the web (fish's hero always has both). */
const HERO_ON = partideHrefs.start() != null || partideHrefs.join() != null;

const EMPTY_ROWS: never[] = [];

export function AleMeleScreen() {
  const viewer = usePartideViewer();
  if (viewer.kind === 'pending') return <AleMeleSkeleton />;
  if (viewer.kind === 'guest') return <SignInWall />;
  return <Journal active={viewer.active} />;
}

/**
 * c1 — fish AleMeleSignInWall: the journal's own words, «Autentifică-te» back to this tab. c7 — fish
 * renders the hero above the wall with no auth check (partide.tsx `showTopSlot && !activeSession`):
 * a guest gets it too, each action through sign-in (as on Comunitate), in the same places as a
 * viewer's (above the wall below 1280, the left column from 1280).
 */
function SignInWall() {
  const wall = (
    <div data-testid="ale-mele-wall">
      <SignInGate
        title="Jurnalul tău de pescuit"
        description="Autentifică-te pentru a-ți vedea partidele, capturile și statisticile într-un singur loc."
        cta="Autentifică-te"
        href={routes.signIn(routes.partideMine())}
        icon={<FishingRodIcon />}
      />
    </div>
  );
  if (!HERO_ON) return wall;
  const guestHero = (layout: 'mobile' | 'desktop') => (
    <NoActiveCta layout={layout} start={signedInHref(partideHrefs.start(), false)} join={signedInHref(partideHrefs.join(), false)} />
  );
  return (
    <DashboardLayout
      sidesBelowXl="hidden"
      contextLabel="Partida mea"
      context={guestHero('desktop')}
      main={
        <>
          <div className="contents xl:hidden">{guestHero('mobile')}</div>
          {wall}
        </>
      }
    />
  );
}

function Journal({ active }: { active: SessionDetailDTO | null | 'failed' | 'pending' }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const history = useQuery(partideHistoryQuery(t));
  const catchesQ = useInfiniteQuery(myCatchesInfiniteQuery(t));
  const now = useNowTick();
  const [lightbox, setLightbox] = useState<number | null>(null);
  // «Capturile mele»'s rail, for its previous / next arrows in the section header (fine pointers).
  const [rail, setRail] = useState<RailHandle | null>(null);

  const live = active && typeof active === 'object' ? active : null;
  const rows = history.data?.data ?? EMPTY_ROWS;
  const view = useMemo(() => aleMeleView(rows, live?.documentId ?? null, new Date()), [rows, live?.documentId]);

  // fish dedupeByKey over every loaded page (c9).
  const catches = useMemo(() => {
    const seen = new Set<string>();
    const out: AnglerCatch[] = [];
    for (const c of (catchesQ.data?.pages ?? []).flatMap(p => p.data)) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      out.push(c);
    }
    return out;
  }, [catchesQ.data]);
  const catchesTotal = catchesQ.data?.pages[0]?.meta.pagination.total ?? catches.length;

  // c3 — the first list (or the probe) in flight with nothing cached: the skeleton, never zeros.
  if (history.isPending || active === 'pending') {
    if (history.isError) return <HistoryError onRetry={() => void history.refetch()} />;
    return <AleMeleSkeleton />;
  }
  if (history.isError && !history.data) return <HistoryError onRetry={() => void history.refetch()} />;

  const refetching = history.isFetching && !history.isPending;
  const hero = !live && active !== 'failed' && HERO_ON;
  const heroFor = (layout: 'mobile' | 'desktop') => (
    <NoActiveCta layout={layout} start={partideHrefs.start()} join={partideHrefs.join()} />
  );
  const liveCard = live ? (
    <ActivePartidaCard
      session={live}
      clock={partideServerClock}
      href={partideHrefs.partida(live.documentId)}
      captureHref={partideHrefs.capture(live.documentId)}
      headingId="ale-mele-partida-activa"
    />
  ) : null;
  const context = liveCard ?? (hero ? heroFor('desktop') : null);

  const historyHref = partideHrefs.history();
  const sections: ReactNode = view.isEmpty ? (
    // c6 — the empty journal; every section below is hidden.
    <div data-testid="empty-journal">
      <DashboardEmpty
        icon={<FishingRodIcon size={48} />}
        title="Jurnalul tău de pescuit"
        description="Începe prima partidă ca să-ți urmărești capturile, cronometrele și tiparele."
      />
    </div>
  ) : (
    <>
      {/* c8–c10 — only when the server feed has catches. */}
      {catches.length > 0 ? (
        <DashboardSection variant="plain" title="Capturile mele" action={<RailArrows rail={rail} />}>
          <RailRegistry.Provider value={setRail}>
            <MyCatchesRail catches={catches} now={now} onOpen={setLightbox} seeAllHref={partideHrefs.myCatches()} />
          </RailRegistry.Provider>
        </DashboardSection>
      ) : null}
      <div className="contents xl:hidden">
        <DashboardSection variant="plain" title="Statistici">
          <JournalStatistics monthly={view.monthly} />
        </DashboardSection>
      </div>
      {view.open.length > 0 ? (
        <section aria-labelledby="ale-mele-open" data-testid="open-section">
          <h2 id="ale-mele-open" className="mb-2.5 ms-1 t-label tracking-[0.7px] text-muted uppercase">
            În desfășurare
          </h2>
          <CardGrid>
            {view.open.map(e => (
              <OwnPartidaCard key={e.session.clientId} session={e.session} agg={e.agg} now={now} continuable />
            ))}
          </CardGrid>
        </section>
      ) : null}
      {/* c15 — fish keeps the bare header when only open partide exist; the web leaves out a
          heading with nothing under it and no link (an orphan title reads as a broken section). */}
      {view.preview.length > 0 || view.open.length === 0 || historyHref ? (
        <DashboardSection
          variant="plain"
          title="Istoric partide"
          action={historyHref ? { href: historyHref, label: 'Vezi tot', srLabel: 'Vezi tot istoricul partidelor' } : undefined}
        >
          {view.preview.length > 0 ? (
            <CardGrid testId="history-preview">
              {view.preview.map(e => (
                <OwnPartidaCard key={e.session.clientId} session={e.session} agg={e.agg} now={now} />
              ))}
            </CardGrid>
          ) : view.open.length === 0 ? (
            <p className="py-5 text-center t-body-strong text-ink-2" data-testid="no-finished">
              Nicio partidă încheiată încă.
            </p>
          ) : null}
        </DashboardSection>
      ) : null}
    </>
  );

  return (
    <>
      <DashboardLayout
        sidesBelowXl="hidden"
        contextLabel="Partida mea"
        context={context ?? undefined}
        main={
          <>
            {hero ? <div className="contents xl:hidden">{heroFor('mobile')}</div> : null}
            {refetching ? (
              // c4 — fish's spinner row over the content during a background refetch.
              <p role="status" className="-mb-1 flex items-center gap-1.75 t-caption text-muted" data-testid="refetch-row">
                <T2Spinner className="size-4 text-accent" />
                Se actualizează…
              </p>
            ) : null}
            {/* c5 — the flat stat card (every width while the journal is empty; below 1280 otherwise). */}
            {view.isEmpty ? (
              // The empty journal is one centred column at every width: the zeros above its card.
              <div className={cn(STATE_CARD_FRAME, 'w-full')}>
                <JournalStatStrip stats={view.stats} />
              </div>
            ) : (
              <div className="contents xl:hidden">
                <JournalStatStrip stats={view.stats} />
              </div>
            )}
            {view.isEmpty ? null : (
              <div className="contents max-xl:hidden">
                <DashboardSection variant="plain" title="Statistici">
                  <JournalBento stats={view.stats} monthly={view.monthly} />
                </DashboardSection>
              </div>
            )}
            {sections}
          </>
        }
      />
      <CatchLightbox
        catches={catches}
        total={catchesTotal}
        index={lightbox}
        onIndex={setLightbox}
        onEndReached={() => {
          if (catchesQ.hasNextPage && !catchesQ.isFetchingNextPage) void catchesQ.fetchNextPage();
        }}
        fetchingMore={catchesQ.isFetchingNextPage}
        moreFailed={catchesQ.isFetchNextPageError}
        onRetryMore={() => void catchesQ.fetchNextPage()}
      />
      {live ? (
        <ActivePartidaDock session={live} clock={partideServerClock} href={partideHrefs.partida(live.documentId)} captureHref={partideHrefs.capture(live.documentId)} />
      ) : null}
    </>
  );
}

/**
 * One column of own cards; two once the centre column has room, three from a wide one. The single
 * column is an explicit minmax(0,1fr) track: an implicit `auto` one grows to the longest card's
 * min-content, so one long venue name would push every card past a phone's width.
 */
function CardGrid({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <div className="grid grid-cols-1 items-start gap-3.5 @3xl:grid-cols-2 @4xl:grid-cols-3" data-testid={testId}>
      {children}
    </div>
  );
}

function HistoryError({ onRetry }: { onRetry: () => void }) {
  return (
    <DashboardError
      title="Jurnalul nu s-a putut încărca."
      action={
        <Button variant="secondary" onClick={onRetry}>
          Încearcă din nou
        </Button>
      }
    />
  );
}
