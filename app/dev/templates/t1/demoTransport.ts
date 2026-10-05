import { ApiError, networkError, type Transport, type TransportRequest, type TransportResponse } from '@/core/transport';
import type { DemoState } from './StateSwitcher';

/*
 * Forced states, driven through the TRANSPORT rather than by overriding the list body: every query
 * on the page (the list, the tabs' counts, «Ale mele», the bento, the aside) then sees the same
 * outage and reacts the way it would in production — and a retry really goes back to the network.
 *
 * Only /feed/* reads are touched (everything this screen reads); anything else passes through.
 */

type Rule =
  /** Never answers (aborts with the query). */
  | 'hang'
  /** Rejects like a dead network. */
  | 'fail'
  /** Rejects until heal() — the user's first manual retry recovers. */
  | 'fail-until-healed'
  /** Never answers until heal(); run INSIDE the deadline, so the read times out into an error. */
  | 'hang-until-healed'
  /**
   * Rejects as an expired session (401): «Sesiunea a expirat» + «Deconectează-te». A plain 401, not
   * SESSION_DEAD: that code makes the app's QueryClient clear and refresh (the real dead-session
   * path), and with every read forced to fail it would loop instead of showing the screen.
   */
  | 'expired'
  /** Rejects as a server outage (503): «Serverul nu răspunde». */
  | 'server'
  /** Answers an empty page (and null for the server-drawn bento slots). */
  | 'empty';

type Plan = {
  /** Applies to every /feed/ read. */
  all?: Rule;
  /** Applies to competition-card reads of page ≥ 2 only. */
  nextPage?: Rule;
  /** Card reads with this scope answer empty (followed-empty). */
  emptyScope?: 'followed';
  /** Registered-scope reads keep only finished competitions (mine-finished). */
  finishedRegistrations?: boolean;
  /**
   * The rule runs UNDER the browser deadline (withDeadline wraps the demo transport, with the short
   * DEMO_DEADLINE_MS), so a hung CMS is exercised end to end: skeleton → deadline → error → retry.
   */
  insideDeadline?: boolean;
};

const PLANS: Partial<Record<DemoState, Plan>> = {
  loading: { all: 'hang' },
  'loading-list': { all: 'hang' },
  empty: { all: 'empty' },
  error: { all: 'fail' },
  'error-session': { all: 'expired' },
  'error-server': { all: 'server' },
  slow: { all: 'hang-until-healed', insideDeadline: true },
  'error-recover': { all: 'fail-until-healed' },
  'next-page': { nextPage: 'hang' },
  'next-page-error': { nextPage: 'fail-until-healed' },
  'followed-empty': { emptyScope: 'followed' },
  'mine-finished': { finishedRegistrations: true },
};

/** Whether a state is forced through the transport — its queries then need their own cache keys. */
export function isTransportForced(state: DemoState): boolean {
  return state in PLANS;
}

/**
 * Whether a forced state touches what the server prefetches — page 1 of the shared lists (bento,
 * aside) and the «Ale mele» list. The states that only force page ≥ 2 or the followed scope leave
 * them alone, so the server reads them as in production (under the state's own keys, demoKey) and
 * the first paint is hydrated — no speculative skeleton dropped after hydration.
 */
export function forcesFirstPage(state: DemoState): boolean {
  const plan = PLANS[state];
  return Boolean(plan && (plan.all || plan.finishedRegistrations));
}

/** How long a browser read may take before it counts as a network failure (error + retry, not a skeleton forever). */
export const BROWSER_DEADLINE_MS = 15_000;

/** ?state=slow: the deadline the hung reads run under — short, so the state reaches its error in a screenshot. */
export const DEMO_DEADLINE_MS = 4_000;

/** Whether the state's rule runs under the deadline (the transport is built inside-out for it). */
export function runsInsideDeadline(state: DemoState): boolean {
  return Boolean(PLANS[state]?.insideDeadline);
}

/**
 * The browser transport with a deadline. The server hands over to the browser after its budget,
 * but a browser fetch has no deadline of its own: a CMS that HANGS (rather than failing) would keep
 * every skeleton up forever. Past the deadline the read is aborted and rejected as a network error,
 * so the page reaches its error state («Nu putem ajunge la server» + «Încearcă din nou»). A caller's
 * own abort (a query cancelled) passes through unchanged.
 * TODO(kit): belongs in createBrowserTransport (lib/client, outside T1) so every screen gets it.
 */
