import { afterEach, describe, expect, it, vi } from 'vitest';
import { appleBody, AuthInputError, facebookBody, googleBody } from './auth-providers';

afterEach(() => vi.unstubAllEnvs());

describe('googleBody', () => {
  it('passes both tokens through when the client already has them', async () => {
    await expect(googleBody({ idToken: 'i', accessToken: 'a' })).resolves.toEqual({ idToken: 'i', accessToken: 'a' });
  });

  it('exchanges a GIS popup code for both tokens with redirect_uri postmessage', async () => {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'cid');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'sec');
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const params = new URLSearchParams(String(init?.body));
      expect(params.get('redirect_uri')).toBe('postmessage');
      expect(params.get('code')).toBe('c0de');
      return new Response(JSON.stringify({ id_token: 'i', access_token: 'a' }));
    });
    await expect(googleBody({ code: 'c0de' }, fetchImpl as unknown as typeof fetch)).resolves.toEqual({ idToken: 'i', accessToken: 'a' });
  });

  it('rejects a missing or refused code', async () => {
    await expect(googleBody({})).rejects.toBeInstanceOf(AuthInputError);
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', 'cid');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'sec');
    const refused = vi.fn(async () => new Response('{}', { status: 400 }));
    await expect(googleBody({ code: 'x' }, refused as unknown as typeof fetch)).rejects.toBeInstanceOf(AuthInputError);
  });
});

describe('facebookBody', () => {
  it('takes the profile from the Graph API, never from the browser', async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ email: 'real@x.ro', name: 'Ion', picture: { data: { url: 'https://p' } } }))
    );
    const body = await facebookBody({ accessToken: 't', userData: { email: 'forged@x.ro' } }, fetchImpl as unknown as typeof fetch);
    expect(body).toEqual({ userData: { email: 'real@x.ro', name: 'Ion', imageURL: 'https://p', accessToken: 't' }, accessToken: 't' });
  });

  it('rejects a token Graph refuses', async () => {
    const refused = vi.fn(async () => new Response('{}', { status: 400 }));
    await expect(facebookBody({ accessToken: 't' }, refused as unknown as typeof fetch)).rejects.toBeInstanceOf(AuthInputError);
    await expect(facebookBody({})).rejects.toBeInstanceOf(AuthInputError);
  });
});

describe('appleBody', () => {
  it('forwards the fish shape', () => {
    expect(appleBody({ identityToken: 'i', authorizationCode: 'c', fullName: 'Ion Pop' })).toEqual({
      identityToken: 'i',
      authorizationCode: 'c',
      fullName: 'Ion Pop',
      email: null,
    });
    expect(() => appleBody({ identityToken: 'i' })).toThrow(AuthInputError);
  });
});
