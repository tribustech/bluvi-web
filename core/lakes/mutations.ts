import type { InfiniteData, Query, QueryClient, QueryKey } from '@tanstack/react-query';
import { mutationOptions } from '../shared';
import type { Transport } from '../transport';
import {
  createLakeBookingInterest,
  createLakeClaim,
  deleteReview,
  editReview,
  postReview,
  sendLakeSuggestion,
} from './api';
import { calculateOptimisticReviewMeta } from './domain/reviews';
import { lakeReviewsKeys, lakesKeys } from './queries';
import type {
  GetReviewsForLakeResponse,
  LakeBookingInterestSource,
  LakeClaimInput,
  LakeSuggestionRequest,
  Review,
  ReviewMeta,
  ReviewReqBody,
} from './schemas';

/**
 * core/booking `bookingKeys.toReview` (fish `queryKeys.bookings.toReview`), spelled out: lakes may not
 * import booking (core-domain-deps). Keep the two in step.
 */
const BOOKINGS_TO_REVIEW = ['bookings', 'to-review'] as const;

/* ------------------------------------------------------------------------------------------------
 * Lake reviews (fish features/reviews/mutations.ts)
 * ---------------------------------------------------------------------------------------------- */

/** fish `invalidateReviewQueries` */
export function invalidateReviewQueries(qc: QueryClient, lakeId: string) {
  qc.invalidateQueries({ queryKey: lakeReviewsKeys.byLakeId(lakeId) });
  qc.invalidateQueries({ queryKey: lakesKeys.byId(lakeId) });
  qc.invalidateQueries({ queryKey: lakeReviewsKeys.myReviewByLakeId(lakeId) });
  qc.invalidateQueries({ queryKey: lakesKeys.all });
  // "Rezervările mele" prompts for the lakes with no review yet. That list is served by its own
  // endpoint, not by any review query, so writing a review leaves the prompt up until this key is
  // dropped too.
  qc.invalidateQueries({ queryKey: BOOKINGS_TO_REVIEW });
}

type ReviewFields = Pick<ReviewReqBody, 'quality' | 'facilities' | 'atmosphere' | 'recommendToOthers' | 'comment'>;

function withEditedFields<T extends object>(review: T, body: ReviewFields): T {
  return {
    ...review,
    quality: body.quality,
    facilities: body.facilities,
    atmosphere: body.atmosphere,
    recommendToOthers: body.recommendToOthers,
    comment: body.comment,
  };
}

/** Optimistic "my review" after an edit. */
export function applyEditToMyReview(old: Review | null | undefined, body: ReviewFields) {
  if (!old) return old;
  return withEditedFields(old, body);
}

/** Optimistic reviews list after an edit: replaces the fields of the user's own review. */
export function applyEditToReviewPages(
  old: InfiniteData<GetReviewsForLakeResponse> | undefined,
  oldReview: Pick<Review, 'documentId'> | null | undefined,
  body: ReviewFields
) {
  // Guards against a cache entry that is not the paginated shape (fish guards the same way).
  if (!old || !old.pages || !Array.isArray(old.pages)) return old;
  return {
    ...old,
    pages: old.pages.map(page => {
      if (!page || !page.data || !Array.isArray(page.data)) return page;
      return {
        ...page,
        data: page.data.map(review =>
          review && oldReview && review.documentId === oldReview.documentId ? withEditedFields(review, body) : review
        ),
      };
    }),
  };
}

type WithReviewsMeta = { documentId?: string; reviewsMeta?: ReviewMeta | null };

/** Optimistic lake detail after an edit: recomputes the aggregate from the old and new scores. */
export function applyEditToLakeMeta<T extends WithReviewsMeta>(old: T | undefined, oldReview: Review, body: ReviewReqBody) {
  if (!old?.reviewsMeta) return old;
  return { ...old, reviewsMeta: calculateOptimisticReviewMeta(old.reviewsMeta, oldReview, body) };
}

/** Optimistic lake lists (any `['lakes', …]` infinite list) after an edit. */
export function applyEditToLakePages(old: unknown, lakeId: string, oldReview: Review, body: ReviewReqBody) {
  const data = old as InfiniteData<{ data?: WithReviewsMeta[] }> | undefined;
  if (!data || !data.pages || !Array.isArray(data.pages)) return old;
  return {
    ...data,
    pages: data.pages.map(page => {
      if (!page || !page.data || !Array.isArray(page.data)) return page;
      return {
        ...page,
        data: page.data.map(lake =>
          lake && lake.documentId === lakeId && lake.reviewsMeta
            ? { ...lake, reviewsMeta: calculateOptimisticReviewMeta(lake.reviewsMeta, oldReview, body) }
            : lake
        ),
      };
    }),
  };
}

const isLakesQuery = (query: Query) => query.queryKey[0] === 'lakes' && Array.isArray(query.queryKey);

