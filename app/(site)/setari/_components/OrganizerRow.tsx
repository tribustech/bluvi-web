'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { StarIcon } from '@heroicons/react/24/solid';
import { ROW_FOCUS, ROW_ICON, ROW_LINE, ROW_PAD_X } from '@/components/account/settings';
import { Dialog } from '@/components/surfaces/Dialog';
import { Button, ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { Profile } from '@/core/social';
import { routes } from '@/lib/routes';
import { organizerState } from './format';
import { OrganizerRequestPanel } from './OrganizerRequestPanel';

export const BECOME_ORGANIZER = 'Devino organizator';
export const REQUEST_PENDING = 'Cerere organizator';
export const PENDING_BADGE = 'În așteptare';
export const ORGANIZER = 'Organizator';
export const NO_PHONE_TITLE = 'Nu poți trimite cererea pentru a deveni organizator fără număr de telefon';
/** ROW_ICON's geometry with the star's own colour (cn does not merge: never two text colours). */
const STAR = 'size-5 shrink-0 [&>svg]:size-5';

export const NO_PHONE_TEXT = 'Te rugăm să adaugi un număr de telefon în profilul tău pentru a putea trimite cererea';

/**
 * c5–c12 (fish settings.tsx:99-136, 204-232, 357-363): the organizer row, by the profile's state.
 * - none → «Devino organizator» (black star, chevron), a button: without a phone on the profile the
 *   alert «Nu poți trimite cererea…» (Închide / «Editează profil» → /setari/profil), with one the
 *   request panel;
 * - pending → «Cerere organizator» (grey star) + the «În așteptare» pill, not activatable;
 * - organizer → «Organizator» with the yellow star, not activatable.
 * The not-activatable rows are plain text (no role, no tab stop): fish InfoCardItem without onPress.
 * The pending row takes programmatic focus once, right after a request sent from this screen.
 */
export function OrganizerRow({ profile }: { profile: Profile }) {
  const state = organizerState(profile);
  const [dialog, setDialog] = useState<'none' | 'no-phone' | 'request'>('none');
  const close = () => setDialog('none');
  // A sent request flips «Devino organizator» (the panel's focus-return target) to the pending row,
  // which is not a control: focus would fall to <body> after the success toast. Once the panel has
  // closed and the row has flipped, focus moves to the pending row (tabIndex -1, read with its pill).
  // Runs after the panel's own effect (child first), i.e. after the native close() restored focus.
  const focusPending = useRef(false);
  const pendingRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusPending.current || dialog !== 'none' || state !== 'pending') return;
    focusPending.current = false;
    pendingRef.current?.focus();
  }, [dialog, state]);

  let row;
  if (state === 'organizer') {
    row = (
      <div className={cn(ROW_LINE, ROW_PAD_X)} data-testid="organizer-row" data-state="organizer">
        <span aria-hidden className={cn(STAR, 'text-rating')}>
          <StarIcon />
        </span>
        <span className="t-body-strong min-w-0 flex-1 text-ink">{ORGANIZER}</span>
      </div>
    );
  } else if (state === 'pending') {
    row = (
      <div ref={pendingRef} tabIndex={-1} className={cn(ROW_LINE, ROW_PAD_X, ROW_FOCUS)} data-testid="organizer-row" data-state="pending">
        <span aria-hidden className={cn(STAR, 'text-muted')}>
          <StarIcon />
        </span>
        <span className="t-body-strong min-w-0 flex-1 text-ink">{REQUEST_PENDING}</span>
        <span className="shrink-0 rounded-full bg-status-neutral-bg px-2.5 py-0.5 t-label text-status-neutral-fg">{PENDING_BADGE}</span>
      </div>
    );
  } else {
    row = (
      <button
        type="button"
        data-testid="organizer-row"
        data-state="none"
        aria-haspopup="dialog"
        onClick={() => setDialog(profile.phone ? 'request' : 'no-phone')}
        className={cn(
          'block w-full cursor-pointer text-left transition-colors duration-(--duration-fast) ease-fast hover:bg-soft-fill active:bg-soft-fill',
          ROW_PAD_X,
          ROW_FOCUS,
        )}
      >
        <span className={ROW_LINE}>
          <span aria-hidden className={ROW_ICON}>
            <StarIcon />
          </span>
          <span className="t-body-strong min-w-0 flex-1 text-ink">{BECOME_ORGANIZER}</span>
          <ChevronRightIcon aria-hidden className="size-6 shrink-0 text-ink-2" />
        </span>
      </button>
    );
  }
  // The dialogs stay mounted whatever the state: a sent request flips the row to «pending» (the
  // profile refetch) while the panel is still closing — it must not unmount under its own callbacks.
  return (
    <>
      {row}
      <Dialog
        open={dialog === 'no-phone'}
        onClose={close}
        alert
        title={NO_PHONE_TITLE}
        description={NO_PHONE_TEXT}
        actions={
          <>
            <Button variant="outline" onClick={close}>
              Închide
            </Button>
            <ButtonLink href={routes.editProfile()} onClick={close}>
              Editează profil
            </ButtonLink>
          </>
        }
      />
      <OrganizerRequestPanel open={dialog === 'request'} onClose={close} onSent={() => (focusPending.current = true)} />
    </>
  );
}
