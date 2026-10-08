/*
 * Shared operator UI (M7, docs/parity/areas/operator.yml): the booking detail dialog
 * (operator.detaliu-rezervare) and the angler reputation parts it shares with the inbox cards.
 * The accept / reject / cancel dialogs live in ./actions (operator.actiuni-rezervare).
 */
export { BookingDetailDialog } from './detail/BookingDetailDialog';
export { BookingDetailActions, BookingDetailBody } from './detail/BookingDetailBody';
export { BookingDetailSkeleton } from './detail/BookingDetailSkeleton';
export { BOOKING_DETAIL_PARAM, bookingDetailUrl, useBookingDetailParam } from './detail/useBookingDetailParam';
export {
  actionVariant,
  bookingDetailModel,
  noShowText,
  rateAnglerHref,
  ratingText,
  type ActionVariant,
  type BookingDetailModel,
} from './detail/model';
export { AnglerRatingBadge } from './AnglerRatingBadge';
export { NoShowPill } from './NoShowPill';
