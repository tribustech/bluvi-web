'use client';

import { MapPinIcon } from '@heroicons/react/20/solid';
import { useState } from 'react';
import { CardShell, CardTitle, Tag } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { fmtCompetitionRange, type CompetitionHistoryItem } from '@/core/social';
import { routes } from '@/lib/routes';

/*
 * A competition on the profile's Concursuri tab — fish components/profile/CompetitionHistoryCard.tsx
 * (parity account.angler-profile c28, c29): the competition's image (the lake placeholder when it
 * has none) with the «Locul N» badge on it — gold for 1, grey for 2–3, accent for the rest, absent
 * when the placement is unknown — then the date range («5–7 SEP 2025», «30 SEP – 2 OCT 2025»), the
 * name on up to two lines, the lake with a pin, the «Echipe» / «Individual» tag. The whole card
 * opens /concursuri/{id} (the title is the stretched link).
 */

// The badge sits on the photo: each tint is laid over an opaque surface (fish's solid #FEF9C3 /
// #F2F2F2), never the translucent token alone, which lets the picture through and drowns the text.
const PLACEMENT: Record<'gold' | 'grey' | 'accent', string> = {
  gold: 'bg-surface bg-linear-to-r from-badge-yellow-bg to-badge-yellow-bg text-badge-yellow-fg',
  grey: 'bg-surface bg-linear-to-r from-status-neutral-bg to-status-neutral-bg text-status-neutral-fg',
  accent: 'bg-surface bg-linear-to-r from-accent-tint to-accent-tint text-accent-ink',
};

export function placementTone(placement: number): keyof typeof PLACEMENT {
  if (placement === 1) return 'gold';
  if (placement === 2 || placement === 3) return 'grey';
  return 'accent';
}

const PLACEHOLDER = '/images/placeholder-lake.jpg';

export function CompetitionHistoryCard({ item }: { item: CompetitionHistoryItem }) {
  const { competition, placement } = item;
  const range = fmtCompetitionRange(competition.startDate, competition.endDate);
  const [src, setSrc] = useState(competition.imageUrl || PLACEHOLDER);
  return (
    <CardShell interactive className="h-full w-full">
      <div className="flex flex-1">
        <div className="relative w-29 shrink-0 self-stretch bg-soft-fill md:w-32">
          {/* eslint-disable-next-line @next/next/no-img-element -- CMS image / the bundled placeholder at thumb size. */}
          <img
            src={src}
            alt=""
            loading="lazy"
            onError={() => setSrc(PLACEHOLDER)}
            className="absolute inset-0 size-full object-cover"
            data-testid="competition-image"
            data-placeholder={src === PLACEHOLDER || undefined}
          />
          {placement != null ? (
            <span
              className={cn('absolute top-1.5 left-1.5 rounded-full px-2 py-0.75 t-micro-strong', PLACEMENT[placementTone(placement)])}
              data-testid="placement"
              data-tone={placementTone(placement)}
            >
              Locul {placement}
            </span>
          ) : null}
        </div>
        <div className="flex min-h-25 min-w-0 flex-1 flex-col justify-center gap-0.75 p-2.5 ps-3">
          {range ? <p className="t-micro-strong text-ink-2 tabular-nums">{range}</p> : null}
          <CardTitle href={routes.competition(competition.documentId)} className="line-clamp-2 t-body-strong text-ink">
            {competition.name}
          </CardTitle>
          {competition.lakeName ? (
            <p className="flex min-w-0 items-center gap-1 t-label text-accent-ink">
              <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{competition.lakeName}</span>
            </p>
          ) : null}
          <span className="mt-0.5 flex">
            <Tag tone="green">{competition.competitionType === 'team' ? 'Echipe' : 'Individual'}</Tag>
          </span>
        </div>
      </div>
    </CardShell>
  );
}
