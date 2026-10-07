'use client';

import Link from 'next/link';
import { BioText } from '@/components/account/angler/BioText';
import { BigAvatar } from '@/components/account/angler/ProfileHeader';
import type { ProfileFormState } from '@/components/account/profile-form';
import { FlowAsideCard } from '@/components/templates/T6';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

export const PREVIEW_TITLE = 'Așa te văd ceilalți';
const PREVIEW_ID = 'asa-te-vad-ceilalti';
export const UNSAVED_NOTE = 'Modificări nesalvate';
export const NAME_PLACEHOLDER = 'Numele tău';
/** The username a social sign-in leaves before the profile is completed (fish CompleteProfileSheet). */
const NULL_NAME = 'null null';

/**
 * ≥1280 aside of «Editează profilul» (web addition, owner rule: full width, 3-column desktop): the
 * public result, not an echo of the editor — /pescari/[id]'s header as the form edits it (the
 * 100px avatar, BigAvatar with initials on their tone when there is no picture; the name at the
 * profile's title step; the bio with its #hashtags, BioText), on the page ground like the real
 * header, live from the form values. «Vezi profilul public» is a quiet link in the card's title row;
 * while the user has unsaved edits a «Modificări nesalvate» note says the preview is ahead of the
 * public page. The card's bottom is the docked «Finalizează» (EditProfileActions joins the two).
 * Only data already loaded; while the username field is empty the saved one stands in — unless
 * there is none worth showing (empty, or the social sign-in placeholder «null null»): then a muted
 * «Numele tău». `publicLink={false}` drops the link (complete profile: no way out of that screen).
 */
export function ProfilePreview({
  form,
  viewerId,
  savedName,
  publicLink = true,
}: {
  form: ProfileFormState;
  viewerId: string;
  savedName: string;
  publicLink?: boolean;
}) {
  const fallback = savedName.trim() && savedName !== NULL_NAME ? savedName.trim() : '';
  const name = form.values.username.trim() || fallback;
  const src = form.avatar.kind === 'file' ? form.avatar.previewUrl : form.avatar.url;
  const bio = form.values.bio.trim();
  return (
    <FlowAsideCard
      title={PREVIEW_TITLE}
      id={PREVIEW_ID}
      className={CARD}
      meta={
        publicLink ? (
          <Link href={routes.angler(viewerId)} className={LINK}>
            Vezi profilul public
          </Link>
        ) : undefined
      }
    >
      <div className={PANEL} data-testid="profile-preview">
        <BigAvatar name={name || NAME_PLACEHOLDER} src={src} toneKey={viewerId} />
        <p className={cn('mt-3 t-title1 break-words', name ? 'text-ink' : 'text-muted')} data-testid="profile-preview-name">
          {name || NAME_PLACEHOLDER}
        </p>
        {bio ? (
          <BioText bio={bio} className="mt-2 max-w-full" />
        ) : (
          <p className="mt-2 t-caption text-muted">Nu ai adăugat o biografie.</p>
        )}
      </div>
      {form.unsaved ? (
        <p className="t-caption flex items-center gap-1.5 text-muted" data-testid="profile-preview-unsaved">
          <span aria-hidden className="size-1.5 rounded-full bg-status-warning-fg" />
          {UNSAVED_NOTE}
        </p>
      ) : null}
    </FlowAsideCard>
  );
}

/** Square at the bottom: the docked CTA closes the card (EditProfileActions). */
const CARD = 'xl:rounded-b-none';
/** The public header's look: centred on the page ground, as /pescari/[id] shows it. */
const PANEL = 'flex flex-col items-center rounded-control bg-page px-4 py-5 text-center';
const LINK =
  't-caption inline-flex min-h-6 items-center rounded-control font-semibold text-accent-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent';

/** The preview's skeleton (the aside card while the profile loads): same title row and panel. */
export function ProfilePreviewSkeleton() {
  const bar = 'inline-block max-w-full rounded-full bg-soft-fill animate-shimmer align-middle';
  return (
    <div aria-hidden className={cn('flex flex-col gap-3 rounded-card bg-surface p-4 shadow-e0 md:p-5 xl:p-6', CARD)}>
      <div className="flex items-center gap-2">
        <p className="t-heading">
          <span className={cn(bar, 'h-3.5 w-36')} />
        </p>
        <p className="ml-auto flex min-h-6 items-center">
          <span className={cn(bar, 'h-3 w-28')} />
        </p>
      </div>
      <div className={PANEL}>
        <span className="size-25 rounded-full bg-soft-fill animate-shimmer" />
        <p className="mt-3 t-title1">
          <span className={cn(bar, 'h-5 w-36')} />
        </p>
        <p className="mt-2 t-label">
          <span className={cn(bar, 'h-3 w-48')} />
        </p>
      </div>
    </div>
  );
}
