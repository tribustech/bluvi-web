import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

async function load() {
  vi.stubEnv('NEXT_PUBLIC_CMS_URL', 'https://api.bluvi.ro/api');
  const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  const { createBrowserTransport } = await import('./transport');
  return { t: createBrowserTransport(), fetchMock };
}

describe('browser transport', () => {
  it('sends public GETs straight to the CMS as a CORS simple request', async () => {
    const { t, fetchMock } = await load();
    await t.request({ method: 'GET', path: '/feed/sponsors/dashboard', auth: 'none' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.bluvi.ro/api/feed/sponsors/dashboard');
    expect(init.headers).toEqual({ accept: 'application/json' });
    expect(init.credentials).toBe('omit');
  });

  it('routes per-user calls through the proxy with the app headers', async () => {
    const { t, fetchMock } = await load();
    await t.request({ method: 'GET', path: '/feed/bookings/mine', auth: 'required' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/cms/feed/bookings/mine');
    expect(init.headers).toMatchObject({ 'x-app-platform': 'web' });
  });
});
