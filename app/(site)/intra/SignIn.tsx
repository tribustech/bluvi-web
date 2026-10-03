'use client';

import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { appleCredential, facebookCredential, googleCredential, preload, SignInError } from './sdk';

export type SignInConfig = {
  googleClientId?: string;
  facebookAppId?: string;
  appleServicesId?: string;
  appleRedirectUri?: string;
  localAuth: boolean;
};

type Provider = 'google' | 'facebook' | 'apple' | 'local';

// Copy from fish features/onboarding/useWelcomeSignIn.ts.
const GENERIC_ERROR = 'Autentificarea nu a reușit. Te rugăm să încerci din nou.';
const MISSING_EMAIL_ERROR =
  'Facebook nu ne-a dat adresa ta de email. Permite accesul la email în fereastra Facebook sau intră cu Google ori Apple.';
const SDK_ERROR: Record<Exclude<Provider, 'local'>, string> = {
  google: 'Nu am putut deschide fereastra Google. Verifică conexiunea, permite ferestrele pop-up pentru Bluvi și încearcă din nou.',
  facebook: 'Nu am putut deschide fereastra Facebook. Verifică conexiunea, permite ferestrele pop-up pentru Bluvi și încearcă din nou.',
  apple: 'Nu am putut deschide fereastra Apple. Verifică conexiunea, permite ferestrele pop-up pentru Bluvi și încearcă din nou.',
};
const SERVER_ERROR = 'Serverul Bluvi nu răspunde acum. Încearcă din nou în câteva minute.';
const LOCAL_ERROR = 'Email sau parolă greșită.';

/** Only same-site paths: `/x`, never `//host` or `/\host`. */
export function safeNext(next: string | null): string {
  if (!next || !/^\/(?!\/)/.test(next) || /[\\\s]/.test(next) || next.startsWith('/intra')) return '/';
  return next;
}

type RouteErrorBody = { error?: { status?: number; message?: string; name?: string; details?: { bluCode?: string } } };

/** Turns a failed /api/auth answer into Romanian copy. */
function messageFor(provider: Provider, status: number, body: RouteErrorBody | null): string {
  const err = body?.error;
  if (err?.details?.bluCode === 'AUTH:EMAIL_REQUIRED') return MISSING_EMAIL_ERROR;
  if (status >= 500) return SERVER_ERROR;
  if (provider === 'local' && status === 400) return LOCAL_ERROR;
  // Our route's own 400s carry Romanian copy and no Strapi `name`; Strapi messages are English.
  if (status === 400 && err?.message && !err.name) return err.message;
  if (status === 429) return 'Prea multe încercări. Așteaptă un minut și încearcă din nou.';
  return GENERIC_ERROR;
}

async function post(provider: Provider, body: unknown): Promise<void> {
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
}

