'use client';

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import { DetailError } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';

/** Retries this boundary started, per page (a retry that throws again mounts a NEW card). */
const retried = new Map<string, { n: number; at: number }>();
const RETRY_WINDOW_MS = 30_000;

/*
 * The whole-page error of Știre and Sponsor (fish ErrorScreen: «Încearcă din nou» + back), on the
 * T3 DetailError with the page's own settled band from 768 (`trail`: Noutăți / Acasă, then
 * «Eroare»; the routes render their band themselves — SiteHeader OWN_BAND_ROUTES). The retry is
 * never silent — busy while it runs («Se încarcă…», focus stays on it), and a retry that fails
 * again says so, with the attempt (the competition page's pattern). A failed retry mounts a NEW
 * card: focus moves to its retry button (ListError focusOnMount), and the «Tot nu s-a putut
 * încărca.» status is written AFTER mount into the already-present live region, so screen readers
 * announce it (a region inserted with its text already in it is usually not read).
 * Kit gap: the competition's error boundary has the same retry; one T3 `DetailBoundaryError`.
 */
export function ArticleError({
  heading,
  digest,
  retry,
  back,
  trail,
}: {
  heading: string;
  /** The page's parents for the band from 768. */
  trail: Crumb[];
  digest?: string;
  retry: () => void;
  back: ReactNode;
}) {
  const pathname = usePathname() ?? '';
  const [pending, start] = useTransition();
  const [attempt] = useState(() => {
    const last = retried.get(pathname);
    return last && Date.now() - last.at < RETRY_WINDOW_MS ? last.n : 0;
  });
  const retryRef = useRef<HTMLButtonElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (attempt === 0) return;
    retryRef.current?.focus();
    // Written into the live region after it is in the DOM, so the change is announced.
    if (statusRef.current) statusRef.current.textContent = 'Tot nu s-a putut încărca.';
  }, [attempt]);
  useEffect(() => {
    if (pending && statusRef.current) statusRef.current.textContent = '';
  }, [pending]);
  const copy = 'Verifică conexiunea și încearcă din nou în câteva momente.';
  return (
    <DetailError
      trail={trail}
      back={back}
      heading={heading}
      description={digest ? `${copy} Cod: ${digest}` : copy}
      action={
        <>
          <Button
            ref={retryRef}
            aria-busy={pending || undefined}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (pending) return;
              retried.set(pathname, { n: attempt + 1, at: Date.now() });
              start(() => retry());
            }}
          >
            {pending ? 'Se încarcă…' : 'Încearcă din nou'}
          </Button>
          {attempt > 0 && !pending ? <p className="t-caption text-muted">Tot nu s-a putut încărca. Încercarea {attempt + 1}.</p> : null}
          <span ref={statusRef} role="status" className="sr-only" />
        </>
      }
    />
  );
}
