import type { ReactNode } from 'react';
import { ProfileFormSkeleton } from '@/components/account/profile-form';
import { FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { EditProfileActions } from '../../../setari/profil/_components/EditProfileFrame';
import { ProfilePreviewSkeleton } from '../../../setari/profil/_components/ProfilePreview';

export const TITLE = 'Completează profilul';
export const TITLE_ID = 'completeaza-profilul';

/**
 * The screen's T6 frame — edit profile's (setari/profil EditProfileFrame) geometry with fish's
 * complete-profile differences: the title «Completează profilul» and NO back control
 * (account.complete-profile.c1, fish `goBack={false}`): the header band holds the title alone.
 * - <768 the form is a flush white section down to the sticky «Finalizează» bar;
 * - 768–1279 a card on the page ground, the bar at the viewport bottom;
 * - ≥1280 form | aside: «Așa te văd ceilalți» (edit profile's ProfilePreview, live from the form)
 *   with «Finalizează» docked under it as one card (EditProfileActions).
 * The error state is a T4Gate (`bare`), centred in the column (`narrow`).
 */
export function CompleteProfileFrame({
  children,
  actions,
  aside,
  busy,
  variant = 'card',
}: {
  children: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  busy?: boolean;
  variant?: 'card' | 'bare';
}) {
  const bare = variant === 'bare';
  return (
    <FlowLayout
      header={<FlowHeader title={TITLE} id={TITLE_ID} />}
      labelledBy={TITLE_ID}
      narrow={bare}
      fill={!bare}
      busy={busy}
      variant={variant}
      aside={aside}
      asideMobile="hidden"
      actions={actions}
    >
      {children}
    </FlowLayout>
  );
}

/** Loading: the form in grey on its own geometry, the preview outline (≥1280) and a disabled «Finalizează». */
export function CompleteProfileSkeleton() {
  return (
    <CompleteProfileFrame
      busy
      aside={<ProfilePreviewSkeleton />}
      actions={<EditProfileActions primary={<Button disabled>Finalizează</Button>} />}
    >
      <FlowLoadingStatus label="Se încarcă profilul…" />
      <ProfileFormSkeleton />
    </CompleteProfileFrame>
  );
}
