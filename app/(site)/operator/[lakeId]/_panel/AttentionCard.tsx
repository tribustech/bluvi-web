'use client';

import { StarIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { DashboardLine, DashboardLines } from '@/components/templates/T5';
import { cancelledTitle, reviewTitle } from './model';

/**
 * c20 / c21 — fish DashboardBody «drop-outs / review queue» card, right under the day it affects:
 * the anglers' cancellations of the last 24 h (news) and the finished stays still owed a rating (a
 * queue, so last). Each line links to its inbox bucket with a text link (the alert owns the page's
 * one filled button); a line at 0 is not drawn, and with both at 0 the card is not drawn at all.
 */
export function AttentionCard({ cancelled, toReview, links }: { cancelled: number; toReview: number; links: { cancelled: string; toReview: string } }) {
  if (cancelled <= 0 && toReview <= 0) return null;
  return (
    <DashboardLines label="De urmărit">
      {cancelled > 0 ? (
        <DashboardLine
          tone="red"
          icon={<XCircleIcon />}
          title={cancelledTitle(cancelled)}
          description="în ultimele 24 de ore · standurile sunt din nou libere"
          action={{ href: links.cancelled, label: 'Vezi', srLabel: 'Vezi rezervările anulate' }}
        />
      ) : null}
      {toReview > 0 ? (
        <DashboardLine
          tone="indigo"
          icon={<StarIcon />}
          title={reviewTitle(toReview)}
          description="încheiate fără notă"
          action={{ href: links.toReview, label: 'Vezi', srLabel: 'Vezi partidele de evaluat' }}
        />
      ) : null}
    </DashboardLines>
  );
}
