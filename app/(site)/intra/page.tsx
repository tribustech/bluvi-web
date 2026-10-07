import type { Metadata } from 'next';
import { SignIn } from './SignIn';
import type { SignInConfig } from './logic';

export const metadata: Metadata = {
  title: 'Intră',
  description: 'Intră în contul tău Bluvi cu Google, Facebook sau Apple.',
  robots: { index: false },
};

/** Which sign-in methods are configured. A provider without its id (or Google without the secret
 * the code exchange needs) is hidden rather than shown broken (account.sign-in.c2). */
function signInConfig(): SignInConfig {
  return {
    googleClientId: (process.env.GOOGLE_CLIENT_SECRET && process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID) || undefined,
    facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || undefined,
    appleServicesId: process.env.NEXT_PUBLIC_APPLE_SERVICES_ID || undefined,
    appleRedirectUri: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || undefined,
    localAuth: process.env.ENABLE_LOCAL_AUTH === '1',
  };
}

/**
 * /intra?next=<path> (account.sign-in, T6 single task). Static: the page never reads the session.
 * A visitor who is already signed in sees the same screen and may sign in again (the new session
 * replaces the cookie); every entry point to /intra is shown to guests only.
 */
export default function SignInPage() {
  return <SignIn config={signInConfig()} />;
}
