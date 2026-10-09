import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Crash } from './Crash';

/**
 * m8.sentry test page (tests/e2e/sentry-off.spec.ts): `?crash=render` throws while rendering. No
 * error.tsx sits between this page and the root layout, so the error reaches app/global-error.tsx.
 * Dev only: 404 in production builds.
 */
export default function ObservabilityTestPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    <main className="mx-auto max-w-[640px] px-4 py-8">
      <h1 className="t-page-title">Observability</h1>
      <Suspense>
        <Crash />
      </Suspense>
    </main>
  );
}
