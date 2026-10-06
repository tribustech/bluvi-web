import { DetailBackButton, DetailSkeleton } from '@/components/templates/T3';
import { routes } from '@/lib/routes';

/*
 * While the lake is read (fish LakeDetailsSkeleton + its back button, parity lakes.detail.c1): the
 * page's own shape in grey — the photo hero (one height from 768 whatever the photo count), the
 * title block with its rating and location, its actions (share; the CTA leaves from 1024 for the
 * card), the chips and from 1024 the summary card right (DetailBody `summary`) — with a working
 * back control over the photo. No phone action bar: the loaded one only slides in once the hero has
 * scrolled away (PhoneBar).
 */
export default function LakeLoading() {
  return (
    <DetailSkeleton
      photo
      photoCount={1}
      back={<DetailBackButton fallbackHref={routes.lakes()} ground="photo" />}
      heading="Baltă"
      label="Se încarcă balta"
      columns={{ layout: 'summary', aside: true }}
      header={{ eyebrow: true, titleAside: true, meta: 1, badges: 'badge', actions: 'share-cta' }}
    />
  );
}
