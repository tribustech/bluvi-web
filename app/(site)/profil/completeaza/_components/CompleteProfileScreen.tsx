'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useTransition } from 'react';
import { ProfileForm, ProfileSubmitButton, useProfileForm, type ProfileFormSource } from '@/components/account/profile-form';
import { describeError } from '@/components/templates/T1/describeError';
import { T4Gate } from '@/components/templates/T4/T4Gate';
import { Button } from '@/components/ui/Button';
import { profileKeys, profileQuery } from '@/core/social';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../_shell/Toast';
import { EditProfileActions } from '../../../setari/profil/_components/EditProfileFrame';
import { ProfilePreview } from '../../../setari/profil/_components/ProfilePreview';
import { CompleteProfileFrame, CompleteProfileSkeleton } from './CompleteProfileFrame';

const FORM_ID = 'completeaza-profilul-form';
export const LOAD_ERROR_TITLE = 'Nu am putut încărca profilul';

/**
 * «Completează profilul» (fish app/(app)/complete-profile.tsx: EditProfileScreen with
 * `goBack={false}`, `disableSubmitButton={false}`, success → router.replace('/')). The page gate
 * (requireViewer) already sent signed-out visitors to /intra; the profile is per-user, read here
 * through the /api/cms proxy (core profileQuery, GET /user/profile).
 * - loading → the whole form in grey; error → fish ErrorScreen through describeError (as edit
 *   profile); a dead session keeps the skeleton (onSessionDead refreshes, the gate redirects);
 * - loaded → the shared ProfileForm with `allowPristineSubmit` («Finalizează» on untouched: the
 *   prefilled values are accepted as they are); without a saved avatar a generated one is set and
 *   counts as a change, so it is uploaded on submit (useProfileForm);
 * - success → wait for the refetched own profile, then replace to Acasă and refresh the server parts
 *   (the top bar's Viewer), no toast. Waiting matters: Acasă's CompleteProfileSheet reads the same
 *   query, and a stale isProfileComplete:false there would open its non-dismissable form again.
 * A complete profile opening the page gets the same form (fish does not guard it).
 */
export function CompleteProfileScreen() {
  const t = useMemo(() => createBrowserTransport(), []);
  const profile = useQuery(profileQuery(t));

  if (profile.isPending) return <CompleteProfileSkeleton />;
  if (profile.isError) {
    if (isApiError(profile.error) && profile.error.code === 'SESSION_DEAD') return <CompleteProfileSkeleton />;
    return <LoadError error={profile.error} retrying={profile.isFetching} onRetry={() => void profile.refetch()} />;
  }
  return <LoadedForm key={profile.data.documentId} profile={profile.data} />;
}

function LoadError({ error, retrying, onRetry }: { error: unknown; retrying: boolean; onRetry: () => void }) {
  const described = describeError(error);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const [signingOut, startSignOut] = useTransition();

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
    <CompleteProfileFrame variant="bare">
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
    </CompleteProfileFrame>
  );
}

function LoadedForm({ profile }: { profile: ProfileFormSource & { documentId: string } }) {
  const toast = useSiteToast();
  const router = useRouter();
  const qc = useQueryClient();

  const onSaved = useCallback(async () => {
    // The update mutation already started the my-profile refetch (un-awaited, as fish): join it
    // (cancelRefetch false — no second GET) so Acasă mounts on the fresh profile.
    await qc.invalidateQueries({ queryKey: profileKeys.my }, { cancelRefetch: false });
    // fish router.replace('/'): no way back to the form; the top bar's Viewer is a server read.
    router.replace(routes.home());
    router.refresh();
  }, [qc, router]);
  const onError = useCallback((message: string) => toast(message, 'danger'), [toast]);

  const form = useProfileForm(profile, { allowPristineSubmit: true, onSaved, onError });

  return (
    <CompleteProfileFrame
      // No «Vezi profilul public» here: c1 has no way out of this screen (and for a fresh social
      // sign-in the public page would be titled «null null»).
      aside={<ProfilePreview form={form} viewerId={profile.documentId} savedName={profile.username} publicLink={false} />}
      actions={<EditProfileActions primary={<ProfileSubmitButton form={form} formId={FORM_ID} />} />}
    >
      <ProfileForm form={form} formId={FORM_ID} />
    </CompleteProfileFrame>
  );
}
