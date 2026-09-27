import { describe, expect, it } from 'vitest';
import { forwardHeaders, isDeadSessionBody, isProxyAllowed, isSameOrigin, responseHeaders } from './proxy';

describe('proxy allow-list', () => {
  it('lets feed and the legacy prefixes fish uses through', () => {
    expect(isProxyAllowed('/feed/lakes/abc')).toBe(true);
    expect(isProxyAllowed('/competitions/abc/ranking')).toBe(true);
    expect(isProxyAllowed('/competitions')).toBe(true);
    expect(isProxyAllowed('/users/me')).toBe(true);
  });

  it('keeps admin and lookalikes out', () => {
    expect(isProxyAllowed('/admin/users')).toBe(false);
    expect(isProxyAllowed('/content-manager/x')).toBe(false);
    expect(isProxyAllowed('/competitionsX')).toBe(false);
    expect(isProxyAllowed('/feed/../admin')).toBe(false);
  });
});

describe('proxy headers', () => {
  it('forwards content-type, adds bearer + app headers, never cookies', () => {
    const h = forwardHeaders(new Headers({ 'content-type': 'multipart/form-data; boundary=x', cookie: 'bluvi_session=t' }), 'jwt', '2.0.0');
    expect(h.get('authorization')).toBe('Bearer jwt');
    expect(h.get('content-type')).toBe('multipart/form-data; boundary=x');
    expect(h.get('x-app-platform')).toBe('web');
    expect(h.get('cookie')).toBeNull();
  });

  it('drops set-cookie and marks responses private', () => {
    const h = responseHeaders(new Headers({ 'content-type': 'application/json', 'set-cookie': 'x=1' }));
    expect(h.get('set-cookie')).toBeNull();
    expect(h.get('cache-control')).toBe('private, no-store');
  });
});

describe('dead session + origin checks', () => {
  it('recognises the CMS dead-JWT answer only', () => {
    expect(isDeadSessionBody(401, JSON.stringify({ error: { message: 'Missing or invalid credentials' } }))).toBe(true);
    expect(isDeadSessionBody(401, JSON.stringify({ error: { message: 'Unauthorized' } }))).toBe(false);
    expect(isDeadSessionBody(403, JSON.stringify({ error: { message: 'Missing or invalid credentials' } }))).toBe(false);
    expect(isDeadSessionBody(401, 'not json')).toBe(false);
  });

  it('requires same origin for writes', () => {
    expect(isSameOrigin('https://bluvi.ro/api/cms/x', null, 'same-origin')).toBe(true);
    expect(isSameOrigin('https://bluvi.ro/api/cms/x', null, 'cross-site')).toBe(false);
    expect(isSameOrigin('https://bluvi.ro/api/cms/x', 'https://bluvi.ro', null)).toBe(true);
    expect(isSameOrigin('https://bluvi.ro/api/cms/x', 'https://evil.ro', null)).toBe(false);
    expect(isSameOrigin('https://bluvi.ro/api/cms/x', null, null)).toBe(false);
  });
});
