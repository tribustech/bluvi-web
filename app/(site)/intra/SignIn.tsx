'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getProfile, profileKeys } from '@/core/social';
import { track } from '@/lib/analytics';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { cn } from '@/components/ui/cn';
import lakeDawn from './lake-dawn.jpg';
import {
  GENERIC_ERROR,
  LINK_ERROR,
  MISSING_EMAIL_ERROR,
  messageFor,
  PRIVACY_URL,
  safeNext,
  SDK_ERROR,
  SERVER_ERROR,
  TERMS_URL,
  visibleProviders,
  type Provider,
  type RouteErrorBody,
  type SignInConfig,
  type SocialProvider,
} from './logic';
import { canGoBackInApp } from '@/lib/client/in-app-history';
import { rearmSessionGuard, signOutFirebaseQuietly } from '@/lib/client/session-expired';
import { appleCredential, askFacebookEmailAgain, facebookCredential, googleCredential, preload, SignInError } from './sdk';

export type { SignInConfig } from './logic';

/*
 * account.sign-in — fish app/sign-in.tsx + features/onboarding/{useWelcomeSignIn,WelcomeControls,
 * WelcomeBackdrop,welcomeTheme}.ts. The welcome look is fish's: the dawn lake photo fading into
 * the deep-water ground, white provider buttons, white copy.
 *
 * Geometry: <768 the screen itself (full bleed under the top bar, photo behind the top half);
 * 768–1279 the same screen as a bento card; ≥1280 a full-width bento split like Facebook's sign-in —
 * the photo with the intro on the left, the providers on a 480px column on the right.
 *
 * After the session cookie is set (POST /api/auth/{provider}): GET /user/profile decides where to go
 * (c15/c16), then the Firebase bridge runs in the background (c13) — never for a sign-in that
 * failed — and sign_in is logged (c21).
 * fish's active-partidă probe (c14) restores a live session in the background — the web has no
 * live partidă until M4, so there is nothing to restore yet.
 */

/** fish welcomeTheme.ts — a fixed palette (the screen is dark in both themes, like fish). */
const W = {
  bg: 'bg-welcome',
  ink: 'text-welcome-ink',
  secondary: 'text-welcome-2',
  border: 'border-welcome-line',
};

type AuthOk = { firebaseToken?: string | null };

