import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getLakeAvailability, type LakeAvailability } from '@/core/booking';
import { getLake, type LakeDetail } from '@/core/lakes';
import { getProfile } from '@/core/social';
import { T4SectionSkeleton, T4Skeleton } from '@/components/templates/T4';
import { isApiError } from '@/core/transport';
import { routes } from '@/lib/routes';
import { getSessionToken } from '@/lib/server/session';
import { createServerTransport } from '@/lib/server/transport';
import { getViewer } from '@/lib/server/viewer';
import { BookingDemo, type DemoProfile, type LoadProblem } from './BookingDemo';
import { StateStrip } from './DemoChrome';
import { withTimeout } from './deadline';
import { recheckSession, within } from './session';
import { DEMO_STATES, readFlowParams, type DemoState } from './states';

export const metadata: Metadata = { title: 'T4 · Formular în pași', robots: { index: false } };

/** Local Chita Lake — the QA account operates it, and its rates, extras and blocks are seeded. */
const DEMO_LAKE = 's84u55lo4n9z0emngozttt6e';

/**
 * How long the page waits for the CMS. The server transport has no timeout of its own: a CMS that
 * accepts the connection and never answers would keep the skeleton streaming forever. Past this,
 * the page shows the load error with «Reîncearcă» (as T6's data.ts READ_TIMEOUT_MS). It bounds
 * every read, the session's included.
 */
const READ_TIMEOUT_MS = 8000;

type SearchParams = Record<string, string | string[] | undefined>;
type Props = { searchParams: Promise<SearchParams> };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function readState(sp: SearchParams): DemoState {
  const s = first(sp.state);
  return DEMO_STATES.some((d) => d.key === s) ? (s as DemoState) : 'default';
}

/** This flow's own URL (the lake kept, the forced state and the selection dropped): sign-in returns here, a retry reloads it. */
function flowHref(sp: SearchParams) {
  const lake = first(sp.lake);
  return `/dev/templates/t4${lake ? `?lake=${encodeURIComponent(lake)}` : ''}`;
}
const signInHref = (sp: SearchParams) => `/intra?next=${encodeURIComponent(flowHref(sp))}`;

/**
 * The loading tree — the Suspense fallback and the forced `?state=loading` are this same element.
 * The eyebrow holds a grey bar where the lake's name will be, so «· Rezervare» barely moves. The
 * cards are step 1's shapes: the day picker + start / duration (its helper line: the lake's
 * forbidden departures), then the stand grid at the demo lake's size — known before its data, so
 * the page does not grow when the stands land.
 */
const DEMO_STANDS = 21;
function Loading({ lakeId = DEMO_LAKE }: { lakeId?: string }) {
  return (
    <T4Skeleton
      eyebrow={
        <>
          <span aria-hidden className="inline-block h-[0.7em] w-20 rounded-full bg-soft-fill align-middle animate-shimmer" />
          <span className="sr-only">Se încarcă</span> · Rezervare
        </>
      }
      title="Alege intervalul și standul"
      back={{ label: 'Înapoi la baltă', href: routes.lake(lakeId) }}
    >
      <T4SectionSkeleton tiles={10} fields={2} columns={2} helpers={[1]} />
      <T4SectionSkeleton fields={0} grid={DEMO_STANDS} />
    </T4Skeleton>
  );
}

/** The session read gave no answer within READ_TIMEOUT_MS. */
const NO_ANSWER = Symbol('no answer');

/**
 * T4 «Multi-step form» demo (ROADMAP §4) — the template on its first user screen, the angler's
 * booking (fish app/(app)/book-lake/[lakeId]: interval & stand → extra → confirm), with the local
 * CMS's real lake, availability, quote and profile, through core/. `?state=` forces each state;
 * `?step=&day=&start=&hours=&stand=&extras=` resume the flow (BookingDemo keeps them in the URL).
 * Dev only (layout.tsx): 404 in production builds.
 */
export default function T4DemoPage({ searchParams }: Props) {
  return (
    <>
      <Suspense fallback={<StateStrip state={null} />}>
        <Strip searchParams={searchParams} />
      </Suspense>
      {/* As in the site layout: the T4 header is the page's header, inside <main>, not a 2nd banner. */}
      <main id="continut" tabIndex={-1} className="scroll-mt-14 outline-none md:scroll-mt-16">
        <Suspense fallback={<Loading />}>
          <Demo searchParams={searchParams} />
        </Suspense>
      </main>
    </>
  );
}

async function Strip({ searchParams }: Props) {
  const sp = await searchParams;
  return <StateStrip state={readState(sp)} lake={first(sp.lake)} />;
}

async function Demo({ searchParams }: Props) {
  const sp = await searchParams;
  const state = readState(sp);
  const lakeId = first(sp.lake) ?? DEMO_LAKE;
  if (state === 'loading') return <Loading lakeId={lakeId} />;
  const t = withTimeout(createServerTransport(), READ_TIMEOUT_MS);
  // getViewer() has no deadline of its own: a CMS that never answers /users/me must end in the
  // load error, not in a skeleton that streams until undici gives up.
  const read = await within(getViewer(), READ_TIMEOUT_MS, NO_ANSWER);
  const viewer = read === NO_ANSWER ? null : read;
  // No viewer: signed out (no cookie, a dead session) or unknown (no answer, a hiccup — then the
  // load error with a retry, never the sign-in gate for a signed-in user).
  const session =
    viewer || state === 'signed-out'
      ? null
      : read === NO_ANSWER
        ? (await getSessionToken())
          ? 'unreachable'
          : 'none'
        : await recheckSession(READ_TIMEOUT_MS, t);
  const signedIn = state !== 'signed-out' && Boolean(viewer);

  let lake: LakeDetail | null = null;
  let availability: LakeAvailability | null = null;
  let profile: DemoProfile | null = null;
  let problem: LoadProblem | null = state === 'error' || session === 'unreachable' || session === 'live' ? 'failed' : null;
  if (!problem) {
    try {
      if (!signedIn) {
        // Signed out: the sign-in gate needs the lake's name only — never wait for (or fail on)
        // an availability read the visitor cannot use.
        lake = await getLake(t, lakeId);
      } else {
        [lake, availability, profile] = await Promise.all([
          getLake(t, lakeId),
          getLakeAvailability(t, lakeId),
          getProfile(t).then(
            (p) => ({ username: p.username, phone: p.phone }),
            () => null,
          ),
        ]);
      }
    } catch (e) {
      // A lake that does not exist (deleted, a bad link) is not an outage: no retry can fix it.
      problem = isApiError(e) && e.status === 404 ? 'missing' : 'failed';
      if (problem === 'failed') console.error('[dev/t4] load failed', e);
    }
  }

  const nowMs = requestTime();
  return (
    <BookingDemo
      // A new state is a new flow: never carry a selection across the switcher. And a load that
      // failed then succeeded (a «Reîncearcă») remounts too, so the flow runs the same
      // initialisers as a first load (the first free day, the URL's selection).
      key={`${state}:${problem ?? 'ok'}`}
      state={state}
      lakeId={lakeId}
      flowHref={flowHref(sp)}
      signInHref={signInHref(sp)}
      signedIn={signedIn}
      lake={problem ? null : lake}
      availability={problem ? null : availability}
      problem={problem}
      profile={profile}
      initial={readFlowParams(sp)}
      nowMs={nowMs}
    />
  );
}

/** The request's clock, read once (after the request-time reads above) and handed to the client. */
function requestTime() {
  return Date.now();
}
