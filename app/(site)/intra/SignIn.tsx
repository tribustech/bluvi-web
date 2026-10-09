'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type MouseEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDaysIcon, TrophyIcon, UserCircleIcon } from '@heroicons/react/24/outline';
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
import { setSessionIdentity, startNewSession } from '@/lib/observability/report';
import { appleCredential, askFacebookEmailAgain, facebookCredential, googleCredential, preload, SignInError } from './sdk';

export type { SignInConfig } from './logic';

/*
 * account.sign-in — fish app/sign-in.tsx + features/onboarding/{useWelcomeSignIn,WelcomeControls,
 * WelcomeBackdrop,welcomeTheme}.ts. The welcome look is fish's: the dawn lake photo fading into
 * the deep-water ground, white provider buttons, white copy.
 *
 * Geometry (owner 2026-10-08: «the sign-in must look like a web page, not a phone screen blown
 * up»), always inside the site shell with its top bar:
 *  - <768 fish's screen itself (full bleed under the top bar, photo behind the top half);
 *  - 768–1023 one centred 520px card on the page: the photo as a band, then the intro and the
 *    providers on the page surface;
 *  - ≥1024 two columns capped at 1160: a landscape crop of the photo with the value line and three
 *    reasons to sign in on the left, a clean sign-in card (title, providers, legal) on the right.
 *
 * After the session cookie is set (POST /api/auth/{provider}): GET /user/profile decides where to go
 * (c15/c16), then the Firebase bridge runs in the background (c13) — never for a sign-in that
 * failed — and sign_in is logged (c21).
 * Then fish's active-partidă probe (c14) restores a live session in the background
 * (probeLivePartida).
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
    const [{ getRealtimeContext }, { signInToFirebase }] = await Promise.all([import('@/lib/client/firebase'), import('@/core/realtime')]);
    await signInToFirebase(getRealtimeContext(), token);
  } catch {
    // Non-fatal by contract.
  }
}

/**
 * c14: fish AuthContext finishSignIn → probeActiveSessionAfterSignIn, once per sign-in, after the
 * Firebase bridge, fire-and-forget: GET /feed/sessions/active and, when a partidă still runs
 * server-side, the pointer (two ids) stored in this browser for this account — the Partide live
 * layer picks it up on its next mount. A pointer write only (localStorage): never Firestore. Never
 * rejects, never delays the sign-in; loaded lazily so /intra does not carry the partide code.
 */
