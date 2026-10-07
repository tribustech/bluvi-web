'use client';

import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { headerChipClass } from '@/components/templates/T3/DetailHeader';
import { editProfileExit, useExitEditProfile } from './exit';

/**
 * The header's back control (account.edit-profile.c1): FlowHeader's back chip, as a button — it
 * returns to whatever opened the screen (history), which a static href cannot know; without
 * history to `editProfileExit(viewerId)`. `guard` wraps the exit while the form has unsaved edits
 * (the loaded form's «Renunți la modificări?», useProfileForm.guardLeave).
 */
export function BackControl({ viewerId, guard }: { viewerId?: string; guard?: (leave: () => void) => void }) {
  const exit = useExitEditProfile(editProfileExit(viewerId));
  return (
    <button
      type="button"
      onClick={() => (guard ? guard(() => exit()) : exit())}
      aria-label="Înapoi"
      className={headerChipClass()}
    >
      <ChevronLeftIcon aria-hidden />
    </button>
  );
}
