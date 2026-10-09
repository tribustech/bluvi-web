import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/transport/errors';
import type { Consent } from '@/lib/consent/model';
import { apiErrorReport, DEAD_SESSION_MUTE_MS, normalizeApiPath, resetApiErrorReporting } from './api-errors';
import { identifyFromSession, startBrowserObservability, type BrowserGateDeps } from './browser';
import { sentryTarget, serverSentryTarget, TRACES_SAMPLE_RATE } from './env';
import { browserSentryOptions, serverSentryOptions } from './options';
import { browserGateOpen } from './gate';
import { attachSdk, captureException, isReporting, markSdkLoading, reportApiError, SESSION_DEAD_MESSAGE, setSessionIdentity, startNewSession } from './report';
import { registerServerSentry } from './server';
import { readSessionToken, sessionInfoFromCookieHeader } from './session-state';
import { FILTERED, scrubBreadcrumb, scrubEvent, scrubString } from './scrub';

const DSN = 'https://public@o0.ingest.sentry.io/0';
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: unknown) => `eyJhbGciOiJIUzI1NiJ9.${b64(payload)}.c2lnbmF0dXJlLXNpZw`;
const NOW = Date.UTC(2026, 9, 9, 12);

describe('global.b.observability — env gating (fish: production / staging only)', () => {
  it('is off without a DSN, in development, test or an unknown environment', () => {
    expect(sentryTarget(undefined, 'production')).toBeNull();
    expect(sentryTarget('', 'production')).toBeNull();
    for (const env of [undefined, '', 'development', 'test', 'local']) expect(sentryTarget(DSN, env)).toBeNull();
  });
  it('reports on production, preview and staging', () => {
    for (const env of ['production', 'preview', 'staging', 'Production']) expect(sentryTarget(DSN, env)).toEqual({ dsn: DSN, environment: env.toLowerCase() });
  });
  it('the server reads SENTRY_DSN + SENTRY_ENVIRONMENT, falling back to VERCEL_ENV', () => {
    expect(serverSentryTarget({ SENTRY_DSN: DSN, VERCEL_ENV: 'preview' })).toEqual({ dsn: DSN, environment: 'preview' });
    expect(serverSentryTarget({ SENTRY_DSN: DSN, SENTRY_ENVIRONMENT: 'staging', VERCEL_ENV: 'production' })?.environment).toBe('staging');
    expect(serverSentryTarget({ SENTRY_DSN: DSN, VERCEL_ENV: 'development' })).toBeNull();
    expect(serverSentryTarget({ VERCEL_ENV: 'production' })).toBeNull();
  });
  it('the server init options: low trace sampling, no PII, the scrubber everywhere, no replay', () => {
    const o = serverSentryOptions({ dsn: DSN, environment: 'production' });
    expect(o.tracesSampleRate).toBe(TRACES_SAMPLE_RATE);
    expect(TRACES_SAMPLE_RATE).toBe(0.05);
    expect(o.sendDefaultPii).toBe(false);
    expect(o.beforeSend).toBe(scrubEvent);
    expect(o.beforeSendTransaction).toBe(scrubEvent);
    expect(o).not.toHaveProperty('replaysSessionSampleRate');
    expect(o).not.toHaveProperty('integrations');
  });
  it('the browser sends errors only (consent copy: «doar când apare o eroare»): no sessions, no tracing', () => {
    const o = browserSentryOptions({ dsn: DSN, environment: 'production' });
    expect(o.tracesSampleRate).toBe(0);
    expect(o.sendDefaultPii).toBe(false);
    expect(o.beforeSend).toBe(scrubEvent);
    expect(o).not.toHaveProperty('replaysSessionSampleRate');
    const defaults = ['InboundFilters', 'BrowserSession', 'GlobalHandlers', 'BrowserTracing', 'Dedupe'].map((name) => ({ name }));
    expect(o.integrations(defaults).map((i) => i.name)).toEqual(['InboundFilters', 'GlobalHandlers', 'Dedupe']);
  });
  it('the server never imports the SDK when off', async () => {
    const load = vi.fn();
    const prev = { dsn: process.env.SENTRY_DSN, env: process.env.SENTRY_ENVIRONMENT };
    delete process.env.SENTRY_DSN;
    process.env.SENTRY_ENVIRONMENT = 'production';
    await registerServerSentry(load);
    expect(load).not.toHaveBeenCalled();
    process.env.SENTRY_DSN = DSN;
    process.env.SENTRY_ENVIRONMENT = 'development';
    await registerServerSentry(load);
    expect(load).not.toHaveBeenCalled();
    process.env.SENTRY_DSN = prev.dsn;
    process.env.SENTRY_ENVIRONMENT = prev.env;
    if (prev.dsn === undefined) delete process.env.SENTRY_DSN;
    if (prev.env === undefined) delete process.env.SENTRY_ENVIRONMENT;
  });
});

