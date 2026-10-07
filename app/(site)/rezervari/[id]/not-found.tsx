import { DetailBackButton, DetailNotFound } from '@/components/templates/T3';
import { routes } from '@/lib/routes';

/** An id that cannot be a booking (c1): what is missing and the way to the list. */
export default function BookingNotFound() {
  return (
    <DetailNotFound
      title="Rezervarea nu a fost găsită"
      description="Linkul nu duce la nicio rezervare."
      href={routes.myBookings()}
      cta="Rezervările mele"
      back={<DetailBackButton fallbackHref={routes.myBookings()} ground="page" label="Înapoi la rezervări" />}
    />
  );
}
