import { notFound } from 'next/navigation';

/**
 * Unmatched URLs inside the site: throwing here renders app/(site)/not-found.tsx inside the app
 * shell (the root not-found would render without the navigation). More specific routes —
 * /dev/kit, /api/*, metadata files — always win over this catch-all.
 */
// A 404 has nothing to prefetch instantly; without this the dev validator reports the thrown
// notFound() as "could not validate `instant`".
export const instant = false;

export default function Missing(): never {
  notFound();
}
