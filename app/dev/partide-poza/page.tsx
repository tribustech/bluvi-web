import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { PhotoPreviewHarness } from './PhotoPreviewHarness';

/**
 * Dev-only harness for the capture flow's photo-preview step (partide.captura-poza), so its e2e
 * (tests/e2e/partida-captura-poza.spec.ts) proves the dialog on its own: a file input, the dialog,
 * and what «Gata» / «Renunță» handed back. Members come from the e2e Firestore fake
 * (`?sesiune=<clientId>`, tests/e2e/helpers/fake-live.ts). Nothing is written anywhere. 404 in
 * production builds.
 */
export default function PhotoPreviewHarnessPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return (
    <Suspense>
      <PhotoPreviewHarness />
    </Suspense>
  );
}
