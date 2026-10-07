import type { LakeBookingState } from '@/core/lakes';

/**
 * Whether the booking control has a channel behind it (owner rule 4 — never a «Rezervă» whose
 * target cannot book): a phone-booking lake (`legacy_phone`) books by calling, so without a phone
 * number there is nothing to jump to. Then the lake's website is the main action («Contactează
 * balta», LakeActions WebsiteCta), and without one there is no booking control at all — the
 * «Rezervare telefonică» pill and Direcții stay. Shared by the server page and the client controls.
 */
export function bookingReachable(lake: { bookingState: LakeBookingState; phone?: string | null }): boolean {
  return lake.bookingState !== 'legacy_phone' || !!lake.phone;
}

/** Whether the page has a main booking-or-contact control at all (the booking, or the website). */
export function hasBookingControl(lake: { bookingState: LakeBookingState; phone?: string | null; website?: string | null }): boolean {
  return bookingReachable(lake) || !!lake.website;
}
