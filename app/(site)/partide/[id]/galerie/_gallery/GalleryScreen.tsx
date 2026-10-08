'use client';

import Link from 'next/link';
import { PhotoIcon } from '@heroicons/react/24/outline';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { SetBreadcrumb } from '@/app/(site)/_shell/SiteHeader';
// The lake gallery's masonry and catch tile, read-only (their TODO(kit): a Masonry in components/ui).
import { CatchTile } from '@/app/(site)/balti/[id]/_sub/CatchTile';
import { DEFAULT_RATIO, MasonryGrid, MasonrySkeleton, tileRatio } from '@/app/(site)/balti/[id]/_sub/Masonry';
import { useBack } from '@/components/nav/useBack';
import { clockRo } from '@/components/partide/session/format';
import { Lightbox, type LightboxItem } from '@/components/surfaces/Lightbox';
import { ListEmpty, ListError, ListFooter, ListHeader, ListPage } from '@/components/templates/T1';
import { FaceStack } from '@/components/ui/Avatar';
import { buttonClass } from '@/components/ui/Button';
import {
  communitySessionQuery,
  fmtKg,
  membersLabel,
  refetchCommunitySessionOnFocus,
  sessionCatchesInfiniteQuery,
  type CommunityMemberDTO,
} from '@/core/partide';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { SpectatorNotFound } from '../../_spectator/states';
import { galleryTrail, GALLERY_LABEL } from './seo';
import { GALLERY_QUERY, galleryPhotos, gallerySubtitle, photoCaption, tileLabel, type GalleryPhoto } from './view';

/*
 * «Galeria partidei» — fish features/partide/screens/SessionGalleryScreen.tsx (parity
 * partide.spectator-galerie c1–c4), T1's ListPage with no filters and no aside.
 *  - c1 «Galerie», the members' faces (kit FaceStack, fish MemberAvatars: three at most) and
 *    «{membri} · {N} fotografii» — N is the partidă's photoCount (its TRUE total, whatever has
 *    loaded), each part only once known (rule 4) — and the close control (useBack: the previous page
 *    of this tab, else the partidă — fish router.back());
 *  - c2 the photos from core sessionCatchesInfiniteQuery(id, { photosOnly, pageSize: 30 }) — NOT the
 *    detail's `photos`, capped at 12 — in the lake gallery's masonry (two columns on a phone, ~220px
 *    tracks as the page widens), the next page half a screen early with fish's spinner footer; a
 *    tile is the catch signature (CatchTile caption: navy kg chip + species, fish «specie · kg») and
 *    opens the kit Lightbox over every photo loaded so far, with fish's CatchLightboxFooter: the big
 *    kg, «specie · ora», the roster's faces and names (every photo here is the team's);
 *  - c3 the masonry skeleton while the first page loads; «Nicio fotografie încă.» when there is none;
 *    a failed first read is an error card with a retry (rule 4: never a fake empty gallery);
 *  - c4 coming back to the tab refetches the partidă (fish refetchCommunitySessionOnFocus on screen
 *    focus: an invalidation of `['community', 'session', id]`, not TanStack's stale-only focus
 *    refetch — so both queries' own focus refetch is off and this is the one). As in fish the key is
 *    a prefix of the photos' key, so the loaded photo pages are read again with it (a new photo
 *    joins). A live partidă is also polled every 60 s (core).
 * A 404 from either read — the partidă went private or was deleted — is the not-found state; nothing
 * of it stays on screen (invariant 15).
 */

const CLOSE_LABEL = 'Închide galeria';
const TITLE_ID = 'galerie-titlu';

const notFound = (e: unknown) => isApiError(e) && (e.status === 404 || e.status === 400);