describe('global.b.observability — browser SDK only after consent (errors: true)', () => {
  const consent = (errors: boolean): Consent => ({ v: 1, analytics: false, errors, at: '2026-10-09T00:00:00.000Z' }) as Consent;
  let current: Consent | null;
  let listeners: ((c: Consent) => void)[];
  let sdk: { init: ReturnType<typeof vi.fn>; getClient: ReturnType<typeof vi.fn>; captureException: ReturnType<typeof vi.fn>; captureMessage: ReturnType<typeof vi.fn>; setTag: ReturnType<typeof vi.fn>; setUser: ReturnType<typeof vi.fn> };
  let close: ReturnType<typeof vi.fn>;
  let load: ReturnType<typeof vi.fn>;
  const deps = (target: BrowserGateDeps['target'] = { dsn: DSN, environment: 'production' }): BrowserGateDeps => ({
    target,
    readConsent: () => current,
    subscribeConsent: (cb) => {
      listeners.push(cb);
      return () => (listeners = listeners.filter((l) => l !== cb));
    },
    load: load as unknown as BrowserGateDeps['load'],
  });
  const decide = (errors: boolean) => {
    current = consent(errors);
    for (const l of listeners) l(current);
  };
  const flush = () => new Promise((r) => setTimeout(r, 0));

  beforeEach(() => {
    current = null;
    listeners = [];
    close = vi.fn();
    sdk = { init: vi.fn(), getClient: vi.fn(() => ({ close })), captureException: vi.fn(), captureMessage: vi.fn(), setTag: vi.fn(), setUser: vi.fn() };
    load = vi.fn(async () => sdk);
    attachSdk(null);
  });
  afterEach(() => attachSdk(null));

  it('consent errors:false → never loaded nor initialised, even with a DSN', async () => {
    current = consent(false);
    startBrowserObservability(deps());
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(sdk.init).not.toHaveBeenCalled();
    captureException(new Error('x'));
    expect(sdk.captureException).not.toHaveBeenCalled();
    expect(isReporting()).toBe(false);
  });
  it('no decision yet → nothing; no DSN / development → nothing even with consent', async () => {
    startBrowserObservability(deps());
    current = consent(true);
    startBrowserObservability(deps(null));
    await flush();
    expect(load).toHaveBeenCalledTimes(0);
  });
  it('errors:true → loads, inits with the scrubber, reports; queued captures go out once attached', async () => {
    current = consent(true);
    startBrowserObservability(deps());
    captureException(new Error('early'));
    await flush();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init.mock.calls[0][0]).toMatchObject({ dsn: DSN, environment: 'production', sendDefaultPii: false, tracesSampleRate: 0 });
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    expect(isReporting()).toBe(true);
  });
  it('a later «yes» starts it, a later «no» closes and detaches it', async () => {
    current = consent(false);
    startBrowserObservability(deps());
    decide(true);
    await flush();
    expect(sdk.init).toHaveBeenCalledTimes(1);
    decide(false);
    expect(close).toHaveBeenCalled();
    expect(isReporting()).toBe(false);
    captureException(new Error('after withdrawal'));
    expect(sdk.captureException).not.toHaveBeenCalled();
  });
  it('the gate is decided synchronously from the consent cookie (instrumentation-client.ts)', () => {
    const target = { dsn: DSN, environment: 'production' };
    const cookie = (errors: boolean) => `a=1; bluvi_consent=${encodeURIComponent(JSON.stringify(consent(errors)))}; b=2`;
    expect(browserGateOpen(target, cookie(true))).toBe(true);
    expect(browserGateOpen(target, cookie(false))).toBe(false);
    expect(browserGateOpen(target, 'a=1')).toBe(false);
    expect(browserGateOpen(target, 'bluvi_consent=%7Bbroken')).toBe(false);
    expect(browserGateOpen(null, cookie(true))).toBe(false);
  });
  it('a capture before the gate resolves (first-render crash) is delivered once the SDK attaches', async () => {
    // instrumentation-client.ts: the cookie says yes → 'loading' before anything else loads.
    markSdkLoading();
    captureException(new Error('white screen'));
    expect(sdk.captureException).not.toHaveBeenCalled();
    // …then ./browser.ts arrives and starts the SDK.
    current = consent(true);
    startBrowserObservability(deps());
    await flush();
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    expect((sdk.captureException.mock.calls[0][0] as Error).message).toBe('white screen');
  });
  it('an early-opened gate that the store then reads as closed drops the queue and stays off', async () => {
    markSdkLoading();
    captureException(new Error('queued'));
    current = consent(false);
    startBrowserObservability(deps());
    await flush();
    expect(isReporting()).toBe(false);
    attachSdk(sdk);
    expect(sdk.captureException).not.toHaveBeenCalled();
  });
  it('a «no» while the chunk is loading never initialises', async () => {
    current = consent(true);
    startBrowserObservability(deps());
    current = consent(false);
    await flush();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(isReporting()).toBe(false);
  });
});

