'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import { ProfileForm, ProfileSubmitButton, useProfileForm, type ProfileFormSource } from '@/components/account/profile-form';
import { describeError } from '@/components/templates/T1/describeError';
import { T4Gate } from '@/components/templates/T4/T4Gate';
import { Button } from '@/components/ui/Button';
import { profileQuery } from '@/core/social';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { useSiteToast } from '../../../_shell/Toast';
import { BackControl } from './BackControl';
import { EditProfileActions, EditProfileFrame, EditProfileSkeleton } from './EditProfileFrame';
import { editProfileExit, useExitEditProfile } from './exit';
import { ProfilePreview } from './ProfilePreview';

const FORM_ID = 'editeaza-profilul-form';
export const SAVED_TOAST = 'Profilul a fost actualizat cu succes';
export const LOAD_ERROR_TITLE = 'Nu am putut încărca profilul';

/**
 * «Editează profilul» (fish app/(app)/edit-profile.tsx + components/EditProfileScreen.tsx). The page
 * gate (requireViewer) already sent signed-out visitors to /intra and hands over the viewer's
 * documentId (the exit without history and «Vezi profilul public»); the profile itself is per-user,
 * so it is read here through the /api/cms proxy (core profileQuery: GET /user/profile, staleTime and
 * gcTime 24h — parity account.b.profile-cache).
 * - loading → the whole form in grey (EditProfileSkeleton);
 * - error → fish ErrorScreen through describeError: its title and message (never the raw server or
 *   parser text), «Încearcă din nou» only when retrying can help, «Deconectează-te» for a 401. A dead
 *   session (SESSION_DEAD) keeps the skeleton: the providers' onSessionDead already refreshes the
 *   route and requireViewer redirects to /intra;
 * - loaded → the form; success → the toast, back (fish router.dismiss()) and a router refresh of
 *   the page landed on (the server Viewer re-reads /users/me: the top bar's avatar and name follow).
 */
export function EditProfileScreen({ viewerId }: { viewerId: string }) {
  const t = useMemo(() => createBrowserTransport(), []);
  const profile = useQuery(profileQuery(t));

  if (profile.isPending) return <EditProfileSkeleton back={<BackControl viewerId={viewerId} />} />;
  if (profile.isError) {
    if (isApiError(profile.error) && profile.error.code === 'SESSION_DEAD') {
      return <EditProfileSkeleton back={<BackControl viewerId={viewerId} />} />;
    }
    return <LoadError error={profile.error} retrying={profile.isFetching} onRetry={() => void profile.refetch()} viewerId={viewerId} />;
  }
  // Keyed by the account: a different profile is a new form, never a merge of two.
  return <LoadedForm key={profile.data.documentId} profile={profile.data} viewerId={viewerId} />;
}

function LoadError({ error, retrying, onRetry, viewerId }: { error: unknown; retrying: boolean; onRetry: () => void; viewerId: string }) {
  const described = describeError(error);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const [signingOut, startSignOut] = useTransition();

  // fish «Deconectează-te»: close the session, forget user data, re-render — the gate sends to /intra.
  const signOut = () =>
    startSignOut(async () => {
      const ok = await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).then(
        (r) => r.ok,
        () => false,
      );
      if (!ok) {
        toast('Nu am putut închide sesiunea. Încearcă din nou.', 'danger');
        return;
      }
      qc.clear();
      startSignOut(() => router.refresh());
    });

  return (
    <EditProfileFrame variant="bare" back={<BackControl viewerId={viewerId} />}>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title={described.kind === 'unknown' ? LOAD_ERROR_TITLE : described.title}
        description={described.message}
        actions={
          <>
            {described.canRetry ? (
              <Button onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
                Încearcă din nou
              </Button>
            ) : null}
            {described.showSignOut ? (
              <Button variant={described.canRetry ? 'secondary' : 'primary'} onClick={signOut} aria-disabled={signingOut || undefined}>
                {signingOut ? 'Se deconectează…' : 'Deconectează-te'}
              </Button>
            ) : null}
          </>
        }
      />
    </EditProfileFrame>
  );
}

function LoadedForm({ profile, viewerId }: { profile: ProfileFormSource & { documentId: string }; viewerId: string }) {
  const toast = useSiteToast();
  const exit = useExitEditProfile(editProfileExit(viewerId));

  const onSaved = useCallback(() => {
    toast(SAVED_TOAST, 'success');
    // The chrome's Viewer (top-bar avatar and name) is a server read: re-read where we land.
    exit({ refresh: true });
  }, [toast, exit]);
  const onError = useCallback((message: string) => toast(message, 'danger'), [toast]);

  const form = useProfileForm(profile, { onSaved, onError });

  return (
    <EditProfileFrame
      back={<BackControl viewerId={viewerId} guard={form.guardLeave} />}
      aside={<ProfilePreview form={form} viewerId={profile.documentId} savedName={profile.username} />}
      actions={<EditProfileActions primary={<ProfileSubmitButton form={form} formId={FORM_ID} />} />}
    >
      <ProfileForm form={form} formId={FORM_ID} />
    </EditProfileFrame>
  );
}
