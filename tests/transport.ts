import { baseInit, buildPath, performFetch, type Transport, type TransportRequest } from '@/core/transport';

export const CMS_URL = (process.env.CMS_URL ?? 'http://localhost:1337/api').replace(/\/$/, '');
const APP_VERSION = '2.0.0-test';

/**
 * Plain Node fetch against the CMS. `jwt` = signed-in user; omitted = guest.
 * `auth: 'required'` without a jwt still sends the request (contract tests assert the 401/403).
 */
export function createTestTransport(jwt?: string): Transport {
  return {
    async request<T>(req: TransportRequest) {
      const extra: Record<string, string> = jwt && req.auth !== 'none' ? { authorization: `Bearer ${jwt}` } : {};
      const path = buildPath(req.path, req.query);
      return performFetch<T>(fetch, `${CMS_URL}${path}`, baseInit(req, APP_VERSION, extra), req.path);
    },
  };
}

/** Records requests and answers from a queue — for unit tests of API functions. */
export function createFakeTransport(responses: unknown[] | ((req: TransportRequest) => unknown) = []) {
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    async request<T>(req: TransportRequest) {
      calls.push(req);
      const data = typeof responses === 'function' ? responses(req) : responses.shift();
      return { data: data as T, status: 200, headers: new Headers() };
    },
  };
  return { transport, calls };
}
