import { DetailBackButton, DetailSkeleton } from '@/components/templates/T3';
import { routes } from '@/lib/routes';

/*
 * While the lake is read (fish LakeDetailsSkeleton + its back button, parity lakes.detail.c1): the
 * page's own shape in grey — the photo hero (one photo, the common case), the title block with its
 * rating and location, the section index left and the booking + characteristics cards right from
 * 1280 — with a working back control over the photo.
 */
export default function LakeLoading() {
  return (
    <DetailSkeleton
      photo
      photoCount={1}
      back={<DetailBackButton fallbackHref={routes.lakes()} ground="photo" />}
      heading="Baltă"
      label="Se încarcă balta"
      columns={{ left: 'toc', aside: true, asideCards: 2 }}
      header={{ eyebrow: true, titleAside: true, meta: 1, badges: 'badge', actions: 2 }}
    />
  );
}
