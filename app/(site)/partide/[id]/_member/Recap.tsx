'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { FishIcon } from '@/components/icons/brand';
import { BiggestCatch } from '@/components/partide/session/BiggestCatch';
import { CatchRow } from '@/components/partide/session/CatchRow';
import { EvolutionChart } from '@/components/partide/session/EvolutionChart';
import { catchCaption } from '@/components/partide/session/format';
import { TotalWeighedCard } from '@/components/partide/session/WeightSegmentsBar';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { DetailPhotoHero, PHOTO_PILL } from '@/components/templates/T3';
import { cn } from '@/components/ui/cn';
import { deriveSessionView, fullSource, gridSource, type LocalEvent, type LocalSession } from '@/core/partide';
import { recapDetail } from './model';

/*
 * The member view's recap while no member tab has shipped (rule 4 keeps the tab strip out until
 * its batch ships, lib/partide-pages): the spectator page's content — the photos under the header,
 * then TOTAL CÂNTĂRIT, Evoluția capturilor, CEA MAI MARE CAPTURĂ (bento with the total from 1280)
 * and the catches — over the member's own data (model recapDetail), so a member never sees less of
 * their partidă than a stranger, and a private one shows too. Photos open the captioned Lightbox.
 * Returns the band's hero, the main column and the lightbox, placed by MemberView.
 */

const TILE_FALLBACK = (
  <span aria-hidden data-testid="partida-photo-failed" className="absolute inset-0 flex items-center justify-center bg-accent-tint text-accent">
    <FishIcon className="size-10 opacity-50" />
  </span>
);

export function useMemberRecap(documentId: string, session: LocalSession, events: LocalEvent[], enabled: boolean): { hero: ReactNode; body: ReactNode; lightbox: ReactNode } {
  const detail = useMemo(() => recapDetail(documentId, session, events), [documentId, session, events]);
  const view = useMemo(() => deriveSessionView(detail), [detail]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  if (!enabled) return { hero: null, body: null, lightbox: null };

  const items: LightboxItem[] = view.lightboxCatches.map(c => ({ key: c.clientId, src: fullSource(c) ?? '', preview: gridSource(c) ?? undefined, alt: catchCaption(c) }));
  const openCatch = (clientId: string) => {
    const i = view.lightboxCatches.findIndex(p => p.clientId === clientId);
    return i >= 0 ? () => setLightbox(i) : undefined;
  };
  const photos = detail.photos.map(c => ({ src: fullSource(c) ?? '', alt: catchCaption(c) })).filter(p => p.src);
  const team = (session.members?.length ?? 0) > 1;

  const hero = photos.length ? (
    <DetailPhotoHero
      photos={photos}
      label={`Fotografii din partida de la ${detail.venueName}`}
      onOpenPhoto={i => setLightbox(i)}
      photoFallback={TILE_FALLBACK}
      bottomEnd={
        <button
          type="button"
          aria-haspopup="dialog"
          aria-label={`${view.photoCount} ${view.photoCount === 1 ? 'fotografie' : 'fotografii'} — deschide`}
          data-testid="partida-photo-count"
          onClick={() => setLightbox(0)}
          className={cn(PHOTO_PILL, 'cursor-pointer hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-photo-scrim [&>svg]:size-5')}
        >
          <PhotoIcon aria-hidden />
          {view.photoCount}
        </button>
      }
    />
  ) : null;

  const body = (
    <div data-testid="partida-recap" className="flex flex-col gap-2 md:gap-4 xl:grid xl:grid-cols-5 xl:gap-5 xl:[&>*]:col-span-5">
      <div className={cn('flex flex-col', view.featuredCatch && 'xl:col-span-3! xl:row-start-1')}>
        <TotalWeighedCard totalKg={view.totalKg} segments={view.segments} avgKg={view.avgKg} className="mx-4 mt-2 md:mx-0 md:mt-0" />
      </div>
      <EvolutionChart catches={view.evolutionInput} totalKg={view.totalKg} />
      {view.featuredCatch ? (
        <div className="flex xl:col-span-2! xl:col-start-4 xl:row-start-1 [&>section]:flex-1">
          <BiggestCatch item={view.featuredCatch} onOpen={openCatch(view.featuredCatch.clientId)} />
        </div>
      ) : null}
      <section aria-labelledby="partida-capturi" data-testid="partida-catches" className="bg-surface py-5 md:rounded-card md:shadow-e0 xl:py-6">
        <h2 id="partida-capturi" className="mb-1.5 px-4 t-title2 md:px-5 xl:px-6">
          {team ? 'Capturile echipei' : 'Capturi'}
        </h2>
        {detail.catches.length === 0 ? (
          <p className="px-4 py-6 text-center t-body text-muted">Nicio captură încă.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {detail.catches.map(c => (
              <CatchRow key={c.clientId} item={c} isMax={detail.maxKg != null && c.weightKg === detail.maxKg} onOpen={openCatch(c.clientId)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const box = (
    <Lightbox
      items={items}
      index={lightbox}
      onIndex={setLightbox}
      total={items.length}
      label="Fotografii"
      footer={item => <p className="t-body-strong text-on-photo-scrim">{item.alt}</p>}
    />
  );

  return { hero, body, lightbox: box };
}
