'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/surfaces/StateCard';
import { Button, buttonClass } from '@/components/ui/Button';
import { captureException } from '@/lib/observability/report';
import { nunito } from './fonts';
import './globals.css';

/*
 * Last line of defence (m8.sentry, fish app/_layout.tsx Sentry.ErrorBoundary → AppErrorFallback):
 * the root layout itself failed, so this page brings its own <html>, fonts and styles. Same look
 * as app/(site)/error.tsx (kit ErrorState), without the shell. The way home is a plain link: a full
 * reload, since the client router may be what broke.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    captureException(error, { level: 'fatal', tags: { boundary: 'global', ...(error.digest ? { digest: error.digest } : {}) } });
  }, [error]);

  return (
    <html lang="ro" className={nunito.variable}>
      <body className="min-h-dvh bg-page text-ink">
        <title>A apărut o eroare · Bluvi</title>
        <main className="mx-auto flex w-full max-w-[640px] flex-col gap-4 px-4 py-8 md:px-6 md:py-16">
          <h1 className="t-page-title">Ceva nu a mers bine</h1>
          <ErrorState
            title="Pagina nu s-a putut încărca."
            description={
              error.digest ? `Verifică conexiunea și încearcă din nou. Cod: ${error.digest}` : 'Verifică conexiunea și încearcă din nou.'
            }
            action={
              <Button size="compact" variant="secondary" onClick={() => retry()}>
                Reîncearcă
              </Button>
            }
          />
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload on purpose (see above) */}
          <a href="/" className={buttonClass({ variant: 'secondary', className: 'self-start' })}>
            Înapoi acasă
          </a>
        </main>
      </body>
    </html>
  );
}
