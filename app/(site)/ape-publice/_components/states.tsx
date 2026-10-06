'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { MarkNotFound, SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
import { DetailBackButton, DetailError, DetailNotFound, DetailSkeleton } from '@/components/templates/T3';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { markWaterRetry } from './retryFocus';
import { LAKES_CRUMB, PUBLIC_WATERS_CRUMB } from './trail';

/*
 * The whole-page states every /ape-publice/<id> screen shares — fish exports `RouteState` from
 * [id].tsx for exactly this (loading: spinner + back; not found: «Apa publică nu a fost găsită.»
 * without a retry; error: «Nu am putut încărca …» + «Încearcă din nou»). Parity
 * public-waters.detaliu.c2/c3, harta.c1/c2.
 *
 * One breadcrumb band, the shell's (as on /balti/<id>): the states never draw their own, so
 * nothing moves when the page lands. Loading leaves the band's placeholder; the error names
 * itself in it; not found drops it (MarkNotFound, a 404 is in no section).
 */

const back = <DetailBackButton fallbackHref={routes.publicWaters()} ground="page" />;

/** Loading: the page's own shape in grey with the back chip, announced once. */
export function WaterLoading() {
  return (
    <DetailSkeleton
      photo
      // The map band's height at every width (WaterHero: photoHeroHeight(2)), so nothing moves
      // when the page lands.
      photoCount={2}
      back={<DetailBackButton fallbackHref={routes.publicWaters()} onPhoto />}
      columns={{ layout: 'summary', aside: true }}
      header={{ meta: 1, actions: true }}
      label="Se încarcă apa publică"
      heading="Apă publică"
    />
  );
}

export function WaterNotFound() {
  return (
    <>
      <MarkNotFound />
      <DetailNotFound
        title="Apa publică nu a fost găsită."
        description="Linkul poate fi greșit sau apa nu mai există în setul de date ANAR. Caută-o pe hartă."
        href={routes.publicWaters()}
        cta="Vezi harta apelor publice"
        back={back}
      />
    </>
  );
}

/** Retries started per page (a retry that throws again mounts a new card), as balti/[id]/error.tsx. */
const retried = new Map<string, { n: number; at: number }>();
const RETRY_WINDOW_MS = 30_000;

/**
 * «Încearcă din nou» re-renders the segment (the read runs again); busy while it does, and never
 * silent: a retry that fails again mounts a new card, which reads the attempt from `retried` and
 * says «Tot nu s-a putut încărca.». On success the page's <h1> takes focus (retryFocus.tsx).
 */
export function WaterError({
  error,
  retry,
  heading,
  backHref,
}: {
  error: Error & { digest?: string };
  retry: () => void;
  heading: string;
  /** A subpage's error: back (and the band's crumb) to the water's own page, not the map. */
  backHref?: string;
}) {
  const pathname = usePathname() ?? '';
  const [pending, start] = useTransition();
  const [attempt] = useState(() => {
    const last = retried.get(pathname);
    return last && Date.now() - last.at < RETRY_WINDOW_MS ? last.n : 0;
  });
  useEffect(() => {
    // Handled: the card says so and offers the retry.
    console.warn('[apa-publica]', error);
  }, [error]);
  const again = attempt > 0 && !pending;
  return (
    <>
      <SetBreadcrumb trail={backHref ? [LAKES_CRUMB, PUBLIC_WATERS_CRUMB, { label: 'Apa publică', href: backHref }, { label: 'Eroare' }] : [LAKES_CRUMB, PUBLIC_WATERS_CRUMB, { label: 'Eroare' }]} />
      <DetailError
        back={backHref ? <DetailBackButton fallbackHref={backHref} ground="page" /> : back}
        heading={heading}
        description="Verifică conexiunea și încearcă din nou în câteva momente."
        action={
          <>
            <Button
              aria-busy={pending || undefined}
              aria-disabled={pending || undefined}
              onClick={() => {
                if (pending) return;
                retried.set(pathname, { n: attempt + 1, at: Date.now() });
                markWaterRetry();
                start(() => retry());
              }}
            >
              {pending ? 'Se încarcă…' : 'Încearcă din nou'}
            </Button>
            {again ? <p className="t-caption text-muted">Tot nu s-a putut încărca.</p> : null}
            <span role="status" className="sr-only">
              {again ? 'Tot nu s-a putut încărca.' : ''}
            </span>
          </>
        }
      />
    </>
  );
}
