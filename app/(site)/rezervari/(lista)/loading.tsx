import { MyBookingsSkeleton } from '../_components/frame';

/**
 * Navigating here: the same skeleton the page streams behind its gate. In the (lista) group so it
 * wraps the list only — at /rezervari it would also be the first paint of /rezervari/[id].
 */
export default function Loading() {
  return <MyBookingsSkeleton />;
}
