import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, apiErrorFromResponse, GENERIC_ERROR_MESSAGE } from './errors';
import { baseInit, buildPath, performFetch } from './http';
import { call } from './parse';
import type { Transport } from './types';

describe('buildPath', () => {
  it('serializes legacy Strapi queries with brackets like qs does in fish', () => {
    expect(buildPath('/competitions', { populate: { lake: { fields: ['name'] } }, filters: { id: { $eq: 3 } } })).toBe(
      '/competitions?populate[lake][fields][0]=name&filters[id][$eq]=3'
    );
  });

  it('appends to an existing query and skips nulls', () => {
    expect(buildPath('/feed/lakes/search?q=a', { page: 2, county: null })).toBe('/feed/lakes/search?q=a&page=2');
    expect(buildPath('/feed/x', {})).toBe('/feed/x');
  });

  it('encodes values', () => {
    expect(buildPath('/feed/lakes/search', { q: 'Balta Mare & co' })).toBe('/feed/lakes/search?q=Balta%20Mare%20%26%20co');
  });
});

describe('apiErrorFromResponse', () => {
  it('keeps bluCode errors with their own message', () => {
    const e = apiErrorFromResponse(400, { error: { message: 'Stand ocupat', details: { bluCode: 'STAND_TAKEN' } } });
    expect(e).toMatchObject({ status: 400, code: 'HTTP', bluCode: 'STAND_TAKEN', message: 'Stand ocupat' });
  });

  it('marks a dead JWT', () => {
    const e = apiErrorFromResponse(401, { error: { message: 'Missing or invalid credentials' } });
    expect(e.code).toBe('SESSION_DEAD');
  });

  it('hides everything else behind the generic message', () => {
    const e = apiErrorFromResponse(500, 'boom');
    expect(e).toMatchObject({ status: 500, code: 'HTTP', message: GENERIC_ERROR_MESSAGE });
    expect(apiErrorFromResponse(403, { error: { message: 'Forbidden' } }).code).toBe('HTTP');
  });
});

describe('performFetch', () => {
  it('parses JSON and returns status + headers', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ a: 1 }), { status: 200, headers: { 'x-cache-tag': 't' } }));
    const res = await performFetch(fetchImpl as unknown as typeof fetch, 'http://x/y', {}, '/y');
    expect(res.data).toEqual({ a: 1 });
    expect(res.headers.get('x-cache-tag')).toBe('t');
  });

  it('returns null for 204', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    expect((await performFetch(fetchImpl as unknown as typeof fetch, 'u', {}, '/y')).data).toBeNull();
  });

  it('throws ApiError on non-2xx and on network failure', async () => {
    const notFound = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Not Found' } }), { status: 404 }));
    await expect(performFetch(notFound as unknown as typeof fetch, 'u', {}, '/y')).rejects.toMatchObject({ status: 404 });
    const down = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(performFetch(down as unknown as typeof fetch, 'u', {}, '/y')).rejects.toMatchObject({ code: 'NETWORK' });
  });
});

describe('baseInit', () => {
  it('sends the app headers and JSON bodies', () => {
    const init = baseInit({ method: 'POST', path: '/x', body: { a: 1 } }, '2.0.0');
    expect(init.headers).toMatchObject({ 'x-app-platform': 'web', 'x-app-version': '2.0.0', 'content-type': 'application/json' });
    expect(init.body).toBe('{"a":1}');
  });

  it('leaves FormData alone so the browser sets the multipart boundary', () => {
    const fd = new FormData();
    fd.append('files', 'x');
    const init = baseInit({ method: 'POST', path: '/upload', body: fd }, '2.0.0');
    expect(init.body).toBe(fd);
    expect((init.headers as Record<string, string>)['content-type']).toBeUndefined();
  });
});

describe('call', () => {
  it('validates the response with the schema', async () => {
    const t: Transport = { request: async () => ({ data: { n: 'x' }, status: 200, headers: new Headers() }) as never };
    await expect(call(t, { method: 'GET', path: '/n' }, z.object({ n: z.number() }))).rejects.toBeInstanceOf(ApiError);
    await expect(call(t, { method: 'GET', path: '/n' }, z.object({ n: z.string() }))).resolves.toEqual({ n: 'x' });
  });
});
