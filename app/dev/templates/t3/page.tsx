import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import {
  DetailBackButton,
  DetailError,
  DetailNotFound,
  DetailRetry,
  DetailSignInAgain,
  DetailSkeleton,
  type HeaderChipGround,
} from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { SiteShell } from '../../../(site)/_shell/SiteShell';
import { CompetitionScreen } from './CompetitionScreen';
import { bounded, isNotFound, isSessionDead, loadCompetitionScreen, loadLakeScreen } from './data';
import { LakeScreen } from './LakeScreen';
import { StateBar } from './StateBar';
import { demoHref, parseScreen, parseState, type DemoState, type Screen } from './states';
import { readViewerState, type DemoViewer } from './viewer';

/*
 * /dev/templates/t3 — T3 «Detail with tabs» (components/templates/T3) rendered with REAL data from
 * the local CMS through core/:
 *  - `?screen=lake` (default): the REAL /balti/[id] LakeScreen on the QA lake (./LakeScreen.tsx
 *    only reshapes its read per state), so owner feedback here applies to production as is.
 *  - `?screen=competition`: the route-tabs variant, extracted from the competition page.
 * `?state=` forces each state (StateBar). Dev only: 404 in production builds, like /dev/kit.
 *
 * The shell never waits for data: the top bar (its account slot pending until the bounded session
 * read answers), the state bar and <main> render as soon as the URL is known; only the body sits
 * behind Suspense, its fallback the skeleton of the screen asked for — the same one the `loading`
 * state forces, so «Se încarcă» shows exactly what a slow CMS shows. Before the URL is known (the
 * prerendered static shell) the frame is screen-neutral: no active nav item, a state-bar
 * placeholder of the same height, and a <main> that only says it is loading (an <h1> and a status,
 * both for assistive tech) — never one screen's skeleton under the other.
 *
 * Reads follow the T3 data-loading contract (components/templates/T3/DetailPage.tsx): the main
 * read is bounded (data.ts PAGE_TIMEOUT_MS), a 404 is `notFound()` (./not-found.tsx; inside the
 * streamed body it cannot change the status — a real route checks before any Suspense), every
 * other failure the retryable page error — except a dead session (SESSION_DEAD / 401), which gets
 * «Intră din nou» instead of a retry that cannot succeed. The session is tri-state (./viewer.ts: a
 * failed session read is 'unknown', never «signed out»); it is read alongside the page data and
 * NEVER awaited by the body: the public page renders as soon as the main read answers, and only
 * the account-dependent bits wait for the session, each behind its own Suspense.
 */

export const metadata: Metadata = { title: 'T3 · Detaliu cu tab-uri', robots: { index: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** How long the demo's body waits for the session (the shell bar's bound). */
const SESSION_TIMEOUT_MS = 4000;

/**
 * THE app shell (SiteShell: skip link, top bar with its ☰ menu and ⌘K palette, the scroll sentinel,
 * <main>) is rendered here and in not-found.tsx rather than as a layout.tsx (a new layout route
 * trips the stale .next/types of an older build in `tsc`, see t6). The screens render their own
 * breadcrumb band on the server (SiteHeader ownsBreadcrumbBand), as /concursuri/<id> does.
 * `?state=signed-out` / `session-unknown` force the bar's session, as they force the page's.
 */
const T3_FORCED_SESSION = { param: 'state', out: ['signed-out'], unknown: ['session-unknown'] };

export default function T3DemoPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  // Only the URL is awaited inside: its fallback is the static shell (prerender).
  return (
    <SiteShell forced={T3_FORCED_SESSION}>
      <Suspense
        fallback={
          <>
            <StateBar />
            <ShellLoading />
          </>
        }
      >
        <Demo searchParams={searchParams} />
      </Suspense>
    </SiteShell>
  );
}

async function Demo({ searchParams }: Props) {
  const params = await searchParams;
  const screen = parseScreen(params.screen);
  const state = parseState(params.state, screen);
  // Signing in from a forced signed-out view returns to the real view (else it would still look signed out).
  const signIn = `/intra?next=${encodeURIComponent(demoHref(screen, state === 'signed-out' ? 'real' : state))}`;
  const viewer: Promise<DemoViewer> =
    state === 'signed-out'
      ? Promise.resolve(null)
      : state === 'session-unknown'
        ? Promise.resolve('unknown')
        : bounded<DemoViewer>(readViewerState().catch(() => 'unknown' as const), SESSION_TIMEOUT_MS, 'unknown');
  return (
    <>
      <StateBar screen={screen} state={state} />
      <Suspense fallback={<Loading screen={screen} />}>
        <Body screen={screen} state={state} signIn={signIn} viewer={viewer} />
      </Suspense>
    </>
  );
}