export function withDeadline(inner: Transport, ms: number = BROWSER_DEADLINE_MS): Transport {
  return {
    async request<T>(req: TransportRequest) {
      const deadline = AbortSignal.timeout(ms);
      const signal = req.signal ? AbortSignal.any([req.signal, deadline]) : deadline;
      try {
        return await inner.request<T>({ ...req, signal });
      } catch (e) {
        if (deadline.aborted && !req.signal?.aborted) throw networkError(req.path, e);
        throw e;
      }
    },
  };
}

/**
 * Appends the forced state to a query's key, so a forced state never reads (or poisons) the real
 * cached lists the other states and pages share — the browser QueryClient is a singleton. Forced
 * outages also skip the client's automatic retries (they would only hit the same outage and hold
 * the error state back by ~3s); the manual retry is what these states exercise.
 */
export function demoKey<T extends { queryKey: readonly unknown[] }>(options: T, state: DemoState): T {
  if (!isTransportForced(state)) return options;
  return { ...options, retry: false, queryKey: [...options.queryKey, 'demo-state', state] as unknown as T['queryKey'] };
}

const EMPTY_PAGE = {
  data: [],
  meta: {
    pagination: { page: 1, pageSize: 20, pageCount: 0, total: 0 },
    counts: { notStarted: 0, started: 0, completed: 0 },
  },
};

type CardsPage = {
  data: Array<{ status: string }>;
  meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number }; counts: Record<string, number> };
};

const isCards = (path: string) => path.startsWith('/feed/competition-cards') || path.startsWith('/feed/my-competition-cards');

function param(path: string, name: string): string | null {
  const q = path.indexOf('?');
  return q < 0 ? null : new URLSearchParams(path.slice(q + 1)).get(name);
}

function respond<T>(data: unknown): TransportResponse<T> {
  return { data: data as T, status: 200, headers: new Headers() };
}

function hang<T>(req: TransportRequest): Promise<TransportResponse<T>> {
  return new Promise((_, reject) => {
    req.signal?.addEventListener('abort', () => reject(req.signal?.reason), { once: true });
  });
}

export type DemoTransport = Transport & {
  /** Recover a `fail-until-healed` outage (called by the demo's manual retry). */
  heal: () => void;
};

export function createDemoTransport(inner: Transport, state: DemoState): DemoTransport {
  const plan = PLANS[state];
  let healed = false;

  const apply = async <T>(rule: Rule, req: TransportRequest): Promise<TransportResponse<T>> => {
    switch (rule) {
      case 'hang':
        return hang<T>(req);
      case 'fail':
        throw networkError(req.path, new Error('demo: forced outage'));
      case 'fail-until-healed':
        if (!healed) throw networkError(req.path, new Error('demo: forced outage'));
        return inner.request<T>(req);
      case 'hang-until-healed':
        return healed ? inner.request<T>(req) : hang<T>(req);
      case 'expired':
        throw new ApiError({ message: 'Unauthorized', status: 401, code: 'HTTP', path: req.path });
      case 'server':
        throw new ApiError({ message: 'Service Unavailable', status: 503, code: 'HTTP', path: req.path });
      case 'empty':
        return respond<T>(isCards(req.path) ? EMPTY_PAGE : { data: null });
    }
  };

  return {
    heal: () => {
      healed = true;
    },
    async request<T>(req: TransportRequest) {
      if (!plan || req.method !== 'GET' || !req.path.startsWith('/feed/')) return inner.request<T>(req);
      if (plan.all) return apply<T>(plan.all, req);
      if (!isCards(req.path)) return inner.request<T>(req);

      if (plan.nextPage && Number(param(req.path, 'page') ?? '1') >= 2) return apply<T>(plan.nextPage, req);
      if (plan.emptyScope && param(req.path, 'scope') === plan.emptyScope) return respond<T>(EMPTY_PAGE);
      if (plan.finishedRegistrations && param(req.path, 'scope') === 'registered') {
        const res = await inner.request<CardsPage>(req);
        const done = res.data.data.filter((c) => c.status === 'completed');
        const page: CardsPage = {
          data: done,
          meta: {
            pagination: { ...res.data.meta.pagination, pageCount: done.length ? 1 : 0, total: done.length },
            counts: { notStarted: 0, started: 0, completed: res.data.meta.counts.completed ?? done.length },
          },
        };
        return respond<T>(page);
      }
      return inner.request<T>(req);
    },
  };
}
