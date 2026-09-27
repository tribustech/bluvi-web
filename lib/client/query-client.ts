import { isServer, QueryCache, QueryClient, MutationCache } from '@tanstack/react-query';
import { isApiError } from '@/core/transport';

/** Called when any query/mutation learns the JWT is dead (proxy already cleared the cookie). */
export type OnSessionDead = () => void;

export function makeQueryClient(onSessionDead?: OnSessionDead) {
  const handle = (error: unknown) => {
    if (isApiError(error) && error.code === 'SESSION_DEAD') onSessionDead?.();
  };
  return new QueryClient({
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
}

let browserClient: QueryClient | undefined;

/** One client per request on the server, a singleton in the browser (TanStack SSR guidance). */
export function getQueryClient(onSessionDead?: OnSessionDead) {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient(onSessionDead);
  return browserClient;
}
