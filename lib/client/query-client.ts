import { isServer, QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { isApiError } from '@/core/transport';

/** Called when any query/mutation learns the JWT is dead (proxy already cleared the cookie). */
export type OnSessionDead = () => void;

export function makeQueryClient(onSessionDead?: OnSessionDead) {
  const handle = (error: unknown) => {
    if (isApiError(error) && error.code === 'SESSION_DEAD') onSessionDead?.();
  };
  const client = new QueryClient({
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({ onError: handle }),
    defaultOptions: {
      queries: {
        // With SSR we prefetch on the server; avoid an immediate refetch on the client.
        staleTime: 60 * 1000,
        retry: (count, error) => !(isApiError(error) && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  });
  if (isServer) neverStaleOnServer(client);
  return client;
}

/**
 * The server render's client (one per request, SSR of client components) never refetches, so
 * staleness means nothing there — yet every `useQuery` that renders with hydrated data asks «is it
 * stale?», and TanStack answers with `Date.now()` (timeUntilStale). With Cache Components that clock
 * read lands in the prerender of the pages under the site layout («/balti/[id]: … unstable value
 * `Date.now()` while prerendering», dev logs 2026-10-05/06). `staleTime: 'static'` is «never stale»
 * without reading the clock; the browser's client keeps each query's own staleTime.
 */
function neverStaleOnServer(client: QueryClient) {
  const defaults = client.defaultQueryOptions.bind(client);
  client.defaultQueryOptions = ((options: Parameters<typeof defaults>[0]) => ({
    ...defaults(options),
    staleTime: 'static',
  })) as typeof client.defaultQueryOptions;
}

let browserClient: QueryClient | undefined;

/** One client per request on the server, a singleton in the browser (TanStack SSR guidance). */
export function getQueryClient(onSessionDead?: OnSessionDead) {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient(onSessionDead);
  return browserClient;
}
