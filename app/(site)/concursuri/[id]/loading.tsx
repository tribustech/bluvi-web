import { CompetitionSkeleton } from './_components/CompetitionSkeleton';

/*
 * While the competition read is in flight (a live or upcoming id is not prerendered; a client
 * navigation from Acasă waits on the CMS): the T3 band of the loaded page — header and route tabs —
 * in grey. The status is not known yet, so the body is not guessed: page.tsx shows the body's own
 * skeleton (ranking, preview or plain) once the read says which, while the ranking is prefetched.
 *
 * Trade-off (page.tsx): this Suspense boundary commits the 200 before the read, so an unknown id is
 * a soft 404 (not-found UI + `noindex`) in `next dev` too — production already served those ids
 * from the prerendered shell, with the same soft 404.
 */
export default function CompetitionLoading() {
  return <CompetitionSkeleton variant="shell" />;
}
