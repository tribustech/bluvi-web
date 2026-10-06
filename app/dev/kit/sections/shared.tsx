'use client';

import { useState, type ReactNode } from 'react';
import { FollowersList, followersSubtitle, type Follower } from '@/components/cards/FollowersList';
import { MEDAL, PodiumCup } from '@/components/ranking';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { ModalSurface } from '@/components/surfaces/ModalSurface';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';

/*
 * /dev/kit section: the pieces promoted from the M1 screens into the kit — podium medals and the
 * cup (components/ranking), the followers list (components/cards), the photo lightbox and the
 * modal with a back step (components/surfaces). Sample data only; nothing reads the CMS.
 */

const FOLLOWERS: Follower[] = [
  { documentId: 'f1', username: 'Radu Ionescu' },
  { documentId: 'f2', username: 'Mihai Popa' },
  { documentId: 'f3', username: 'Andrei Dumitru', avatar: { url: '/images/lake.jpeg' } },
];

const PHOTOS: LightboxItem[] = [
  {
    key: 'p1',
    src: '/images/lake.jpeg',
    alt: 'Crap de 12,4 kg',
    catch: { weightKg: 12.4, species: 'Crap', occurredAt: '2026-09-20T05:37:00Z', anglerName: 'Radu Ionescu' },
  },
  {
    key: 'p2',
    src: '/images/competition-placeholder.jpg',
    alt: 'Amur de 8,1 kg',
    catch: { weightKg: 8.1, species: 'Amur', occurredAt: '2026-09-21T18:02:00Z', anglerName: 'Mihai Popa' },
  },
  { key: 'p3', src: '/images/placeholder-lake.jpg', alt: 'Malul de nord' },
];

const noAngler = () => null;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5">
      <h3 className="t-body-strong text-ink-2">{title}</h3>
      {children}
    </div>
  );
}

/** One followers-list state in a framed column, as a sheet / dialog body would hold it. */
function FollowersFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-card border border-hairline p-4">
      <p className="t-caption text-muted">{label}</p>
      {children}
    </div>
  );
}

export function SharedSection() {
  const [photo, setPhoto] = useState<number | null>(null);
  const [modal, setModal] = useState<'closed' | 'main' | 'sub'>('closed');
  return (
    <>
      <h2 className="t-title1">Piese comune</h2>
      <div className="flex flex-col gap-10 rounded-bento bg-surface p-5 xl:p-10">
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
          <Group title="Medalii podium · aur, argint, bronz (cifra navy, ≥ 4,5:1 în ambele teme)">
            <div className="flex flex-wrap items-end gap-6">
              <ol aria-label="Podium" className="flex items-end gap-2">
                {([2, 1, 3] as const).map((place) => (
                  <li key={place} className="flex w-16 flex-col items-center gap-1.5">
                    <span className="t-label text-ink-2">{place === 1 ? '18,4 kg' : place === 2 ? '12,1 kg' : '9,7 kg'}</span>
                    <span
                      className={cn(
                        'flex w-full items-center justify-center rounded-t-control t-body-strong',
                        place === 1 ? 'h-16' : place === 2 ? 'h-11' : 'h-8',
                        MEDAL[place],
                      )}
                    >
                      <span className="sr-only">Locul </span>
                      {place}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex items-center gap-2">
                {([1, 2, 3] as const).map((place) => (
                  <span key={place} className={cn('flex size-6 items-center justify-center rounded-full t-micro-strong tabular-nums', MEDAL[place])}>
                    {place}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <PodiumCup place={1} />
                <PodiumCup place={2} />
                <PodiumCup place={3} />
              </div>
            </div>
          </Group>

          <Group title="Fotografie pe tot ecranul · Lightbox (← / →, Esc, swipe)">
            <ul aria-label="Fotografii" className="grid grid-cols-3 gap-2">
              {PHOTOS.map((p, i) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => setPhoto(i)}
                    aria-label={`Deschide fotografia: ${p.alt}`}
                    className="block aspect-4/3 w-full cursor-pointer overflow-hidden rounded-card bg-soft-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local sample photo. */}
                    <img src={p.src} alt="" className="size-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
            <Lightbox items={PHOTOS} index={photo} onIndex={setPhoto} total={PHOTOS.length} label="Galerie" />
          </Group>
        </div>

        <Group title="Urmăritori · FollowersList (corpul foii / dialogului)">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FollowersFrame label={`Listă · ${followersSubtitle(FOLLOWERS)}`}>
              <FollowersList followers={FOLLOWERS} pending={false} error={false} onRetry={() => {}} hrefFor={noAngler} />
            </FollowersFrame>
            <FollowersFrame label="Se încarcă">
              <FollowersList followers={undefined} pending error={false} onRetry={() => {}} hrefFor={noAngler} />
            </FollowersFrame>
            <FollowersFrame label="Eroare">
              <FollowersList followers={undefined} pending={false} error onRetry={() => {}} hrefFor={noAngler} />
            </FollowersFrame>
            <FollowersFrame label="Gol">
              <FollowersList followers={[]} pending={false} error={false} onRetry={() => {}} hrefFor={noAngler} />
            </FollowersFrame>
          </div>
        </Group>

        <Group title="Modal cu pas înapoi · ModalSurface (foaie 85% pe telefon, dialog de la 768)">
          <div>
            <Button variant="secondary" onClick={() => setModal('main')}>
              Deschide filtrele
            </Button>
          </div>
          <ModalSurface
            open={modal !== 'closed'}
            onClose={() => setModal('closed')}
            title={modal === 'sub' ? 'Județ' : 'Filtre'}
            back={modal === 'sub' ? { label: 'Înapoi la filtre', onBack: () => setModal('main') } : undefined}
            footer={
              <Button block onClick={() => setModal('closed')}>
                Arată 24 de concursuri
              </Button>
            }
          >
            <div className="flex flex-col gap-3 py-4">
              {modal === 'sub' ? (
                <p className="t-body text-ink-2">Alege un județ din listă.</p>
              ) : (
                <Button variant="outline" onClick={() => setModal('sub')}>
                  Alege județul
                </Button>
              )}
            </div>
          </ModalSurface>
        </Group>
      </div>
    </>
  );
}
