/*
 * The sign-in screen's pure rules (fish features/onboarding/useWelcomeSignIn.ts, app/sign-in.tsx),
 * kept out of the component so they are unit-tested (logic.test.ts).
 */

export type SocialProvider = 'apple' | 'google' | 'facebook';
export type Provider = SocialProvider | 'local';

export type SignInConfig = {
  googleClientId?: string;
  facebookAppId?: string;
  appleServicesId?: string;
  appleRedirectUri?: string;
  localAuth: boolean;
};

// Copy from fish features/onboarding/useWelcomeSignIn.ts and app/sign-in.tsx.
export const GENERIC_ERROR = 'Autentificarea nu a reușit. Te rugăm să încerci din nou.';
export const MISSING_EMAIL_ERROR =
  'Facebook nu ne-a dat adresa ta de email. Permite accesul la email în fereastra Facebook sau intră cu Google ori Apple.';
export const LINK_ERROR = 'Nu am putut deschide pagina. Încearcă din nou.';
// Web additions (no fish equivalent): a blocked popup / unreachable server / rate limit say so.
export const SDK_ERROR: Record<SocialProvider, string> = {
  google: 'Nu am putut deschide fereastra Google. Verifică conexiunea, permite ferestrele pop-up pentru Bluvi și încearcă din nou.',
  facebook: 'Nu am putut deschide fereastra Facebook. Verifică conexiunea, permite ferestrele pop-up pentru Bluvi și încearcă din nou.',
  apple: 'Nu am putut deschide fereastra Apple. Verifică conexiunea, permite ferestrele pop-up pentru Bluvi și încearcă din nou.',
};
export const SERVER_ERROR = 'Serverul Bluvi nu răspunde acum. Încearcă din nou în câteva minute.';
export const RATE_LIMIT_ERROR = 'Prea multe încercări. Așteaptă un minut și încearcă din nou.';
export const LOCAL_ERROR = 'Email sau parolă greșită.';

/** fish common/utils/constants.ts TERMS_AND_CONDITIONS_URL / PRIVACY_POLICY_URL. */
export const TERMS_URL = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=14bbf816-7403-4ab1-87e9-0d0dcdd4175a';
export const PRIVACY_URL = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=958c9787-3e75-4040-990d-cb6bf2c8b3e3';

/**
 * c2 + c3: Apple, Google, Facebook in that order. A provider without its configuration is left
 * out (absent, never disabled) — fish hides Apple unless AppleAuthentication is available; the
 * web hides it unless an Apple Services ID is configured.
 */
export function visibleProviders(config: SignInConfig): SocialProvider[] {
  const out: SocialProvider[] = [];
  if (config.appleServicesId) out.push('apple');
  if (config.googleClientId) out.push('google');
  if (config.facebookAppId) out.push('facebook');
  return out;
}

/**
 * c17: fish honours `redirectTo` only when it starts with a single slash and has no backslash or
 * whitespace; the web also refuses /intra itself (a loop). Null means «no target»: go back, or home.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !/^\/(?!\/)/.test(next) || /[\\\s]/.test(next)) return null;
  if (next === '/intra' || next.startsWith('/intra?') || next.startsWith('/intra/') || next.startsWith('/intra#')) return null;
  return next;
}

export type RouteErrorBody = {
  error?: { status?: number; message?: string; name?: string; details?: { bluCode?: string } };
};

/**
 * c7 / c8 / c11: a failed POST /api/auth/{provider} as Romanian copy. The CMS bluCode
 * AUTH:EMAIL_REQUIRED is the Facebook-without-email case; the only other copies are the web-only
 * ones listed in c8 (CMS unreachable, rate limit, the QA form's wrong password); everything else is
 * the generic error.
 */
export function messageFor(provider: Provider, status: number, body: RouteErrorBody | null): string {
  const err = body?.error;
  const bluCode = err?.details?.bluCode;
  if (bluCode === 'AUTH:EMAIL_REQUIRED') return MISSING_EMAIL_ERROR;
  if (bluCode) return GENERIC_ERROR;
  if (status === 502 || status === 503 || status === 504) return SERVER_ERROR;
  if (status === 429) return RATE_LIMIT_ERROR;
  if (provider === 'local' && status === 400) return LOCAL_ERROR;
  // Everything else — our route's own 400s (a bad Google code, an invalid Facebook token) included —
  // is fish's GENERIC_ERROR: the user cannot act on the detail.
  return GENERIC_ERROR;
}
