"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/services/queries/query-keys";
import { getJson } from "@/services/api/_shared";
import { cn, timeAgo } from "@/lib/utils";
import type { Review, ReviewMeta } from "@/types";

function StarRating({ rating, size = "md" }: { rating: number; size?: "sm" | "md" }) {
  const px = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(px, star <= rating ? "fill-yellow-5 text-yellow-5" : "text-gray-2")}
        />
      ))}
    </div>
  );
}

export function LakeReviews({ lakeId, meta }: { lakeId: string; meta?: ReviewMeta }) {
  const [expanded, setExpanded] = useState(false);
  const { data: reviews } = useQuery({
    queryKey: queryKeys.reviews.byLake(lakeId),
    queryFn: () =>
      getJson<{ data: Review[] }>(
        `/reviews?filters[lake][documentId][$eq]=${lakeId}&sort=createdAt:desc&populate=author.avatar`,
      ).then((r) => r.data ?? []),
    enabled: expanded,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-7">Recenzii</h3>
          {meta?.averageRating ? (
            <div className="flex items-center gap-2">
              <StarRating rating={Math.round(meta.averageRating)} size="sm" />
              <span className="text-sm font-bold text-gray-7">{meta.averageRating.toFixed(1)}</span>
              <span className="text-sm text-gray-5">({meta.totalReviews} recenzii)</span>
            </div>
          ) : null}
        </div>
        {!expanded && (meta?.totalReviews ?? 0) > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-sm font-bold text-indigo-5 hover:text-indigo-7"
          >
            Vezi recenziile
          </button>
        )}
      </div>
      {expanded && reviews && (
        <div className="space-y-3">
          {reviews.length === 0 ? (
            <p className="text-sm text-gray-5">Nu exista recenzii inca.</p>
          ) : (
            reviews.map((review) => (
              <div key={review.documentId} className="surface-card rounded-card p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-1 text-sm font-bold text-indigo-7">
                      {review.author?.username?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <span className="text-sm font-bold text-gray-7">
                      {review.author?.username || "Anonim"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={review.rating} size="sm" />
                    {review.createdAt && (
                      <span className="text-xs text-gray-5">{timeAgo(review.createdAt)}</span>
                    )}
                  </div>
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-gray-5">{review.comment}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
      {!meta?.totalReviews && !expanded && (
        <p className="text-sm text-gray-5">Nu exista recenzii inca.</p>
      )}
    </div>
  );
}
