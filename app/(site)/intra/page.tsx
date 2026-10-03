import type { Metadata } from 'next';
import Link from 'next/link';
import { FishLogo } from '@/components/nav/brand';
import { SignIn, type SignInConfig } from './SignIn';

export const metadata: Metadata = {
  title: 'Intră',
  description: 'Intră în contul tău Bluvi cu Google, Facebook sau Apple.',
  robots: { index: false },
};

// fish common/utils/constants.ts
const TERMS_URL = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=14bbf816-7403-4ab1-87e9-0d0dcdd4175a';
const PRIVACY_URL = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=958c9787-3e75-4040-990d-cb6bf2c8b3e3';

/** Which sign-in methods are configured. A provider without its id (or Google without the secret
 * the code exchange needs) is hidden rather than shown broken. */
function signInConfig(): SignInConfig {
  return {
    googleClientId: (process.env.GOOGLE_CLIENT_SECRET && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) || undefined,
    facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || undefined,
    appleServicesId: process.env.NEXT_PUBLIC_APPLE_SERVICES_ID || undefined,
    appleRedirectUri: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || undefined,
    localAuth: process.env.ENABLE_LOCAL_AUTH === '1',
  };
}

export default function SignInPage() {
  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-start justify-center px-5 py-10 md:min-h-dvh md:items-center md:px-6 xl:min-h-[calc(100dvh-64px)]">
      <section
        aria-labelledby="intra-titlu"
        className="flex w-full max-w-[400px] flex-col gap-6 md:rounded-bento md:bg-surface md:p-8 md:shadow-e1"
      >
        <div className="flex flex-col gap-3">
          <FishLogo className="size-10 text-accent-ink" />
          <h1 id="intra-titlu" className="t-page-title">
            Intră în Bluvi
          </h1>
          <p className="t-body text-ink-2">Locurile tale. Capturile tale. Comunitatea ta.</p>
        </div>

        <SignIn config={signInConfig()} />

        <Link href="/" className="t-body-strong self-center rounded-control px-3 py-2 text-accent-ink hover:bg-soft-fill">
          Explorează fără cont
        </Link>

        <p className="t-caption border-t border-hairline pt-4 text-center text-muted">
          Continuând, accepți{' '}
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline">
            Termenii și condițiile
          </a>
          . Află cum îți prelucrăm datele în{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline">
            Politica de confidențialitate
          </a>
          .
        </p>
      </section>
    </div>
  );
}
