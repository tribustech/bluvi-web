import type { ReactNode } from 'react';
import { ProfileFormSkeleton } from '@/components/account/profile-form';
import { FlowActions, FlowHeader, FlowLayout, FlowLoadingStatus } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { BackControl } from './BackControl';
import { ProfilePreviewSkeleton } from './ProfilePreview';

export const TITLE = 'Editează profilul';
export const TITLE_ID = 'editeaza-profilul';

/**
 * The screen's T6 frame (single-task flow): the header band (back · «Editează profilul») and the
 * task, all on one column edge, so the title always sits over the form:
 * - <768 the form is a flush white section from the header band down to the sticky «Finalizează»
 *   bar (FlowLayout `fill`: white to the button, as fish's ScrollScreen);
 * - 768–1279 a card on the page ground, the bar edge to edge at the viewport bottom;
 * - ≥1280 two columns (owner rule: full width, no lone 720px card): the form (itself avatar | fields
 *   from a 672 wide card, profile-form/layout.ts — never a phone form stretched), and the aside —
 *   ONE card: «Așa te văd ceilalți» (ProfilePreview, live from the form) on top, a hairline, then
 *   «Finalizează» full width at its bottom (EditProfileActions joins T6's docked bar to the card).
 * The error state is a T4Gate (`bare`): a state card, centred in the column (`narrow`).
 * No sticky header (owner rule 3): the band scrolls away, only the shell's bar stays.
 */
export function EditProfileFrame({
  children,
  actions,
  aside,
  back,
  busy,
  variant = 'card',
}: {
  children: ReactNode;
  /** <EditProfileActions>: the bar below 1280, docked under the aside from 1280. */
  actions?: ReactNode;
  /** ≥1280 only (the preview); hidden below. */
  aside?: ReactNode;
  /** The header's back control (default: an unguarded one that exits to Acasă without history). */
  back?: ReactNode;
  busy?: boolean;
  variant?: 'card' | 'bare';
}) {
  const bare = variant === 'bare';
  return (
    <FlowLayout
      header={<FlowHeader title={TITLE} id={TITLE_ID} backPlaceholder={back ?? <BackControl />} />}
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

/**
 * The bar with the one CTA (the loaded form's, or a disabled stand-in while it loads). Below 1280
 * T6's bar as is. From 1280 FlowLayout docks it under the aside 16px below the preview card: here
 * it is pulled up onto that card (−16px, and 1px more so the two hairline rings overlap into one
 * line), square on top and only the hairline ring (no lift) — preview and CTA read as one card, the
 * button still mounted once (one tab stop, the form's one default button for Enter).
 */
export function EditProfileActions({ primary }: { primary: ReactNode }) {
  return (
    <div className="xl:-mt-[calc(--spacing(4)+1px)] xl:[&>div]:rounded-t-none xl:[&>div]:shadow-e0" data-testid="edit-profile-actions">
      <FlowActions primary={primary} />
    </div>
  );
}

/**
 * Loading (account.edit-profile.c2): the whole form in grey on the form's own geometry
 * (ProfileFormSkeleton) with the header, the preview card's outline (≥1280) and a disabled
 * «Finalizează» already in place, so nothing moves when the profile lands.
 */
export function EditProfileSkeleton({ back }: { back?: ReactNode } = {}) {
  return (
    <EditProfileFrame
      busy
      back={back}
      aside={<ProfilePreviewSkeleton />}
      actions={<EditProfileActions primary={<Button disabled>Finalizează</Button>} />}
    >
      <FlowLoadingStatus label="Se încarcă profilul…" />
      <ProfileFormSkeleton />
    </EditProfileFrame>
  );
}
