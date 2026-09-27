import 'server-only';
import {
  apiErrorFromResponse,
  appHeaders,
  baseInit,
  buildPath,
  networkError,
  performFetch,
  type Transport,
  type TransportRequest,
  type TransportResponse,
} from '@/core/transport';
import { APP_VERSION, cmsUrl } from './env';
import { cachedPublicGet, PublicGetError } from './public-get';
import { getSessionToken } from './session';

function parseJson(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function publicGet<T>(req: TransportRequest, url: string): Promise<TransportResponse<T>> {
  try {
    const res = await cachedPublicGet(url, appHeaders(APP_VERSION));
    const headers = new Headers();
    if (res.contentType) headers.set('content-type', res.contentType);
    return { data: parseJson(res.body) as T, status: res.status, headers };
  } catch (e) {
    if (e instanceof PublicGetError) throw apiErrorFromResponse(e.status, parseJson(e.body), req.path);
    throw networkError(req.path, e);
  }
}

/**
 * Transport for Server Components, Server Actions and Route Handlers.
 * - `auth: 'none'` GETs are cached under the CMS's own cache headers (see public-get.ts).
 * - Everything else is per-request, never cached, with the session bearer when there is one.
 */
export function createServerTransport(): Transport {
  return {
    async request<T>(req: TransportRequest) {
      const path = buildPath(req.path, req.query);
      const url = `${cmsUrl()}${path}`;
      if (req.method === 'GET' && req.auth === 'none') return publicGet<T>(req, url);

      const token = req.auth === 'none' ? undefined : await getSessionToken();
      const extra: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
      return performFetch<T>(fetch, url, { ...baseInit(req, APP_VERSION, extra), cache: 'no-store' }, req.path);
    },
  };
}
