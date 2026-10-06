'use client';

import { useEffect, useState, useTransition } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { DetailBackButton, DetailError } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { markPageRetry } from '../_components/RetryFocus';

/** Retries started per page (a retry that throws again mounts a new card), as ../error.tsx. */
const retried = new Map<string, { n: number; at: number }>();
const RETRY_WINDOW_MS = 30_000;

/*
 * A subpage could not be read, or crashed (fish: each lake route has its own ErrorBoundary — a
 * retry card for that route only, the shell keeps working; parity lakes.b.route-error-boundary,
 * lakes.competitions.c5). The T3 page error with «Încearcă din nou»; the retry is never silent:
 * busy while it runs, «Tot nu s-a putut încărca.» when it fails again.
 */
export function SubError({
  error,
  retry,
  heading,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  heading: string;
}) {
  const pathname = usePathname() ?? '';
  const params = useParams<{ id?: string }>();
  const lakeHref = params?.id ? routes.lake(params.id) : routes.lakes();
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
      trail={[
        { label: 'Bălți', href: routes.lakes() },
        { label: 'Balta', href: lakeHref },
      ]}
      back={<DetailBackButton fallbackHref={lakeHref} ground="page" />}
      heading={heading}
      description={`Nu am putut încărca pagina. Verifică conexiunea și încearcă din nou.${error.digest ? ` Cod: ${error.digest}` : ''}`}
      action={
        <>
          <Button
            aria-busy={pending || undefined}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (pending) return;
              retried.set(pathname, { n: attempt + 1, at: Date.now() });
              // On success the subpage's h1 takes focus (SubRetryFocus), never <body>.
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