async function probeLivePartida(uid: string): Promise<void> {
  try {
    const [{ getActiveSession }, { probeActiveSessionAfterSignIn }, { localKeyValueStorage, POINTER_OWNER_KEY }] = await Promise.all([
      import('@/core/partide'),
      import('@/core/realtime/partide/live'),
      import('../partide/_live/storage'),
    ]);
    const t = createBrowserTransport();
    const pointer = await probeActiveSessionAfterSignIn(() => getActiveSession(t), localKeyValueStorage);
    if (pointer) await localKeyValueStorage.set(POINTER_OWNER_KEY, uid);
  } catch {
    // Non-fatal by contract (the live layer probes again on every /partide page).
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
      window.addEventListener('popstate', () => router.refresh(), {
        once: true,
      });
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
      // m8.sentry: a new session — the API-error dedupe re-arms; the id follows with the profile.
      startNewSession('valid');
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
        setSessionIdentity('none');
        throw new Error(GENERIC_ERROR);
      }
      setSessionIdentity('valid', profile.id);
      // c13: only now that the sign-in is whole; then c14 (fish: after the bridge).
      void bridgeFirebase(auth.firebaseToken).then(() => probeLivePartida(profile.documentId));
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
          setError(e.kind === 'missing-email' ? MISSING_EMAIL_ERROR : e.kind === 'sdk' && provider !== 'local' ? SDK_ERROR[provider] : GENERIC_ERROR);
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
    void run('local', async () => ({
      identifier: data.get('identifier'),
      password: data.get('password'),
    }));
  };

  return (
    <section
      aria-labelledby="intra-titlu"
      data-pending={busyNow || undefined}
      className={cn(
        // <768: fish's welcome screen, full bleed under the top bar.
        'relative isolate flex min-h-[calc(100dvh-56px)] flex-col overflow-hidden text-on-welcome',
        W.bg,
        // 768–1023: one centred card on the page, the photo as a band across its top.
        'md:mx-auto md:my-10 md:min-h-0 md:w-[calc(100%-64px)] md:max-w-[520px] md:rounded-bento md:border md:border-hairline md:bg-surface md:text-ink md:shadow-e2',
        // ≥1024: two columns — the photo panel with the value line, the sign-in card beside it.
        'lg:my-12 lg:grid lg:w-auto lg:max-w-[1160px] lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:px-8 lg:shadow-none xl:grid-cols-[minmax(0,1fr)_440px]'
      )}
    >
      {/* <1024 a pass-through (the photo and the intro are the section's own children); ≥1024 the
          landscape photo panel (5:4, 4:3 from 1280; never stretched to the card's height), the intro over its foot. */}
      <div data-intra-panel className="contents lg:relative lg:col-start-1 lg:row-start-1 lg:grid lg:aspect-[5/4] lg:min-w-0 xl:aspect-[4/3] lg:self-start">
        <Backdrop animate={!reduceMotion && !busyNow} />

        {/* The intro: under the sky <768, under the band in the card 768–1023, over the foot of the
          photo panel ≥1024 (same grid cell as the photo), with the three reasons to sign in. */}
        <div className="relative flex flex-1 flex-col px-6 pt-2 md:flex-none md:px-10 md:pt-7 lg:col-start-1 lg:row-start-1 lg:justify-end lg:px-12 lg:pt-12 lg:pb-12 lg:text-on-welcome">
          <div aria-hidden className="min-h-32 flex-1 md:hidden" />
          {/* <768 the intro can land on the photo's bright dawn band (its height follows the screen's):
              a scrim of its own, fading in above the eyebrow, keeps welcome-2 on it at AA (≥ 4.5:1,
              M8 a11y audit; fish's gradient alone left 2.1:1 over the sun). */}
          <div className="relative flex flex-col gap-3 pb-7 before:pointer-events-none before:absolute before:-inset-x-6 before:-top-20 before:-bottom-40 before:z-behind before:bg-[linear-gradient(180deg,transparent_0%,color-mix(in_srgb,var(--color-welcome)_92%,transparent)_80px)] before:content-[''] md:gap-2 md:pb-5 md:before:hidden lg:max-w-[520px] lg:gap-3 lg:pb-0">
            <p className={cn('t-label tracking-[2px]', W.secondary, 'md:text-accent-ink lg:text-welcome-2')}>MAI APROAPE DE CE IUBEȘTI</p>
            <h1 id="intra-titlu" className="t-hero text-on-welcome md:t-display md:text-ink lg:t-hero lg:text-on-welcome">
              Hai la pescuit.
            </h1>
            <p className={cn('t-title2 font-semibold', W.secondary, 'md:t-body md:text-muted lg:t-title2 lg:text-welcome-2')}>
              Locurile tale. Capturile tale. Comunitatea ta.
            </p>
            <ul aria-label="De ce să intri în cont" className="mt-5 hidden flex-col gap-4 lg:flex">
              {REASONS.map((r) => (
                <li key={r.title} className="flex items-center gap-3.5 xl:items-start">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-welcome-field text-on-welcome ring-1 ring-welcome-line"
                  >
                    <r.Icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5 xl:pt-0.5">
                    <span className="t-body-strong text-on-welcome">{r.title}</span>
                    <span className="hidden t-label text-welcome-2 xl:inline">{r.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* The sign-in: the foot of the screen <768, the card's body 768–1023, its own card ≥1024. */}
      <div className="relative flex flex-col px-6 pb-4 md:px-10 md:pb-8 lg:col-start-2 lg:row-start-1 lg:self-start lg:rounded-bento lg:border lg:border-hairline lg:bg-surface lg:px-10 lg:pt-10 lg:pb-8 lg:text-ink lg:shadow-e2">
        <div className="mb-6 hidden flex-col gap-1.5 lg:flex">
          <h2 className="t-title1 text-ink">Intră în contul tău</h2>
          <p className="t-body text-muted">Același cont ca în aplicația Bluvi.</p>
        </div>
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
            <p className={cn('t-body', W.secondary, 'md:text-muted')}>Autentificarea nu este disponibilă momentan. Încearcă mai târziu.</p>
          ) : null}

          {/* c9 / c20: one alert slot under the buttons, emptied when a new attempt starts. The card
              is top-anchored at every width (self-start ≥1024), so an error never moves the buttons
              just pressed. */}
          <p role="alert" aria-live="assertive" className={cn('t-body text-on-welcome md:text-status-danger-fg', !error && 'sr-only')}>
            {error}
          </p>

          {config.localAuth ? <LocalForm pending={pending === 'local'} disabled={busyNow} spaced={providers.length > 0} onSubmit={onLocal} /> : null}
        </div>

        <div className="py-3">
          <button
            type="button"
            onClick={continueAsGuest}
            disabled={busyNow}
            className={cn(
              't-body-strong flex min-h-11 w-full items-center justify-center rounded-control px-3 py-3 text-on-welcome md:text-accent-ink',
              busyNow ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-welcome-field active:opacity-80 md:hover:bg-soft-fill'
            )}
          >
            Explorează fără cont
          </button>
        </div>

        <div className={cn('border-t pt-3 md:border-hairline', W.border)}>
          <p className={cn('t-caption text-center', W.secondary, 'md:text-muted')}>
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

/** ≥1024, under the value line: what an account gets you on Bluvi (the web's own copy). */
const REASONS = [
  {
    Icon: TrophyIcon,
    title: 'Concursuri live',
    body: 'Clasamente și cântăriri în timp real, înscrieri din câteva atingeri.',
  },
  {
    Icon: CalendarDaysIcon,
    title: 'Rezervări la bălți',
    body: 'Alegi balta și standul, rezervi direct, fără telefoane.',
  },
  {
    Icon: UserCircleIcon,
    title: 'Profilul tău de pescar',
    body: 'Capturile, partidele și statisticile tale, într-un singur loc.',
  },
] as const;

/**
 * fish WelcomeBackdrop: the dawn lake, a slow 16s camera push (scale 1.025 → 1.08, up 10px,
 * ease-out quad) and a gradient into the ground. The push runs only without reduced motion and
 * pauses while a sign-in is pending (fish `animate && !pending`), resuming from where it stopped.
 *
 * The photo is a 941×1672 portrait: <768 it fills the screen as in fish; 768–1023 it is a 176px
 * band across the card; ≥1024 a 4:3 landscape crop filling the left panel (≤ 660px wide at the
 * 1160 cap, so the 941px source is always downscaled, never stretched).
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
    motion.current = el.animate([{ transform: 'scale(1.025) translateY(0)' }, { transform: 'scale(1.08) translateY(-10px)' }], {
      duration: 16000,
      easing: 'cubic-bezier(0.5, 1, 0.89, 1)',
      fill: 'forwards',
    });
  }, [animate]);

  useEffect(
    () => () => {
      motion.current?.cancel();
      motion.current = null;
    },
    []
  );

  return (
    <div
      aria-hidden
      data-intra-visual
      className={cn(
        'pointer-events-none absolute inset-x-0 top-0 z-behind h-[calc(100dvh-56px)] overflow-hidden',
        'md:relative md:inset-auto md:z-auto md:h-44 md:shrink-0',
        'lg:col-start-1 lg:row-start-1 lg:h-auto lg:rounded-bento lg:shadow-e2'
      )}
    >
      <div ref={camera} data-backdrop className="absolute inset-0 scale-[1.025]">
        <Image
          src={lakeDawn}
          alt=""
          fill
          placeholder="blur"
          fetchPriority="high"
          loading="eager"
          sizes="(min-width: 1024px) 700px, (min-width: 768px) 520px, 100vw"
          className="object-cover object-[50%_30%] md:object-[50%_27%] lg:object-[50%_32%]"
        />
      </div>
      {/* <768 fish's login gradient: 0.10 → 0.32 at 20% → solid from 53%. 768–1023 the band is the
          bare photo. ≥1024 a scrim rising from the panel's foot under the value line (higher 1024–1279,
          where the intro takes more of the panel). */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-welcome)_10%,transparent)_0%,color-mix(in_srgb,var(--color-welcome)_32%,transparent)_20%,var(--color-welcome)_53%,var(--color-welcome)_100%)] md:bg-none lg:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-welcome)_0%,transparent)_8%,color-mix(in_srgb,var(--color-welcome)_55%,transparent)_34%,color-mix(in_srgb,var(--color-welcome)_88%,transparent)_70%,var(--color-welcome)_100%)] xl:bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-welcome)_0%,transparent)_25%,color-mix(in_srgb,var(--color-welcome)_55%,transparent)_52%,color-mix(in_srgb,var(--color-welcome)_88%,transparent)_78%,var(--color-welcome)_100%)]" />
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
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-welcome md:focus-visible:outline-accent',
        // On the page surface (≥768) the white button needs its edge.
        'md:min-h-13 md:rounded-control md:shadow-[inset_0_0_0_1px_var(--color-hairline)]',
        disabled
          ? cn('cursor-not-allowed', !pending && 'opacity-50')
          : 'cursor-pointer hover:bg-welcome-button-hover active:scale-[0.98] active:opacity-80 motion-reduce:active:scale-100'
      )}
    >
      <span className="flex w-[238px] max-w-full items-center gap-3">
        <span aria-hidden className="flex size-6 shrink-0 items-center justify-center">
          {pending ? <Spinner /> : PROVIDER_MARK[provider]()}
        </span>
        <span className={cn('text-left text-welcome-provider/6 font-medium md:t-body-strong', W.ink)}>
          {PROVIDER_LABEL[provider]}
        </span>
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
      className="t-caption inline-flex min-h-11 items-center rounded-control px-1 py-2.5 text-on-welcome underline underline-offset-2 hover:text-welcome-2 md:text-ink-2 md:hover:text-ink"
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
    <form onSubmit={onSubmit} className={cn('flex flex-col gap-3', spaced && cn('mt-2 border-t pt-4 md:border-hairline', W.border))}>
      <p className={cn('t-label', W.secondary, 'md:text-muted')}>Cont de test (doar QA)</p>
      <label className="flex flex-col gap-1.5">
        <span className={cn('t-label', W.secondary, 'md:text-muted')}>Email</span>
        <input name="identifier" type="email" autoComplete="username" required className={INPUT} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={cn('t-label', W.secondary, 'md:text-muted')}>Parolă</span>
        <input name="password" type="password" autoComplete="current-password" required className={INPUT} />
      </label>
      <button
        type="submit"
        disabled={disabled && !pending}
        aria-disabled={disabled || undefined}
        aria-busy={pending || undefined}
        className={cn(
          't-body-strong flex h-12 items-center justify-center gap-2 rounded-2xl bg-welcome-accent px-4 text-on-welcome md:rounded-control',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-welcome md:focus-visible:outline-accent',
          disabled ? cn('cursor-not-allowed', !pending && 'opacity-50') : 'cursor-pointer hover:opacity-90 active:opacity-80'
        )}
      >
        {pending ? 'Se conectează…' : 'Intră'}
      </button>
    </form>
  );
}

const INPUT = cn(
  't-body h-12 rounded-control bg-welcome-field px-3.5 text-on-welcome outline-none shadow-[inset_0_0_0_1px_var(--color-welcome-line)] focus-visible:shadow-[inset_0_0_0_2px_var(--color-on-welcome)]',
  'md:bg-surface md:text-ink md:shadow-[inset_0_0_0_1px_var(--color-hairline)] md:focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent)]'
);

/* Provider marks: brand colours are fixed by the providers, so raw hex here is deliberate. */
function GoogleMark() {
  return (
    <svg viewBox="-3 0 262 262" className="size-5">
      <path
        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
        fill="#4285F4"
      />
      <path
        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
        fill="#34A853"
      />
      <path
        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782"
        fill="#FBBC05"
      />
      <path
        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
        fill="#EB4335"
      />
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
