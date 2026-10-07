'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ProfileForm, ProfileSubmitButton, useProfileForm, type ProfileFormSource } from '@/components/account/profile-form';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { T4Notice } from '@/components/templates/T4/T4Status';
import { profileQuery, type Profile } from '@/core/social';
import { createBrowserTransport } from '@/lib/client/transport';
import { userOf, useViewerState } from '../_shell/viewer-context';

export const SHEET_TITLE = 'Completează profilul';
const FORM_ID = 'acasa-completeaza-profilul-form';
/** fish CompleteProfileSheet: presented 1100ms after the profile is known to be incomplete. */
export const OPEN_DELAY_MS = 1100;

/** fish: no username, the social sign-in placeholder «null null», or isProfileComplete false. */
export function isProfileIncomplete(profile: Pick<Profile, 'username' | 'isProfileComplete'>): boolean {
  return !profile.username || profile.username === 'null null' || !profile.isProfileComplete;
}

function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
}

/** fish useNetInfoContext().isOnline: navigator.onLine, live. */
function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => false,
  );
}

/**
 * Acasă's «Completează profilul» (home.acasa.c57, account.b.complete-profile-gate; fish
 * components/CompleteProfileSheet.tsx). Signed in only: a guest or an unknown session renders
 * nothing (owner rule 4). With the own profile loaded (core profileQuery) and incomplete, while
 * online, it opens 1.1s later — a sheet on a phone, a dialog from 768 (ResponsiveSurface) — with
 * the shared ProfileForm («Finalizează» enabled untouched, as fish `disableSubmitButton={false}`).
 * It cannot be dismissed (fish: one 90% snap, no pan-down, backdrop `pressBehavior="none"`): no close
 * button, Escape and the backdrop do nothing, the sheet has one snap (no handle button, no drag); the
 * native modal <dialog> keeps focus in it, which starts on the title. A successful save closes it and
 * refreshes the server parts (the top bar's Viewer); if the refetched profile is still incomplete
 * (a pristine «null null»), it opens again 1.1s later, as fish.
 */
export function CompleteProfileSheet() {
  return (
    <Suspense fallback={null}>
      <SignedInOnly />
    </Suspense>
  );
}

function SignedInOnly() {
  const user = userOf(useViewerState());
  return user ? <ProfileGate /> : null;
}

function ProfileGate() {
  const t = useMemo(() => createBrowserTransport(), []);
  const profile = useQuery(profileQuery(t));
  const online = useOnline();
  const [open, setOpen] = useState(false);
  /** Bumped by every opening: the form is remounted, so it starts from the profile of that moment. */
  const [opening, setOpening] = useState(0);
  const incomplete = profile.data ? isProfileIncomplete(profile.data) : false;
  // A cached profile being refetched (stale) is not an answer yet: e.g. right after
  // /profil/completeaza saved, the cache may still say incomplete until the refetch lands.
  const settling = profile.isFetching && profile.isStale;

  // A fresher profile that is complete closes it (nothing else would: it has no close control).
  if (open && !incomplete) setOpen(false);

  // Re-run on every profile that lands, not only when `incomplete` flips (fish: the present() effect
  // depends on the profile object): a save that leaves it incomplete (the CMS sets isProfileComplete
  // on every PATCH, the «null null» username check is client-side) closes it, and the refetch the
  // update mutation triggers brings it back 1.1s later.
  const updatedAt = profile.dataUpdatedAt;
  useEffect(() => {
    if (!online || !incomplete || settling) return;
    const timeout = setTimeout(() => {
      setOpening((n) => n + 1);
      setOpen(true);
    }, OPEN_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [online, incomplete, settling, updatedAt]);

  if (!profile.data || (!incomplete && !open)) return null;
  // fish's BottomSheetModal unmounts its content on dismiss, so a re-presented form re-seeds from
  // the refetched profile (an avatar saved by the first opening is not generated + uploaded again).
  return <Surface key={`${profile.data.documentId}:${opening}`} profile={profile.data} open={open} onSaved={() => setOpen(false)} />;
}

const ignore = () => {};

function Surface({ profile, open, onSaved }: { profile: ProfileFormSource; open: boolean; onSaved: () => void }) {
  const router = useRouter();
  // The site toast lives under the modal's top layer (it would be hidden): failures show in the sheet.
  const [error, setError] = useState<string | null>(null);

  const saved = useCallback(() => {
    setError(null);
    onSaved();
    router.refresh();
  }, [onSaved, router]);
  const form = useProfileForm(profile, { allowPristineSubmit: true, onSaved: saved, onError: setError });

  // Escape never closes it. The dialog's cancel is already refused (useModalDialog), but Chrome lets
  // a second Escape without a user activation in between close a <dialog> anyway: stop the key itself.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest('dialog')?.querySelector(`#${FORM_ID}`)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  // One initial focus on both surfaces: the title (tabIndex -1, no ring), so the modal first
  // announces what it is — not the sheet's handle or the dialog's avatar button (showModal's pick).
  // This effect runs after the surface's own (a child's) showModal().
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = body.current?.closest('dialog');
    const titleId = dialog?.getAttribute('aria-labelledby');
    const title = titleId ? document.getElementById(titleId) : null;
    if (!title) return;
    title.tabIndex = -1;
    title.classList.add('outline-none');
    title.focus({ preventScroll: true });
  }, [open]);

  return (
    <ResponsiveSurface
      open={open}
      onClose={ignore}
      intent="decision"
      title={SHEET_TITLE}
      sheetSnap={0.9}
      sheetFixed
      pinnedActions
      actions={<ProfileSubmitButton form={form} formId={FORM_ID} block />}
    >
      <div ref={body} className="flex flex-col gap-4 pt-1">
        {error ? <T4Notice tone="danger" role="alert" title={error} /> : null}
        <ProfileForm form={form} formId={FORM_ID} />
      </div>
    </ResponsiveSurface>
  );
}
