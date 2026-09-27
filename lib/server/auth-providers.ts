import 'server-only';

/**
 * Builds the body the CMS expects for each social provider — the exact shapes fish sends
 * (`fish/contexts/auth/AuthContext.tsx`). The CMS controllers `JSON.parse(ctx.request.body)`,
 * so the body must reach Strapi as TEXT: with `content-type: application/json` Koa parses it
 * into an object first and the CMS answers 400 AUTH:INVALID_REQUEST_BODY_FORMAT (verified on
 * local 2026-09-27).
 */
export const SOCIAL_PROVIDERS = ['google', 'facebook', 'apple'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export function isSocialProvider(p: string): p is SocialProvider {
  return (SOCIAL_PROVIDERS as readonly string[]).includes(p);
}

export class AuthInputError extends Error {}

type Json = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);

/**
 * Google Identity Services code flow (popup, redirect_uri 'postmessage' — the same value the CMS
 * OAuth2Client is built with) → exchange the code for id + access token, like GoogleSignin
 * .getTokens() does on the phone. A client that already holds both tokens may send them directly.
 */
export async function googleBody(input: Json, fetchImpl: typeof fetch = fetch): Promise<Json> {
  const idToken = str(input.idToken);
  const accessToken = str(input.accessToken);
  if (idToken && accessToken) return { idToken, accessToken };

  const code = str(input.code);
  if (!code) throw new AuthInputError('Lipsește codul de autorizare Google.');
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google sign-in is not configured');

  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: 'postmessage',
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new AuthInputError('Codul de autorizare Google nu este valid.');
  const tokens = (await res.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token || !tokens.access_token) throw new AuthInputError('Google nu a întors tokenurile așteptate.');
  return { idToken: tokens.id_token, accessToken: tokens.access_token };
}

/**
 * Facebook: fish reads the profile from the SDK and falls back to the Graph API for the email.
 * On the web we always ask the Graph API with the token, server-side, so the profile we forward
 * belongs to the token (never to whatever the browser claims).
 */
export async function facebookBody(input: Json, fetchImpl: typeof fetch = fetch): Promise<Json> {
  const accessToken = str(input.accessToken);
  if (!accessToken) throw new AuthInputError('Lipsește tokenul Facebook.');
  const res = await fetchImpl(
    `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) throw new AuthInputError('Tokenul Facebook nu este valid.');
  const me = (await res.json()) as { email?: string; name?: string; picture?: { data?: { url?: string } } };
  return {
    userData: { email: me.email, name: me.name, imageURL: me.picture?.data?.url, accessToken },
    accessToken,
  };
}

/** Sign in with Apple JS returns the same identityToken + authorizationCode pair as the native SDK. */
export function appleBody(input: Json): Json {
  const identityToken = str(input.identityToken);
  const authorizationCode = str(input.authorizationCode);
  if (!identityToken || !authorizationCode) throw new AuthInputError('Lipsesc datele de autentificare Apple.');
  return {
    identityToken,
    authorizationCode,
    fullName: str(input.fullName) ?? null,
    email: str(input.email) ?? null,
  };
}

export async function providerBody(provider: SocialProvider, input: Json): Promise<Json> {
  if (provider === 'google') return googleBody(input);
  if (provider === 'facebook') return facebookBody(input);
  return appleBody(input);
}
