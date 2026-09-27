export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Whether a request needs the signed-in user.
 * - `required`: per-user route; the transport must attach the session (server: cookie, browser: proxy).
 * - `optional`: works signed out, but the response changes when signed in (e.g. `isFollowing` flags).
 * - `none`: shared/public data. Server transport may cache it under the CMS's own cache headers.
 */
export type AuthMode = 'required' | 'optional' | 'none';

export type TransportRequest = {
  method: HttpMethod;
  /** CMS path WITHOUT the `/api` prefix, e.g. `/feed/lakes/abc`. May already carry a query string. */
  path: string;
  /** Serialized with `qs` (brackets), same as fish, so legacy populate/filters queries match byte for byte. */
  query?: Record<string, unknown>;
  /** JSON-serializable body, or a FormData that is sent untouched. */
  body?: unknown;
  auth?: AuthMode;
  signal?: AbortSignal;
};

export type TransportResponse<T = unknown> = {
  data: T;
  status: number;
  headers: Headers;
};

/**
 * The only way `core/` talks to the CMS. Implementations live outside `core/`
 * (server: `lib/server/transport.ts`, browser: `lib/client/transport.ts`, tests: `tests/transport.ts`).
 * Implementations throw `ApiError` for every non-2xx answer.
 */
export interface Transport {
  request<T = unknown>(req: TransportRequest): Promise<TransportResponse<T>>;
}