export function GalleryScreen({ documentId }: { documentId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const session = useQuery({ ...communitySessionQuery(t, documentId), refetchOnWindowFocus: false });
  // Focus refetches come from the c4 listener only (TanStack's own would read every page a second time).
  const q = useInfiniteQuery({ ...sessionCatchesInfiniteQuery(t, documentId, GALLERY_QUERY), refetchOnWindowFocus: false });
  const back = useBack(routes.partida(documentId));
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const markBroken = (key: string) => setBroken(prev => (prev.has(key) ? prev : new Set(prev).add(key)));

  // c4 — fish's screen-focus leg: the tab coming back into view invalidates the partidă.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refetchCommunitySessionOnFocus(qc, documentId);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [qc, documentId]);

  const photos = useMemo(() => galleryPhotos(q.data?.pages), [q.data]);
  const detail = session.data;
  const members = useMemo(() => detail?.members ?? [], [detail]);
  const total = q.data?.pages[0]?.meta.pagination.total ?? photos.length;
  const photoCount = detail ? detail.photoCount : q.data ? total : null;
  const subtitle = gallerySubtitle(detail ? members : null, photoCount);
  const anglerLabel = members.length ? membersLabel(members) : null;

  const lightboxItems = useMemo<LightboxItem[]>(
    () => photos.map(p => ({ key: p.key, src: p.full, preview: p.grid, alt: photoCaption(p) ?? 'Captură' })),
    [photos],
  );
  const found = openKey ? photos.findIndex(p => p.key === openKey) : -1;

  if (notFound(session.error) || notFound(q.error)) return <SpectatorNotFound />;

  const loadMore = () => {
    if (!q.hasNextPage || q.isFetchingNextPage) return;
    void q.fetchNextPage();
  };
  const firstFailed = q.isError && !q.data;

  let body;
  if (q.isPending) body = <MasonrySkeleton />;
  else if (firstFailed)
    body = (
      <ListError
        title="Nu am putut încărca fotografiile."
        onRetry={() => void q.refetch()}
        retrying={q.isFetching}
        attempt={q.errorUpdateCount}
      />
    );
  else if (photos.length === 0)
    body = (
      <div data-testid="gallery-empty">
        <ListEmpty
          icon={<PhotoIcon aria-hidden className="size-12" />}
          title="Nicio fotografie încă."
          action={
            <Link href={routes.partida(documentId)} className={buttonClass({ variant: 'secondary' })}>
              Înapoi la partidă
            </Link>
          }
        />
      </div>
    );
  else
    body = (
      <>
        <MasonryGrid
          items={photos}
          ratioOf={p => (broken.has(p.key) ? DEFAULT_RATIO : tileRatio(p.ratio))}
          keyOf={p => p.key}
          label="Fotografiile partidei"
          testId="gallery-grid"
        >
          {p => (
            <CatchTile
              c={{ src: p.grid, ratio: p.ratio ?? DEFAULT_RATIO, weightKg: p.weightKg, species: p.species, anglerName: null }}
              variant="caption"
              kind="capture"
              broken={broken.has(p.key)}
              onBroken={() => markBroken(p.key)}
              onOpen={() => setOpenKey(p.key)}
              label={tileLabel(p)}
            />
          )}
        </MasonryGrid>
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          error={q.isFetchNextPageError}
          onLoadMore={loadMore}
          spinner
          errorLabel="Nu am putut încărca mai multe fotografii."
        />
      </>
    );

  return (
    <>
      <SetBreadcrumb trail={detail ? galleryTrail(detail) : [{ label: 'Partide', href: routes.partide() }, { label: GALLERY_LABEL }]} />
      <ListPage
        header={
          <ListHeader
            title={GALLERY_LABEL}
            titleId={TITLE_ID}
            description={<Subtitle members={detail ? members : []} text={subtitle} pending={!detail && session.isPending} />}
            back={{ label: CLOSE_LABEL, onClick: back }}
          />
        }
      >
        <section aria-labelledby={TITLE_ID} aria-busy={q.isPending || q.isFetchingNextPage || undefined} data-testid="gallery-body">
          {body}
        </section>
      </ListPage>
      <Lightbox
        items={lightboxItems}
        index={found >= 0 ? found : null}
        onIndex={i => setOpenKey(i == null ? null : (photos[i]?.key ?? null))}
        total={Math.max(total, photos.length)}
        label={GALLERY_LABEL}
        footer={(_, i) => (photos[i] ? <GalleryLightboxFooter p={photos[i]} members={members} anglerLabel={anglerLabel} /> : null)}
        onEndReached={loadMore}
        fetchingMore={q.isFetchingNextPage}
        moreFailed={q.isFetchNextPageError}
        onRetryMore={loadMore}
      />
    </>
  );
}

/** c1: the faces (decorative — the names are printed beside them), then «{membri} · {N} fotografii». */
function Subtitle({ members, text, pending }: { members: CommunityMemberDTO[]; text: string | null; pending: boolean }) {
  if (pending) return <span aria-hidden className="inline-block h-3 w-44 animate-shimmer rounded-full align-middle" />;
  if (!text) return null;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {members.length ? <MemberFaces members={members} /> : null}
      <span className="min-w-0" data-testid="gallery-subtitle">
        {/* «32 de fotografii» never breaks inside the count on a phone. */}
        {text.split(' · ').map((part, i, all) => (
          <span key={i} className={i === all.length - 1 && /\d/.test(part) ? 'whitespace-nowrap' : undefined}>
            {i > 0 ? ' · ' : null}
            {part}
          </span>
        ))}
      </span>
    </span>
  );
}

const nameOf = (m: CommunityMemberDTO) => m.name?.trim() || 'Pescar';

/** fish MemberAvatars (three at most, no «+N»): the kit FaceStack. */
function MemberFaces({ members }: { members: CommunityMemberDTO[] }) {
  return (
    <span className="flex shrink-0" data-testid="gallery-faces">
      <FaceStack people={members.slice(0, 3).map(m => ({ name: nameOf(m), src: m.avatarUrl }))} size={24} />
    </span>
  );
}

/**
 * fish CatchLightboxFooter: the big kg (its unit apart, rule 10), «specie · ora» (Bucharest wall
 * clock), then the roster — faces and «Ion și Dan» — since per-catch anglers are not on the wire and
 * a partidă's catches are the team's.
 */
function GalleryLightboxFooter({ p, members, anglerLabel }: { p: GalleryPhoto; members: CommunityMemberDTO[]; anglerLabel: string | null }) {
  const secondary = [p.species, clockRo(p.occurredAt)].filter(Boolean).join(' · ');
  return (
    <div className="flex flex-col gap-0.75" data-testid="gallery-lightbox-footer">
      {p.weightKg != null ? (
        <p className="flex items-baseline gap-1.25">
          <span className="t-display">{fmtKg(p.weightKg)}</span>
          <span className="t-heading text-lavender-3">kg</span>
        </p>
      ) : null}
      {secondary ? <p className="t-body text-lavender-2">{secondary}</p> : null}
      {anglerLabel ? (
        <p className="mt-1 flex min-w-0 items-center gap-2.25 t-body-strong">
          {members.length ? (
            <FaceStack people={members.slice(0, 3).map(m => ({ name: nameOf(m), src: m.avatarUrl }))} size={32} className="shrink-0 *:border-on-photo-scrim/35" />
          ) : null}
          <span className="truncate">{anglerLabel}</span>
        </p>
      ) : null}
    </div>
  );
}