async function post(provider: Provider, body: unknown): Promise<AuthOk> {
  const res = await fetch(`/api/auth/${provider}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res) throw new Error(SERVER_ERROR);
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as RouteErrorBody | null;
    throw new Error(messageFor(provider, res.status, json));
  }
  return ((await res.json().catch(() => null)) as AuthOk | null) ?? {};
}

/**
 * c13: fish signInToFirebase(firebaseToken) — Firebase Auth only (chat, live partide later), never
 * a Firestore write. Background and non-fatal: a failure leaves Firestore unauthenticated until
 * a later re-mint (lib/client/firebase getCustomToken) and never fails or delays the sign-in.
 */
async function bridgeFirebase(token: string | null | undefined): Promise<void> {
  if (!token) return;
  try {
    const [{ getRealtimeContext }, { signInToFirebase }] = await Promise.all([
      import('@/lib/client/firebase'),
      import('@/core/realtime'),
    ]);
    await signInToFirebase(getRealtimeContext(), token);
  } catch {
    // Non-fatal by contract.
  }
}

function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
/** The live system preference (fish useWelcomeMotion: reduce until known, so the server says reduce). */
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => true
  );
}

export function SignIn({ config }: { config: SignInConfig }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const busyNow = pending !== null;
  // Leaving /intra while an attempt is in flight (browser Back): fish blocks the hardware back
  // while pending; the web cannot block Back, so a late success must not navigate from elsewhere.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // c4 on a phone: every popup must open inside the tap's user activation, so the SDKs are loaded
  // before the first tap (idle after first paint), not on the tap itself (sdk.ts preload).
  const { googleClientId, facebookAppId, appleServicesId } = config;
  useEffect(() => {
    const warm = () => {
      if (appleServicesId) preload('apple', {});
      if (googleClientId) preload('google', {});
      if (facebookAppId) preload('facebook', { facebookAppId });
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(warm, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 300);
    return () => window.clearTimeout(id);
  }, [googleClientId, facebookAppId, appleServicesId]);

  const finish = (incomplete: boolean) => {
    // c16 before c17: an incomplete profile always completes it first (replace: Back never
    // returns here). Otherwise a safe `next`, else back, else home.
    const target = incomplete ? routes.completeProfile() : safeNext(new URLSearchParams(window.location.search).get('next'));
    if (target) {
      router.replace(target);
      router.refresh();
    } else if (canGoBackInApp()) {
      // The page we return to was rendered signed out: re-render it once we are there.
      window.addEventListener('popstate', () => router.refresh(), { once: true });
      router.back();
    } else {
      router.replace(routes.home());
      router.refresh();
    }
  };

  const run = async (provider: Provider, credential: () => Promise<unknown>) => {
    // c5: one attempt at a time; a second press while one is in flight sends nothing.
    if (busy.current) return;
    busy.current = true;
    setPending(provider);
    setError(null);
    let navigating = false;
    try {
      const auth = await post(provider, await credential());
      rearmSessionGuard();
      if (!mounted.current) {
        // Signed in from a page the user already left: keep the session, re-render where they
        // are now, never navigate (account.sign-in.c23).
        void bridgeFirebase(auth.firebaseToken);
        queryClient.clear();
        router.refresh();
        return;
      }
      let profile;
      try {
        profile = await getProfile(createBrowserTransport());
      } catch {
        // c15: no profile → nothing stays stored (fish throws before navigating; the JWT it kept
        // would make a half signed-in app — the web drops the cookie instead, and any Firebase
        // user this browser still holds, as fish's sign-out does).
        await Promise.all([fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined), signOutFirebaseQuietly()]);
        throw new Error(GENERIC_ERROR);
      }
      // c13: only now that the sign-in is whole.
      void bridgeFirebase(auth.firebaseToken);
      // Anything cached while signed out (optional-auth reads) is now wrong; the profile is fresh.
      queryClient.clear();
      queryClient.setQueryData(profileKeys.my, profile);
      // c21: telemetry never holds up navigation (track swallows its own failures).
      track('sign_in', { sign_in_method: provider });
      if (!mounted.current) {
        router.refresh();
        return;
      }
      navigating = true;
      finish(!profile.isProfileComplete);
    } catch (e) {
      if (e instanceof SignInError) {
        // c6: a cancelled provider dialog is silent.
        if (e.kind !== 'cancelled') {
          setError(
            e.kind === 'missing-email' ? MISSING_EMAIL_ERROR : e.kind === 'sdk' && provider !== 'local' ? SDK_ERROR[provider] : GENERIC_ERROR
          );
        }
      } else {
        const message = e instanceof Error && e.message ? e.message : GENERIC_ERROR;
        // c7 via the CMS (AUTH:EMAIL_REQUIRED): the retry must show Facebook's email box again.
        if (message === MISSING_EMAIL_ERROR) askFacebookEmailAgain();
        setError(message);
      }
    } finally {
      // On success the screen stays locked until the next page replaces it.
      if (!navigating) {
        busy.current = false;
        setPending(null);
      }
    }
  };

  const continueAsGuest = () => {
    if (busy.current) return;
    if (canGoBackInApp()) router.back();
    else router.replace(routes.home());
  };

  const openLegal = (e: MouseEvent<HTMLAnchorElement>, url: string) => {
    // A modified click (new tab / window) is the browser's own business.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    setError(null);
    let win: Window | null = null;
    try {
      win = window.open(url, '_blank');
    } catch {
      win = null;
    }
    // c20: fish Linking.openURL rejecting ↔ the browser refusing the window.
    if (!win) setError(LINK_ERROR);
    else win.opener = null;
  };

  const providers = visibleProviders(config);
  const appleRedirect = () => config.appleRedirectUri || `${window.location.origin}/intra`;
  const credentialFor: Record<SocialProvider, () => Promise<unknown>> = {
    apple: () => appleCredential(config.appleServicesId!, appleRedirect()),
    google: () => googleCredential(config.googleClientId!),
    facebook: () => facebookCredential(config.facebookAppId!),
  };

  const onLocal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void run('local', async () => ({ identifier: data.get('identifier'), password: data.get('password') }));
  };

  return (
    <section
      aria-labelledby="intra-titlu"
      data-pending={busyNow || undefined}
      className={cn(
        'relative isolate flex min-h-[calc(100dvh-56px)] flex-col overflow-hidden text-on-welcome',
        W.bg,
        'md:mx-auto md:my-8 md:min-h-[min(860px,calc(100dvh-128px))] md:max-w-[520px] md:rounded-bento md:shadow-e2',
        'xl:mx-8 xl:grid xl:min-h-[max(640px,calc(100dvh-128px))] xl:max-w-none xl:grid-cols-[minmax(0,1fr)_480px]'
      )}
    >
      <Backdrop animate={!reduceMotion && !busyNow} />

      {/* The intro: under the sky <1280; over the photo's foot on the left column ≥1280. Both
          columns are anchored to the same bottom line ≥1280 (the subtitle and the legal links). */}
      <div className="relative flex flex-1 flex-col px-6 pt-2 md:px-10 xl:justify-end xl:px-14 xl:pb-14">
        <div aria-hidden className="min-h-32 flex-1" />
        <div className="flex flex-col gap-3 pb-7 xl:max-w-[560px] xl:pb-0">
          <p className={cn('t-label tracking-[2px]', W.secondary)}>MAI APROAPE DE CE IUBEȘTI</p>
          <h1 id="intra-titlu" className="t-hero text-on-welcome">
            Hai la pescuit.
          </h1>
          <p className={cn('t-title2 font-semibold', W.secondary)}>Locurile tale. Capturile tale. Comunitatea ta.</p>
        </div>
      </div>

      <div className="relative flex flex-col px-6 pb-4 md:px-10 md:pb-8 xl:justify-end xl:px-12 xl:pt-14 xl:pb-11">
        <div className="flex flex-col gap-3">
          {providers.map((p) => (
            <ProviderButton
              key={p}
              provider={p}
              pending={pending === p}
              disabled={busyNow}
              onWarm={() => preload(p, { facebookAppId: config.facebookAppId })}
              onClick={() => void run(p, credentialFor[p])}
            />
          ))}

          {providers.length === 0 && !config.localAuth ? (
            <p className={cn('t-body', W.secondary)}>Autentificarea nu este disponibilă momentan. Încearcă mai târziu.</p>
          ) : null}

          {/* c9 / c20: one alert slot under the buttons, emptied when a new attempt starts. ≥1280 the
              column is bottom-anchored, so the slot keeps three lines of room: an error never moves
              the buttons the user just pressed. */}
          <div className="contents xl:block xl:min-h-18">
            <p role="alert" aria-live="assertive" className={cn('t-body text-on-welcome', !error && 'sr-only')}>
              {error}
            </p>
          </div>

          {config.localAuth ? <LocalForm pending={pending === 'local'} disabled={busyNow} spaced={providers.length > 0} onSubmit={onLocal} /> : null}

        </div>

        <div className="py-3">
          <button
            type="button"
            onClick={continueAsGuest}
            disabled={busyNow}
            className={cn(
              't-body-strong flex min-h-11 w-full items-center justify-center rounded-control px-3 py-3 text-on-welcome',
              busyNow ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-welcome-field active:opacity-80'
            )}
          >
            Explorează fără cont
          </button>
        </div>

        <div className={cn('border-t pt-3', W.border)}>
          <p className={cn('t-caption text-center', W.secondary)}>
            Continuând, accepți Termenii și condițiile. Află cum îți prelucrăm datele în Politica de confidențialitate.
          </p>
          <div className="flex flex-wrap justify-center gap-x-4">
            <LegalLink href={TERMS_URL} onClick={(e) => openLegal(e, TERMS_URL)}>
              Termeni și condiții
            </LegalLink>
            <LegalLink href={PRIVACY_URL} onClick={(e) => openLegal(e, PRIVACY_URL)}>
              Confidențialitate
            </LegalLink>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * fish WelcomeBackdrop: the dawn lake, a slow 16s camera push (scale 1.025 → 1.08, up 10px,
 * ease-out quad) and a gradient into the ground. The push runs only without reduced motion and
 * pauses while a sign-in is pending (fish `animate && !pending`), resuming from where it stopped.
 */
function Backdrop({ animate }: { animate: boolean }) {
  const camera = useRef<HTMLDivElement>(null);
  const motion = useRef<Animation | null>(null);

  useEffect(() => {
    const el = camera.current;
    if (!el || typeof el.animate !== 'function') return;
    if (!animate) {
      motion.current?.pause();
      return;
    }
    if (motion.current) {
      motion.current.play();
      return;
    }
    motion.current = el.animate(
      [{ transform: 'scale(1.025) translateY(0)' }, { transform: 'scale(1.08) translateY(-10px)' }],
      { duration: 16000, easing: 'cubic-bezier(0.5, 1, 0.89, 1)', fill: 'forwards' }
    );
  }, [animate]);

  useEffect(
    () => () => {
      motion.current?.cancel();
      motion.current = null;
    },
    []
  );

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-behind h-[calc(100dvh-56px)] overflow-hidden md:h-auto md:bottom-0 xl:right-[360px]">
      <div ref={camera} data-backdrop className="absolute inset-0 scale-[1.025]">
        <Image
          src={lakeDawn}
          alt=""
          fill
          placeholder="blur"
          fetchPriority="high"
          loading="eager"
          sizes="(min-width: 1280px) 70vw, (min-width: 768px) 520px, 100vw"
          className="object-cover object-[50%_30%]"
        />
      </div>
      {/* fish login gradient: 0.10 → 0.32 at 20% → solid from 53%. ≥1280 the photo bleeds 120px under
          the 480px panel and a long eased horizontal fade (from 40%, 88% where the panel starts, solid
          120px into it) dissolves the sky into it — one surface, no seam. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-welcome)_10%,transparent)_0%,color-mix(in_srgb,var(--color-welcome)_32%,transparent)_20%,var(--color-welcome)_53%,var(--color-welcome)_100%)] md:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-welcome)_10%,transparent)_0%,color-mix(in_srgb,var(--color-welcome)_32%,transparent)_22%,var(--color-welcome)_58%,var(--color-welcome)_100%)] xl:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-welcome)_5%,transparent)_0%,color-mix(in_srgb,var(--color-welcome)_20%,transparent)_45%,color-mix(in_srgb,var(--color-welcome)_92%,transparent)_85%,var(--color-welcome)_100%),linear-gradient(90deg,transparent_40%,color-mix(in_srgb,var(--color-welcome)_25%,transparent)_60%,color-mix(in_srgb,var(--color-welcome)_60%,transparent)_78%,color-mix(in_srgb,var(--color-welcome)_88%,transparent)_calc(100%-120px),var(--color-welcome)_100%)]" />
    </div>
  );
}

const PROVIDER_LABEL: Record<SocialProvider, string> = {
  apple: 'Continuă cu Apple',
  google: 'Continuă cu Google',
  facebook: 'Continuă cu Facebook',
};
const PROVIDER_MARK: Record<SocialProvider, () => ReactNode> = {
  apple: () => <AppleMark />,
  google: () => <GoogleMark />,
  facebook: () => <FacebookMark />,
};

/** fish WelcomeButton `provider`: white, 56px, the mark and label in a 238px left-aligned box. */
function ProviderButton({
  provider,
  pending,
  disabled,
  onWarm,
  onClick,
}: {
  provider: SocialProvider;
  pending: boolean;
  disabled: boolean;
  onWarm: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onPointerEnter={onWarm}
      onFocus={onWarm}
      // The pressed button stays focusable while pending (aria-disabled; run() ignores a second
      // press): a native `disabled` would drop focus to <body>, and a keyboard or screen-reader
      // user would start again from the top bar after an error or a cancel.
      disabled={disabled && !pending}
      aria-disabled={disabled || undefined}
      aria-busy={pending || undefined}
      data-provider={provider}
      className={cn(
        'flex min-h-14 w-full items-center justify-center rounded-2xl bg-welcome-button px-4 py-3.5 transition-[opacity,transform] duration-(--duration-fast) ease-fast',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-welcome',
        disabled
          ? cn('cursor-not-allowed', !pending && 'opacity-50')
          : 'cursor-pointer hover:bg-welcome-button-hover active:scale-[0.98] active:opacity-80 motion-reduce:active:scale-100'
      )}
    >
      <span className="flex w-[238px] max-w-full items-center gap-3">
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
          {pending ? <Spinner /> : PROVIDER_MARK[provider]()}
        </span>
        <span className={cn('text-left text-welcome-provider/6 font-medium', W.ink)}>{PROVIDER_LABEL[provider]}</span>
      </span>
      {pending ? <span className="sr-only">, se conectează…</span> : null}
    </button>
  );
}

/**
 * Turns via the Web Animations API, not a CSS animation: the global reduced-motion clamp
 * (globals.css, 120ms × 1) would stop a CSS spin after one turn and leave a static ring for the
 * whole sign-in. Under reduced motion it keeps turning, slower (fish: the only progress cue).
 */
function Spinner() {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    const spin = el.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
      duration: reduceMotion ? 1500 : 1000,
      iterations: Infinity,
      easing: 'linear',
    });
    return () => spin.cancel();
  }, [reduceMotion]);
  return <span ref={ref} data-spinner className="size-5 rounded-full border-2 border-welcome-ink/20 border-t-welcome-ink" />;
}

function LegalLink({ href, onClick, children }: { href: string; onClick: (e: MouseEvent<HTMLAnchorElement>) => void; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      className="t-caption inline-flex min-h-11 items-center rounded-control px-1 py-2.5 text-on-welcome underline underline-offset-2 hover:text-welcome-2"
    >
      {children}
    </a>
  );
}

/** QA only (ENABLE_LOCAL_AUTH=1): the local CMS account the e2e specs sign in with. */
function LocalForm({
  pending,
  disabled,
  spaced,
  onSubmit,
}: {
  pending: boolean;
  disabled: boolean;
  spaced: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form onSubmit={onSubmit} className={cn('flex flex-col gap-3', spaced && cn('mt-2 border-t pt-4', W.border))}>
      <p className={cn('t-label', W.secondary)}>Cont de test (doar QA)</p>
      <label className="flex flex-col gap-1.5">
        <span className={cn('t-label', W.secondary)}>Email</span>
        <input name="identifier" type="email" autoComplete="username" required className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={cn('t-label', W.secondary)}>Parolă</span>
        <input name="password" type="password" autoComplete="current-password" required className={INPUT} />
      </label>
      <button
        type="submit"
        disabled={disabled && !pending}
        aria-disabled={disabled || undefined}
        aria-busy={pending || undefined}
        className={cn(
          't-body-strong flex h-12 items-center justify-center gap-2 rounded-2xl bg-welcome-accent px-4 text-on-welcome',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-welcome',
          disabled ? cn('cursor-not-allowed', !pending && 'opacity-50') : 'cursor-pointer hover:opacity-90 active:opacity-80'
        )}
      >
        {pending ? 'Se conectează…' : 'Intră'}
      </button>
    </form>
  );
}

const INPUT =
  't-body h-12 rounded-control bg-welcome-field px-3.5 text-on-welcome outline-none shadow-[inset_0_0_0_1px_var(--color-welcome-line)] focus-visible:shadow-[inset_0_0_0_2px_var(--color-on-welcome)]';

/* Provider marks: brand colours are fixed by the providers, so raw hex here is deliberate. */
function GoogleMark() {
  return (
    <svg viewBox="-3 0 262 262" className="size-5">
      <path d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" fill="#4285F4" />
      <path d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" fill="#34A853" />
      <path d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" fill="#FBBC05" />
      <path d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" fill="#EB4335" />
    </svg>
  );
}

function FacebookMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        d="M16.671 15.469 17.203 12h-3.328V9.749c0-.949.465-1.874 1.956-1.874h1.513V4.922s-1.373-.234-2.686-.234c-2.741 0-4.533 1.661-4.533 4.669V12H7.078v3.469h3.047v8.385a12.1 12.1 0 0 0 3.75 0v-8.385h2.796Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/** fish Ionicons logo-apple, black on the white button. */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" fill="#000000" className="size-[22px]">
      <path d="M16.365 1.43c0 1.14-.462 2.236-1.21 3.026-.8.85-2.1 1.505-3.15 1.42-.135-1.11.42-2.27 1.17-3.05.83-.87 2.24-1.52 3.19-1.396zM20.5 17.03c-.56 1.29-.83 1.87-1.55 3.01-1.01 1.59-2.43 3.57-4.19 3.58-1.57.02-1.97-1.02-4.1-1.01-2.13.01-2.57 1.03-4.14 1.01-1.76-.02-3.11-1.8-4.12-3.39C-.43 15.82-.73 10.5 1.08 7.7c1.29-2 3.32-3.17 5.23-3.17 1.95 0 3.17 1.07 4.78 1.07 1.56 0 2.51-1.07 4.77-1.07 1.7 0 3.5.93 4.78 2.53-4.2 2.3-3.52 8.29-.14 9.97z" />
    </svg>
  );
}
