import qs from 'qs';
import { apiErrorFromResponse, networkError } from './errors';
import type { TransportRequest, TransportResponse } from './types';

/** Sent on every request, like fish sends `Platform.OS` and the app version. */
export const APP_PLATFORM = 'web';

export function appHeaders(appVersion: string): Record<string, string> {
  return { 'x-app-platform': APP_PLATFORM, 'x-app-version': appVersion };
}

/** `path` plus the qs-serialized `query`, merged with any query already in `path`. */
export function buildPath(path: string, query?: Record<string, unknown>): string {
  if (!query || Object.keys(query).length === 0) return path;
  const qsPart = qs.stringify(query, { encodeValuesOnly: true, skipNulls: true });
  if (!qsPart) return path;
  return path.includes('?') ? `${path}&${qsPart}` : `${path}?${qsPart}`;
}

export function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData;
}

/** RequestInit body + content-type for a TransportRequest body. */
export function encodeBody(body: unknown): { body?: BodyInit; contentType?: string } {
  if (body === undefined) return {};
  if (isFormData(body)) return { body };
  return { body: JSON.stringify(body), contentType: 'application/json' };
}

async function readBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Shared fetch → TransportResponse step for every transport implementation.
 * Throws ApiError on network failure and on any non-2xx.
 */
export async function performFetch<T>(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  pathForErrors: string
): Promise<TransportResponse<T>> {
  let res: Response;
  try {
    res = await fetchImpl(url, init);
  } catch (cause) {
    if ((cause as { name?: string })?.name === 'AbortError') throw cause;
    throw networkError(pathForErrors, cause);
  }
  const data = await readBody(res);
  if (!res.ok) throw apiErrorFromResponse(res.status, data, pathForErrors);
  return { data: data as T, status: res.status, headers: res.headers };
}

/** Builds the RequestInit common to all transports. */
export function baseInit(req: TransportRequest, appVersion: string, extraHeaders: Record<string, string> = {}): RequestInit {
  const { body, contentType } = encodeBody(req.body);
  const headers: Record<string, string> = { accept: 'application/json', ...appHeaders(appVersion), ...extraHeaders };
  if (contentType) headers['content-type'] = contentType;
  return { method: req.method, headers, body, signal: req.signal };
}