describe('global.b.observability — session.state + user.id (fish readSessionToken)', () => {
  it('none / valid / expired / unreadable', () => {
    expect(readSessionToken(undefined, NOW)).toEqual({ state: 'none' });
    expect(readSessionToken(jwt({ id: 146, iat: 1, exp: NOW / 1000 + 60 }), NOW)).toEqual({ state: 'valid', userId: 146 });
    expect(readSessionToken(jwt({ id: 146, iat: 1, exp: NOW / 1000 - 60 }), NOW)).toEqual({ state: 'expired', userId: 146 });
    expect(readSessionToken('not-a-jwt', NOW).state).toBe('unreadable');
    expect(readSessionToken('a.%%%.c', NOW).state).toBe('unreadable');
    expect(readSessionToken(jwt({ id: 7 }), NOW)).toEqual({ state: 'unreadable', userId: 7 });
  });
  it('reads bluvi_session from a Cookie header and returns only the state and the id', () => {
    const token = jwt({ id: 9, exp: NOW / 1000 + 60 });
    const info = sessionInfoFromCookieHeader(`bluvi_consent=x; bluvi_session=${token}; other=1`, NOW);
    expect(info).toEqual({ state: 'valid', userId: 9 });
    expect(JSON.stringify(info)).not.toContain(token);
    expect(sessionInfoFromCookieHeader('bluvi_consent=x', NOW)).toEqual({ state: 'none' });
    expect(sessionInfoFromCookieHeader(undefined, NOW)).toEqual({ state: 'none' });
  });
  it('the browser asks /api/auth/session and keeps only the id', async () => {
    const sdk = { setTag: vi.fn(), setUser: vi.fn() };
    const ok = vi.fn(async () => new Response(JSON.stringify({ id: 146, email: 'a@b.ro', username: 'x' }), { status: 200 }));
    await identifyFromSession(sdk, ok as unknown as typeof fetch);
    expect(sdk.setTag).toHaveBeenCalledWith('session.state', 'valid');
    expect(sdk.setUser).toHaveBeenCalledWith({ id: '146' });
    const out = vi.fn(async () => new Response(JSON.stringify({ error: { status: 401, message: 'Signed out' } }), { status: 401 }));
    await identifyFromSession(sdk, out as unknown as typeof fetch);
    expect(sdk.setTag).toHaveBeenLastCalledWith('session.state', 'none');
    expect(sdk.setUser).toHaveBeenLastCalledWith(null);
    const dead = vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Missing or invalid credentials' } }), { status: 401 }));
    await identifyFromSession(sdk, dead as unknown as typeof fetch);
    expect(sdk.setTag).toHaveBeenLastCalledWith('session.state', 'expired');
  });
});

