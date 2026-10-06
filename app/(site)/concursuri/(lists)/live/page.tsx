import { permanentRedirect } from 'next/navigation';
import { routes } from '@/lib/routes';

/*
 * fish app/(app)/competitions/started/index.tsx — parity competitions-list.live. WEB: the /concursuri
 * index's own tab (owner review 2026-10-06: one tab order and name, one card, one filter bar), so
 * this URL redirects there permanently.
 */
export default function Page() {
  permanentRedirect(routes.competitions('started'));
}
