import type {
  infiniteQueryOptions as rqInfiniteQueryOptions,
  mutationOptions as rqMutationOptions,
  queryOptions as rqQueryOptions,
} from '@tanstack/react-query';

/**
 * Runtime-free twins of TanStack's option helpers. Those helpers are identity functions that
 * exist only for type inference, but they ship inside `@tanstack/react-query`, which `core/`
 * must not load at runtime (it has to stay usable outside React). We borrow their TYPES with
 * `import type` and provide the identity ourselves, so a factory here is exactly what
 * `useQuery(...)`, `queryClient.prefetchQuery(...)` and `useMutation(...)` accept.
 */
export const queryOptions = (<T>(options: T) => options) as typeof rqQueryOptions;
export const infiniteQueryOptions = (<T>(options: T) => options) as typeof rqInfiniteQueryOptions;
export const mutationOptions = (<T>(options: T) => options) as typeof rqMutationOptions;

/** Query-key prefixes a mutation invalidates on success (ported from each fish mutation hook). */
export type InvalidationList = readonly (readonly unknown[])[];