describe('global.b.observability — beforeSend scrubber', () => {
  it('drops the session, tokens and e-mails wherever they are', () => {
    const token = jwt({ id: 1, exp: 2 });
    const event = scrubEvent({
      message: `Eroare pentru ion.popescu@example.com cu ${token}`,
      request: {
        url: 'https://bluvi.ro/intra?token=abc123&next=/balti',
        query_string: 'access_token=zzz&page=2',
        headers: { Authorization: `Bearer ${token}`, Cookie: `bluvi_session=${token}`, 'User-Agent': 'UA' },
        cookies: { bluvi_session: token },
      },
      user: { id: 146, email: 'ion@example.com', ip_address: '1.2.3.4', username: 'ion' },
      exception: { values: [{ value: 'fetch /api/cms/users?jwt=secret failed for a@b.ro' }] },
      breadcrumbs: [{ data: { url: '/api/auth/google/callback?id_token=xyz&code=c0de' } }],
      extra: { headers: { cookie: 'bluvi_session=abc' }, note: 'Cookie: bluvi_session=abc; x=1' },
      tags: { api_url: '/lakes/:id', api_status: '403' },
    });
    const all = JSON.stringify(event);
    for (const secret of [token, 'ion.popescu@example.com', 'ion@example.com', 'a@b.ro', 'abc123', 'zzz', 'xyz', 'c0de', '1.2.3.4', 'bluvi_session=abc']) {
      expect(all).not.toContain(secret);
    }
    expect(event.request.headers).toEqual({ 'User-Agent': 'UA' });
    expect(event.request).not.toHaveProperty('cookies');
    expect(event.user).toEqual({ id: '146' });
    expect(event.request.url).toBe(`https://bluvi.ro/intra?token=${FILTERED}&next=/balti`);
    expect(event.tags).toEqual({ api_url: '/lakes/:id', api_status: '403' });
  });
  it('strings and breadcrumbs', () => {
    expect(scrubString('Bearer abc.def.ghi')).toBe(`Bearer ${FILTERED}`);
    expect(scrubString('/x?page=2&code=1')).toBe(`/x?page=2&code=${FILTERED}`);
    expect(scrubBreadcrumb({ message: 'mail x@y.com', data: { Authorization: 'Bearer t' } })).toEqual({ message: 'mail [email]', data: { Authorization: FILTERED } });
  });
});

