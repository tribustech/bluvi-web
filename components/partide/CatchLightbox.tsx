'use client';

import { ShareIcon } from '@heroicons/react/24/outline';
import { useMemo, useState } from 'react';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { fmtKg } from '@/core/partide';
import type { AnglerCatch } from '@/core/social';
import { ShareCatchSheet, type ShareCatchTarget } from './share/ShareCatchSheet';

/*
 * fish components/ImageLightbox.tsx + components/profile/CatchDetailFooter.tsx + the share handoff
 * (features/partide/helpers/shareCatchHandoff.ts) for an angler's catches (AnglerCatchDTO: Ale mele
 * «Capturile mele», Capturile mele, an angler profile): the kit Lightbox — the photo whole on black,
 * ← / → / the arrow keys / a swipe page through every loaded catch, reaching the last one asks for
 * the next page (fish onEndReached) — with fish's footer (the kg and the species, the venue, the
 * competition of a competition catch, the date). «Distribuie captura» (fish `shareable` + onShare)
 * closes the lightbox and opens the composed Bluvi share card (ShareCatchSheet), never the bare
 * photo.
 */

const ROUND =
  'flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full bg-photo-scrim hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim';

const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** fish CatchDetailFooter fmtDate: «20 sep 2026», on the Romanian calendar day. */
export function catchDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Bucharest', day: 'numeric', month: 'numeric', year: 'numeric' }).formatToParts(d);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  return `${get('day')} ${MONTHS[get('month') - 1]} ${get('year')}`;
}

/** fish anglerCatchToShareEvent: the slice the share card reads. */
export function anglerCatchShareTarget(c: AnglerCatch): ShareCatchTarget {
  return { key: c.key, photoUrl: c.photoUrl, weightKg: c.weightKg, species: c.species, occurredAt: c.date };
}

/** The catch's words: «12,5 kg, Crap, Snagov, 20 sep 2026» — the photo's alt. */
function catchAlt(c: AnglerCatch): string {
  return [c.weightKg != null ? `${fmtKg(c.weightKg)} kg` : null, c.species, c.venueName, catchDay(c.date)].filter(Boolean).join(', ') || 'Captură';
}

export function CatchLightbox({
  catches,
  total,
  index,
  onIndex,
  onEndReached,
  fetchingMore = false,
  moreFailed = false,
  onRetryMore,
}: {
  catches: AnglerCatch[];
  /** Every catch there is (loaded or not). */
  total: number;
  index: number | null;
  onIndex: (i: number | null) => void;
  onEndReached?: () => void;
  fetchingMore?: boolean;
  moreFailed?: boolean;
  onRetryMore?: () => void;
}) {
  const [sharing, setSharing] = useState<AnglerCatch | null>(null);
  const items = useMemo<LightboxItem[]>(
    () => catches.map(c => ({ key: c.key, src: c.photoUrl, preview: c.photoGridUrl, alt: catchAlt(c) })),
    [catches],
  );
  const target = useMemo(() => (sharing ? anglerCatchShareTarget(sharing) : null), [sharing]);

  // fish shareHandoff: the lightbox closes first, then the share sheet opens over the page.
  const share = (i: number) => {
    const c = catches[i];
    if (!c) return;
    onIndex(null);
    setSharing(c);
  };

  return (
    <>
      <Lightbox
        items={items}
        index={index}
        onIndex={onIndex}
        total={Math.max(total, catches.length)}
        label="Capturi"
        title={(n, of) => `Captura ${n} din ${of}`}
        moreFailedText="Nu am putut încărca mai multe capturi."
        onEndReached={onEndReached}
        fetchingMore={fetchingMore}
        moreFailed={moreFailed}
        onRetryMore={onRetryMore}
        headerStart={(_, i) => (
          <button type="button" onClick={() => share(i)} aria-label="Distribuie captura" className={ROUND}>
            <ShareIcon aria-hidden className="size-6" />
          </button>
        )}
        footer={(_, i) => {
          const c = catches[i];
          return c ? <CatchDetailFooter item={c} /> : null;
        }}
      />
      <ShareCatchSheet
        target={target}
        lakeName={sharing?.venueName ?? ''}
        competitionName={sharing?.source === 'competition' ? sharing.competitionName : null}
        onClose={() => setSharing(null)}
      />
    </>
  );
}

/**
 * fish CatchDetailFooter — under the photo: the kg (its unit its own smaller element, owner rule
 * 10) and the species, the venue, the competition of a competition catch, the day.
 */
export function CatchDetailFooter({ item }: { item: AnglerCatch }) {
  return (
    <div className="flex flex-col gap-0.5" data-testid="catch-detail-footer">
      {item.weightKg != null || item.species ? (
        <p className="flex flex-wrap items-baseline gap-x-1.25">
          {item.weightKg != null ? (
            <>
              <span className="t-display">{fmtKg(item.weightKg)}</span>
              <span className="t-heading text-lavender-3">kg</span>
            </>
          ) : null}
          {item.species ? (
            <span className={item.weightKg != null ? 'ms-1.5 t-title2' : 't-title2'}>
              {item.weightKg != null ? <span aria-hidden className="me-1.5 text-lavender-3">·</span> : null}
              {item.species}
            </span>
          ) : null}
        </p>
      ) : null}
      {item.venueName ? <p className="t-body-strong text-lavender-2">{item.venueName}</p> : null}
      {item.source === 'competition' && item.competitionName ? <p className="t-body-strong text-lavender-2">{item.competitionName}</p> : null}
      <p className="mt-0.5 t-caption text-lavender-3">{catchDay(item.date)}</p>
    </div>
  );
}
