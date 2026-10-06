'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { DetailBackButton, DetailError } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { markPageRetry } from './_components/RetryFocus';

/** Retries started per page (a retry that throws again mounts a new card), see concursuri/[id]/error.tsx. */
const retried = new Map<string, { n: number; at: number }>();
const RETRY_WINDOW_MS = 30_000;

/*
 * The lake could not be read, or the page crashed (fish ErrorScreen with «Încearcă din nou» and
 * the route's own ErrorBoundary — parity lakes.detail.c2, lakes.b.route-error-boundary): the T3
 * page error inside the shell, which keeps working. The retry re-renders the segment and is never
 * silent: busy while it runs, «Tot nu s-a putut încărca.» when it fails again.
 */
export default function LakeError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePathname() ?? '';
  const [pending, start] = useTransition();
  const [attempt] = useState(() => {
    const last = retried.get(pathname);
    return last && Date.now() - last.at < RETRY_WINDOW_MS ? last.n : 0;
  });
  useEffect(() => {
    // Handled: the card says so and offers the retry.
    console.warn('[balta]', error);
  }, [error]);

  return (
    <DetailError
      trail={[{ label: 'Bălți', href: routes.lakes() }]}
      back={<DetailBackButton fallbackHref={routes.lakes()} ground="page" />}
      heading="Balta nu a putut fi încărcată"
      description={`Nu am putut încărca pagina. Verifică conexiunea și încearcă din nou.${error.digest ? ` Cod: ${error.digest}` : ''}`}
      action={
        <>
          <Button
            aria-busy={pending || undefined}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (pending) return;
              retried.set(pathname, { n: attempt + 1, at: Date.now() });
              // On success the lake's title takes focus (RetryFocus), not <body>.
              markPageRetry();
              start(() => retry());
            }}
          >
            {pending ? 'Se încarcă…' : 'Încearcă din nou'}
          </Button>
          {attempt > 0 && !pending ? <p className="t-caption text-muted">Tot nu s-a putut încărca. Încercarea {attempt + 1}.</p> : null}
          <span role="status" className="sr-only">
            {attempt > 0 && !pending ? 'Tot nu s-a putut încărca.' : ''}
          </span>
        </>
      }
    />
  );
}
