'use client';

import { useParams } from 'next/navigation';
// The lake gallery's masonry skeleton, read-only.
import { MasonrySkeleton } from '@/app/(site)/balti/[id]/_sub/Masonry';
import { ListHeader, ListPage } from '@/components/templates/T1';
import { GalleryClose } from './GalleryClose';
import { GALLERY_LABEL } from './seo';

/*
 * loading.tsx's body: the screen's own header — «Galerie», the subtitle as a shimmer and the round ✕
 * on the right (GalleryClose, the same control in the same place) — then the masonry skeleton.
 */
export function GalleryLoading() {
  const params = useParams<{ id?: string }>();
  return (
    <div aria-busy>
      <ListPage
        header={
          <ListHeader
            title={GALLERY_LABEL}
            description={<span aria-hidden className="inline-block h-3 w-44 animate-shimmer rounded-full align-middle" />}
            actions={<GalleryClose documentId={params?.id ?? null} />}
          />
        }
      >
        <MasonrySkeleton />
      </ListPage>
    </div>
  );
}