type EditReviewContext = {
  previousMyReview: unknown;
  previousReviewsList: unknown;
  previousLakeData: unknown;
  previousLakesLists: [QueryKey, unknown][];
};

/** fish `useEditReviewMutation` */
export function editReviewMutation(t: Transport, qc: QueryClient, lakeId: string) {
  return mutationOptions({
    mutationFn: ({ body, lakeId: id }: { body: ReviewReqBody; lakeId: string }) => editReview(t, body, id),
    onMutate: async ({ body }): Promise<EditReviewContext> => {
      await qc.cancelQueries({ queryKey: lakeReviewsKeys.myReviewByLakeId(lakeId) });
      await qc.cancelQueries({ queryKey: lakeReviewsKeys.byLakeId(lakeId) });
      await qc.cancelQueries({ queryKey: lakesKeys.byId(lakeId) });
      await qc.cancelQueries({ predicate: isLakesQuery });

      const previousMyReview = qc.getQueryData(lakeReviewsKeys.myReviewByLakeId(lakeId));
      const previousReviewsList = qc.getQueryData(lakeReviewsKeys.byLakeId(lakeId));
      const previousLakeData = qc.getQueryData(lakesKeys.byId(lakeId));
      const previousLakesLists = qc.getQueriesData({ predicate: isLakesQuery });

      const oldReview = previousMyReview as Review | undefined;

      qc.setQueryData(lakeReviewsKeys.myReviewByLakeId(lakeId), (old: Review | null | undefined) => applyEditToMyReview(old, body));
      qc.setQueryData(lakeReviewsKeys.byLakeId(lakeId), (old: InfiniteData<GetReviewsForLakeResponse> | undefined) =>
        applyEditToReviewPages(old, oldReview, body)
      );

      if (oldReview) {
        qc.setQueryData(lakesKeys.byId(lakeId), (old: WithReviewsMeta | undefined) => applyEditToLakeMeta(old, oldReview, body));
        // Optimistically update ALL lakes lists (main, filtered, search).
        qc.setQueriesData({ predicate: isLakesQuery }, (old: unknown) => applyEditToLakePages(old, lakeId, oldReview, body));
      }

      return { previousMyReview, previousReviewsList, previousLakeData, previousLakesLists };
    },
    onError: (_error, _vars, context) => {
      if (context?.previousMyReview !== undefined) {
        qc.setQueryData(lakeReviewsKeys.myReviewByLakeId(lakeId), context.previousMyReview);
      }
      if (context?.previousReviewsList !== undefined) {
        qc.setQueryData(lakeReviewsKeys.byLakeId(lakeId), context.previousReviewsList);
      }
      if (context?.previousLakeData !== undefined) {
        qc.setQueryData(lakesKeys.byId(lakeId), context.previousLakeData);
      }
      if (context?.previousLakesLists) {
        context.previousLakesLists.forEach(([queryKey, data]) => {
          qc.setQueryData(queryKey, data);
        });
      }
      // fish: showErrorToast(error.message).
    },
    // fish onSuccess: success toast "Recenzia a fost editată cu succes!" + router.dismiss().
    onSettled: () => invalidateReviewQueries(qc, lakeId),
  });
}

/** fish `usePostReviewMutation` */
export function postReviewMutation(t: Transport, qc: QueryClient, lakeId: string) {
  return mutationOptions({
    mutationFn: ({ body, lakeId: id }: { body: ReviewReqBody; lakeId: string }) => postReview(t, body, id),
    // fish onSuccess: toast "Recenzia a fost adăugată cu succes!" + router.dismiss(); onError: error toast.
    onSettled: () => invalidateReviewQueries(qc, lakeId),
  });
}

/** fish `useDeleteReviewMutation` — no cache work in fish; the caller invalidates. */
export function deleteReviewMutation(t: Transport) {
  return mutationOptions({
    mutationFn: ({ reviewId, lakeId }: { reviewId: string; lakeId: string }) => deleteReview(t, reviewId, lakeId),
  });
}

/* ------------------------------------------------------------------------------------------------
 * Suggestions, claims, booking interest — no cache work in fish
 * ---------------------------------------------------------------------------------------------- */

/** fish `services/mutations/useSendLakeRequest.ts#useSendLakeSuggestion` */
export function sendLakeSuggestionMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (body: LakeSuggestionRequest) => sendLakeSuggestion(t, body),
  });
}

/** fish `LakeClaimSheet` calls `createLakeClaim` directly (no hook); same call as a mutation. */
export function createLakeClaimMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (input: LakeClaimInput) => createLakeClaim(t, input),
  });
}

/** fish `LakeBookingInterestSheet` calls `createLakeBookingInterest` directly (no hook). */
export function createLakeBookingInterestMutation(t: Transport) {
  return mutationOptions({
    mutationFn: (input: { lakeId: string; source: LakeBookingInterestSource }) => createLakeBookingInterest(t, input),
  });
}