export function SignIn({ config }: { config: SignInConfig }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const run = async (provider: Provider, credential: () => Promise<unknown>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(provider);
    setError(null);
    try {
      await post(provider, await credential());
      // Anything cached while signed out (optional-auth reads) is now wrong.
      queryClient.clear();
      router.replace(safeNext(new URLSearchParams(window.location.search).get('next')));
      router.refresh();
    } catch (e) {
      if (e instanceof SignInError) {
        if (e.kind !== 'cancelled') {
          setError(
            e.kind === 'missing-email' ? MISSING_EMAIL_ERROR : e.kind === 'sdk' && provider !== 'local' ? SDK_ERROR[provider] : GENERIC_ERROR
          );
        }
      } else {
        setError(e instanceof Error && e.message ? e.message : GENERIC_ERROR);
      }
    } finally {
      busy.current = false;
      setPending(null);
    }
  };

  const { googleClientId, facebookAppId, appleServicesId } = config;
  const appleRedirect = () => config.appleRedirectUri || `${window.location.origin}/intra`;
  const hasSocial = Boolean(googleClientId || facebookAppId || appleServicesId);

  const onLocal = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    void run('local', async () => ({ identifier: data.get('identifier'), password: data.get('password') }));
  };

  return (
    <div className="flex flex-col gap-3">
      {appleServicesId ? (
        <ProviderButton
          label="Continuă cu Apple"
          icon={<AppleMark />}
          pending={pending === 'apple'}
          disabled={pending !== null}
          onWarm={() => preload('apple', {})}
          onClick={() => void run('apple', () => appleCredential(appleServicesId, appleRedirect()))}
        />
      ) : null}
      {googleClientId ? (
        <ProviderButton
          label="Continuă cu Google"
          icon={<GoogleMark />}
          pending={pending === 'google'}
          disabled={pending !== null}
          onWarm={() => preload('google', {})}
          onClick={() => void run('google', () => googleCredential(googleClientId))}
        />
      ) : null}
      {facebookAppId ? (
        <ProviderButton
          label="Continuă cu Facebook"
          icon={<FacebookMark />}
          pending={pending === 'facebook'}
          disabled={pending !== null}
          onWarm={() => preload('facebook', { facebookAppId })}
          onClick={() => void run('facebook', () => facebookCredential(facebookAppId))}
        />
      ) : null}

      {!hasSocial && !config.localAuth ? (
        <p className="t-body text-ink-2">Autentificarea nu este disponibilă momentan. Încearcă mai târziu.</p>
      ) : null}

      {config.localAuth ? (
        <form onSubmit={onLocal} className={cn('flex flex-col gap-3', hasSocial && 'mt-3 border-t border-hairline pt-5')}>
          <p className="t-label text-muted">Cont de test (doar QA)</p>
          <label className="flex flex-col gap-1.5">
            <span className="t-label text-ink-2">Email</span>
            <input name="identifier" type="email" autoComplete="username" required className={INPUT} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="t-label text-ink-2">Parolă</span>
            <input name="password" type="password" autoComplete="current-password" required className={INPUT} />
          </label>
          <Button type="submit" block disabled={pending !== null}>
            {pending === 'local' ? 'Se conectează…' : 'Intră'}
          </Button>
        </form>
      ) : null}

      <p role="alert" aria-live="assertive" className={cn('t-body text-status-danger-fg', !error && 'sr-only')}>
        {error}
      </p>
    </div>
  );
}

const INPUT =
  't-body h-12 rounded-control bg-soft-fill px-3.5 text-ink outline-none placeholder:text-muted focus-visible:bg-surface focus-visible:shadow-[inset_0_0_0_2px_var(--color-accent),0_0_0_4px_var(--color-accent-tint-2)] focus-visible:outline-none xl:h-10';

function ProviderButton({
  label,
  icon,
  pending,
  disabled,
  onWarm,
  onClick,
}: {
  label: string;
  icon: ReactNode;
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
      disabled={disabled}
      aria-busy={pending || undefined}
      className={cn(
        't-body-strong relative flex h-12 w-full items-center justify-center gap-3 rounded-control bg-surface px-5 text-ink shadow-[inset_0_0_0_1px_var(--color-hairline),var(--shadow-e1)] transition-[background-color,opacity] duration-(--duration-fast) ease-fast',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-soft-fill active:opacity-80'
      )}
    >
      <span aria-hidden className="flex size-5 items-center justify-center">
        {icon}
      </span>
      {pending ? 'Se conectează…' : label}
    </button>
  );
}

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

/** Apple logo in the text colour (black on light, white on dark), as Apple's guidelines ask. */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5">
      <path d="M16.365 1.43c0 1.14-.462 2.236-1.21 3.026-.8.85-2.1 1.505-3.15 1.42-.135-1.11.42-2.27 1.17-3.05.83-.87 2.24-1.52 3.19-1.396zM20.5 17.03c-.56 1.29-.83 1.87-1.55 3.01-1.01 1.59-2.43 3.57-4.19 3.58-1.57.02-1.97-1.02-4.1-1.01-2.13.01-2.57 1.03-4.14 1.01-1.76-.02-3.11-1.8-4.12-3.39C-.43 15.82-.73 10.5 1.08 7.7c1.29-2 3.32-3.17 5.23-3.17 1.95 0 3.17 1.07 4.78 1.07 1.56 0 2.51-1.07 4.77-1.07 1.7 0 3.5.93 4.78 2.53-4.2 2.3-3.52 8.29-.14 9.97z" />
    </svg>
  );
}