/**
 * The static shell's body, before the URL (and so the screen) is known: no skeleton of either
 * screen, but never an empty <main> either — a heading and a loading status for assistive tech,
 * replaced by the screen's own skeleton as soon as the URL is read.
 */
function ShellLoading() {
  return (
    <div aria-busy="true">
      <h1 className="sr-only">Se încarcă pagina</h1>
      <p role="status" className="sr-only">
        Se încarcă…
      </p>
    </div>
  );
}

const TRAIL: Record<Screen, Crumb[]> = {
  lake: [{ label: 'Bălți', href: routes.lakes() }],
  competition: [{ label: 'Competiții', href: routes.competitions() }],
};

const LIST_HREF: Record<Screen, string> = { lake: routes.lakes(), competition: routes.competitions() };

/** The phone back chip, its fill set by its ground: the photo, the white header, the grey page (whole-page states). */
function back(screen: Screen, ground: HeaderChipGround = 'surface') {
  return <DetailBackButton fallbackHref={LIST_HREF[screen]} ground={ground} />;
}

/** The skeleton of the screen asked for, shaped like its loaded page (header rows, columns, bars). */
function Loading({ screen }: { screen: Screen }) {
  return screen === 'lake' ? (
    // The route's own skeleton shape (/balti/[id]/loading.tsx): the photo grid's one height, the
    // header's share + CTA (the CTA leaves from 1024), the summary card right from 1024.
    <DetailSkeleton
      photo
      photoCount={1}
      trail={TRAIL.lake}
      back={back('lake', 'photo')}
      heading="Baltă"
      label="Se încarcă balta"
      columns={{ layout: 'summary', aside: true }}
      header={{ eyebrow: true, titleAside: true, meta: 1, badges: 'badge', actions: 'share-cta' }}
    />
  ) : (
    <DetailSkeleton
      tabs
      trail={TRAIL.competition}
      back={back('competition')}
      heading="Concurs"
      label="Se încarcă concursul"
      phoneGround="surface"
      actionBar
      columns={{ left: true, aside: true, leftCards: 2, centre: 'table' }}
      header={{ meta: 3, badges: 'pill', actions: 2, phoneEnd: true }}
    />
  );
}

async function Body({ screen, state, signIn, viewer }: { screen: Screen; state: DemoState; signIn: string; viewer: Promise<DemoViewer> }) {
  if (state === 'loading') return <Loading screen={screen} />;

  const heading = screen === 'lake' ? 'Balta nu a putut fi încărcată' : 'Concursul nu a putut fi încărcat';
  const pageError = (
    <DetailError
      trail={TRAIL[screen]}
      back={back(screen, 'page')}
      heading={heading}
      description="Nu am putut încărca pagina. Încearcă din nou în câteva momente."
      action={<DetailRetry size="default" />}
    />
  );
  // A dead session: retrying can never work — sign out and back in (parity competition-page.shell).
  const sessionDead = (
    <DetailError
      trail={TRAIL[screen]}
      back={back(screen, 'page')}
      current="Sesiune expirată"
      heading={heading}
      description="Sesiunea ta a expirat. Intră din nou în cont ca să vezi pagina."
      action={<DetailSignInAgain signIn={signIn} />}
    />
  );
  if (state === 'error') return pageError;
  if (state === 'session-dead') return sessionDead;
  if (state === 'not-found') {
    return screen === 'lake' ? (
      <DetailNotFound
        trail={TRAIL.lake}
        back={back('lake', 'page')}
        title="Balta nu a fost găsită"
        description="Poate a fost ștearsă sau linkul e greșit. Caut‑o în lista de bălți."
        href={routes.lakes()}
        cta="Vezi bălțile"
      />
    ) : (
      <DetailNotFound
        trail={TRAIL.competition}
        back={back('competition', 'page')}
        title="Concursul nu a fost găsit"
        description="Poate a fost șters sau linkul e greșit. Caută‑l în lista de competiții."
        href={routes.competitions()}
        cta="Vezi competițiile"
      />
    );
  }

  // A 404 is the not-found page; a dead session its own error; the CMS down, slow (bounded) or
  // answering a shape core does not know is the retryable page-level error.
  const orError = (e: unknown): 'dead' | null => {
    if (isNotFound(e)) notFound();
    return isSessionDead(e) ? 'dead' : null;
  };
  // Only the main read is awaited: the session (`viewer`) and the lake's secondary sections stream
  // into their own Suspense boundaries inside the screen, so neither holds the hero and the title.
  if (screen === 'competition') {
    const competition = await loadCompetitionScreen().catch(orError);
    if (competition === 'dead') return sessionDead;
    if (!competition) return pageError;
    return <CompetitionScreen competition={competition} state={state} viewer={viewer} signIn={signIn} />;
  }
  const data = await loadLakeScreen().catch(orError);
  if (data === 'dead') return sessionDead;
  if (!data) return pageError;
  return <LakeScreen data={data} state={state} />;
}
