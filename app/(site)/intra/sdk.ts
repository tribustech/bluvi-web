/**
 * Provider JS SDKs, loaded on demand (first hover/focus/click of a sign-in button) so /intra and
 * every other page ship none of them. Each function resolves to the body that
 * POST /api/auth/{provider} expects (lib/server/auth-providers.ts) or throws a SignInError.
 */

export type SignInErrorKind = 'cancelled' | 'sdk' | 'missing-email' | 'failed';

export class SignInError extends Error {
  constructor(
    readonly kind: SignInErrorKind,
    message = kind
  ) {
    super(message);
  }
}

const scripts = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  let p = scripts.get(src);
  if (!p) {
    p = new Promise<void>((resolve, reject) => {
      const el = document.createElement('script');
      el.src = src;
      el.async = true;
      el.onload = () => resolve();
      el.onerror = () => {
        el.remove();
        scripts.delete(src);
        reject(new SignInError('sdk'));
      };
      document.head.appendChild(el);
    });
    scripts.set(src, p);
  }
  return p;
}

// ── Google Identity Services: authorization-code flow in a popup (redirect_uri 'postmessage') ──

type GoogleCodeResponse = { code?: string; error?: string };
type GoogleCodeClient = { requestCode(): void };
type GoogleOAuth2 = {
  initCodeClient(cfg: {
    client_id: string;
    scope: string;
    ux_mode: 'popup';
    callback: (r: GoogleCodeResponse) => void;
    error_callback?: (e: { type?: string }) => void;
  }): GoogleCodeClient;
};
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
    AppleID?: { auth: AppleAuth };
  }
}

const GOOGLE_SRC = 'https://accounts.google.com/gsi/client';

export async function googleCredential(clientId: string): Promise<{ code: string }> {
  await loadScript(GOOGLE_SRC);
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new SignInError('sdk');
  return new Promise((resolve, reject) => {
    oauth2
      .initCodeClient({
        client_id: clientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        callback: (r) => (r.code ? resolve({ code: r.code }) : reject(new SignInError(r.error === 'access_denied' ? 'cancelled' : 'failed'))),
        error_callback: (e) => reject(new SignInError(e.type === 'popup_closed' ? 'cancelled' : e.type === 'popup_failed_to_open' ? 'sdk' : 'failed')),
      })
      .requestCode();
  });
}

// ── Facebook Login JS SDK ──

type FacebookLoginResponse = {
  status?: string;
  authResponse?: { accessToken?: string; grantedScopes?: string } | null;
};
type FacebookSdk = {
  init(cfg: { appId: string; version: string; cookie?: boolean; xfbml?: boolean }): void;
  login(cb: (r: FacebookLoginResponse) => void, opts: { scope: string; return_scopes?: boolean }): void;
};

const FACEBOOK_SRC = 'https://connect.facebook.net/ro_RO/sdk.js';
let facebookReady: Promise<FacebookSdk> | undefined;

function loadFacebook(appId: string): Promise<FacebookSdk> {
  facebookReady ??= new Promise<FacebookSdk>((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (!window.FB) return reject(new SignInError('sdk'));
      window.FB.init({ appId, version: 'v21.0', cookie: false, xfbml: false });
      resolve(window.FB);
    };
    loadScript(FACEBOOK_SRC).catch(reject);
  }).catch((e: unknown) => {
    facebookReady = undefined;
    throw e;
  });
  return facebookReady;
}

export async function facebookCredential(appId: string): Promise<{ accessToken: string }> {
  const FB = await loadFacebook(appId);
  return new Promise((resolve, reject) => {
    FB.login(
      (r) => {
        const token = r.authResponse?.accessToken;
        if (!token) return reject(new SignInError('cancelled'));
        // fish AUTH_FB_EMAIL_DECLINED: the user unticked the email permission in the dialog.
        const scopes = r.authResponse?.grantedScopes?.split(',') ?? [];
        if (scopes.length > 0 && !scopes.includes('email')) return reject(new SignInError('missing-email'));
        resolve({ accessToken: token });
      },
      { scope: 'public_profile,email', return_scopes: true }
    );
  });
}

// ── Sign in with Apple JS (popup) ──

type AppleSignInResponse = {
  authorization?: { id_token?: string; code?: string };
  user?: { email?: string; name?: { firstName?: string; lastName?: string } };
};
type AppleAuth = {
  init(cfg: { clientId: string; scope: string; redirectURI: string; usePopup: boolean; state?: string }): void;
  signIn(): Promise<AppleSignInResponse>;
};

const APPLE_SRC = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/ro_RO/appleid.auth.js';

export async function appleCredential(
  servicesId: string,
  redirectUri: string
): Promise<{ identityToken: string; authorizationCode: string; fullName?: string; email?: string }> {
  await loadScript(APPLE_SRC);
  const auth = window.AppleID?.auth;
  if (!auth) throw new SignInError('sdk');
  auth.init({ clientId: servicesId, scope: 'name email', redirectURI: redirectUri, usePopup: true });
  let r: AppleSignInResponse;
  try {
    r = await auth.signIn();
  } catch (e) {
    const code = (e as { error?: string } | null)?.error;
    throw new SignInError(code === 'popup_closed_by_user' || code === 'user_cancelled_authorize' ? 'cancelled' : 'failed');
  }
  const identityToken = r.authorization?.id_token;
  const authorizationCode = r.authorization?.code;
  if (!identityToken || !authorizationCode) throw new SignInError('failed');
  // Apple sends name + email only on the very first authorisation, like the native SDK.
  const fullName = [r.user?.name?.firstName, r.user?.name?.lastName].filter(Boolean).join(' ') || undefined;
  return { identityToken, authorizationCode, fullName, email: r.user?.email };
}

/** Warms the SDK while the pointer is on its way to the button. */
export function preload(provider: 'google' | 'facebook' | 'apple', ids: { facebookAppId?: string }) {
  if (provider === 'google') void loadScript(GOOGLE_SRC).catch(() => undefined);
  else if (provider === 'apple') void loadScript(APPLE_SRC).catch(() => undefined);
  else if (ids.facebookAppId) void loadFacebook(ids.facebookAppId).catch(() => undefined);
}