describe('global.b.observability — API errors (fish api.ts:158-172)', () => {
  beforeEach(() => resetApiErrorReporting());
  const http = (status: number, path: string, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
    new ApiError({ message: 'x', status, code: 'HTTP', path, ...extra });

  it('normalises ids out of the endpoint', () => {
    expect(normalizeApiPath('/lakes/abc123def456ghi789jkl0/partide?page=2')).toBe('/lakes/:id/partide');
    expect(normalizeApiPath('/competitions/123')).toBe('/competitions/:id');
    expect(normalizeApiPath(undefined)).toBe('unknown');
  });
  it('tags api_url + api_status and dedupes per (status, endpoint) per session', () => {
    expect(apiErrorReport(http(500, '/competitions/1'))).toEqual({
      tags: { api_url: '/competitions/:id', api_status: '500' },
      fingerprint: ['api-error', '500', '/competitions/:id'],
    });
    expect(apiErrorReport(http(500, '/competitions/2'))).toBeNull();
    expect(apiErrorReport(http(403, '/competitions/2'))?.tags.api_status).toBe('403');
    expect(apiErrorReport(new ApiError({ message: 'x', status: 0, code: 'NETWORK', path: '/feed/lakes' }))?.tags.api_status).toBe('NETWORK');
  });
  it('never reports bluCode errors, non-API errors or aborts', () => {
    expect(apiErrorReport(http(400, '/registrations', { bluCode: 'ALREADY_REGISTERED' }))).toBeNull();
    expect(apiErrorReport(new Error('x'))).toBeNull();
    expect(apiErrorReport(new ApiError({ message: 'x', status: 0, code: 'NETWORK', path: '/a', cause: { name: 'AbortError' } }))).toBeNull();
  });
  it('SESSION_DEAD and its 60 s 401/403 burst are not reported (global.b.session-expired)', () => {
    expect(apiErrorReport(new ApiError({ message: 'Invalid credentials', status: 401, code: 'SESSION_DEAD', path: '/users/me' }), NOW)).toBeNull();
    expect(apiErrorReport(http(403, '/notification-users/unread'), NOW + 1000)).toBeNull();
    expect(apiErrorReport(http(401, '/user/profile'), NOW + 2000)).toBeNull();
    expect(apiErrorReport(http(500, '/polls/current'), NOW + 3000)).not.toBeNull();
    expect(apiErrorReport(http(403, '/notification-users/unread'), NOW + DEAD_SESSION_MUTE_MS + 1)).not.toBeNull();
  });
  it('SESSION_DEAD is reported once per page as fish handleDeadSession; its burst stays muted', () => {
    const sdk = { captureException: vi.fn(), captureMessage: vi.fn(), setTag: vi.fn(), setUser: vi.fn() };
    startNewSession('valid');
    attachSdk(sdk);
    const dead = () => new ApiError({ message: 'Invalid credentials', status: 401, code: 'SESSION_DEAD', path: '/users/me/123' });
    reportApiError(dead());
    reportApiError(dead());
    reportApiError(http(403, '/notification-users/unread'));
    expect(sdk.captureMessage).toHaveBeenCalledTimes(1);
    expect(sdk.captureMessage).toHaveBeenCalledWith(SESSION_DEAD_MESSAGE, { level: 'error', extra: { url: '/users/me/:id', hadSessionCookie: true } });
    expect(sdk.captureException).not.toHaveBeenCalled();
    // A new sign-in re-arms the report.
    startNewSession('valid', 146);
    reportApiError(dead());
    expect(sdk.captureMessage).toHaveBeenCalledTimes(2);
    attachSdk(null);
  });
  it('the identity follows sign-in / sign-out / forced sign-out without a reload (fish AuthContext.tsx:80-105)', () => {
    const sdk = { captureException: vi.fn(), captureMessage: vi.fn(), setTag: vi.fn(), setUser: vi.fn() };
    setSessionIdentity('valid', 146); // off: nothing
    expect(sdk.setTag).not.toHaveBeenCalled();
    attachSdk(sdk);
    startNewSession('valid');
    setSessionIdentity('valid', 146);
    expect(sdk.setTag).toHaveBeenLastCalledWith('session.state', 'valid');
    expect(sdk.setUser).toHaveBeenLastCalledWith({ id: '146' });
    setSessionIdentity('expired');
    expect(sdk.setTag).toHaveBeenLastCalledWith('session.state', 'expired');
    expect(sdk.setUser).toHaveBeenLastCalledWith(null);
    startNewSession('none');
    expect(sdk.setTag).toHaveBeenLastCalledWith('session.state', 'none');
    expect(sdk.setUser).toHaveBeenLastCalledWith(null);
    attachSdk(null);
  });
  it('a sign-out re-arms the dedupe and mutes its own 401/403 burst', () => {
    const sdk = { captureException: vi.fn(), captureMessage: vi.fn(), setTag: vi.fn(), setUser: vi.fn() };
    attachSdk(sdk);
    reportApiError(http(500, '/lakes/1'));
    startNewSession('none');
    reportApiError(http(401, '/user/profile'));
    reportApiError(http(403, '/notification-users/unread'));
    reportApiError(http(500, '/lakes/1'));
    expect(sdk.captureException).toHaveBeenCalledTimes(2);
    expect(sdk.captureMessage).not.toHaveBeenCalled();
    attachSdk(null);
  });
  it('reportApiError is a no-op while Sentry is off, and reports once when on', () => {
    const sdk = { captureException: vi.fn(), captureMessage: vi.fn(), setTag: vi.fn(), setUser: vi.fn() };
    attachSdk(null);
    reportApiError(http(500, '/lakes/1'));
    expect(sdk.captureException).not.toHaveBeenCalled();
    attachSdk(sdk);
    reportApiError(http(500, '/lakes/1'));
    reportApiError(http(500, '/lakes/2'));
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    expect(sdk.captureException.mock.calls[0][1]).toMatchObject({ tags: { api_url: '/lakes/:id', api_status: '500' } });
    attachSdk(null);
  });
});
