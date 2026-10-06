'use client';

import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { Button } from '@/components/ui/Button';

/*
 * fish LakesLocationPermissionSheet (lakes.home.c19). Two modes:
 * - «permission» (denied): fish sends the user to the OS settings; a page cannot open the
 *   browser's site settings, so the web says where the switch is (the site-information icon next
 *   to the address) and closes;
 * - «services_off» (the browser has permission but no position): fish's «Activează» re-enables the
 *   provider; the web asks for the position again.
 */

export type LocationDialogMode = 'permission' | 'services_off';

const COPY: Record<LocationDialogMode, { title: string; body: string; howTo: string }> = {
  permission: {
    title: 'Găsește bălți aproape de tine',
    body: 'Activează localizarea ca să îți arătăm bălțile din apropiere.',
    howTo:
      'Locația e blocată pentru Bluvi în acest browser. Apasă pe iconița de lângă adresa paginii, alege „Locație” › „Permite”, apoi reîncarcă pagina.',
  },
  services_off: {
    title: 'Activează serviciile de locație',
    body: 'Locația dispozitivului este oprită. Activeaz-o ca să găsim bălți aproape de tine.',
    howTo: 'Pornește localizarea din setările dispozitivului, apoi încearcă din nou.',
  },
};

export function LocationDialog({
  mode,
  onClose,
  onRetry,
}: {
  /** null: closed. */
  mode: LocationDialogMode | null;
  onClose: () => void;
  /** services_off: ask the browser again. */
  onRetry: () => void;
}) {
  const copy = COPY[mode ?? 'permission'];
  return (
    // The kit surface rule (Fundații §07) for a decision: a Sheet on a phone (fish
    // LakesLocationPermissionSheet), a Dialog from 768 — Escape and the scrim close both.
    <ResponsiveSurface
      intent="decision"
      open={mode !== null}
      onClose={onClose}
      title={copy.title}
      actions={
        // The dialog stacks its actions on a phone and lines them up from 768; the sheet's footer
        // gets the same stack.
        <div className="flex w-full flex-col-reverse gap-2 md:w-auto md:flex-row md:justify-end">
          {mode === 'services_off' ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Renunță
              </Button>
              <Button onClick={onRetry}>Încearcă din nou</Button>
            </>
          ) : (
            <Button onClick={onClose} autoFocus>
              Am înțeles
            </Button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-2 t-body text-ink-2">
        <p>{copy.body}</p>
        <p className="t-caption text-muted">{copy.howTo}</p>
      </div>
    </ResponsiveSurface>
  );
}
