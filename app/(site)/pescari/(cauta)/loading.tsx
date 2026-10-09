import { PescariPageLoading } from './_search/PescariScreen';

/**
 * Navigating here: the same page the route streams behind its gate (header, field, skeleton rows).
 * It lives in the (cauta) route group so it wraps /pescari only: at app/(site)/pescari/ it was the
 * outer Suspense of /pescari/[id], /sugerati and /conexiuni too, and a JS-off visitor of a profile
 * saw the search page's skeleton instead of the profile's (parity account.angler-profile c3, c31).
 */
export default function Loading() {
  return <PescariPageLoading />;
}
