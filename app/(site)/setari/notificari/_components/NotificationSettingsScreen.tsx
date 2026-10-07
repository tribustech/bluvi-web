'use client';

import { useMemo, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellAlertIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { NavRow, SettingsCard, SettingsScreenFrame, SettingsSection, SwitchRow } from '@/components/account/settings';
import { describeError, ListError } from '@/components/templates/T1';
import { Button } from '@/components/ui/Button';
import { profileKeys, profileQuery, toggleNotificationsMutation, type Profile } from '@/core/social';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { routes } from '@/lib/routes';
import { useSiteToast } from '../../../_shell/Toast';
import { NOTIFICATION_SETTINGS_BACK, NOTIFICATION_SETTINGS_TITLE, NotificationSettingsSkeleton, TITLE_ID } from './NotificationSettingsSkeleton';

export const MASTER_LABEL = 'Permite notificări';
export const MASTER_HELPER = 'Oprește tot: concursuri, chat, rezervări.';
export const FOLLOWED_LABEL = 'Concursuri urmărite';
export const FOLLOWED_HELPER = 'Alege ce primești din fiecare concurs urmărit.';
export const TOGGLE_FAILED = 'Nu am putut salva setarea. Încearcă din nou.';
export const LOAD_ERROR_TITLE = 'Nu am putut încărca setările';

/**
 * «Notificări» settings (account.notification-settings) — fish app/(app)/notification-settings.tsx.
 * Rendered only for a signed-in viewer (the page's requireViewer gate). The profile is per user: read
 * in the browser through /api/cms (core profileQuery — GET /user/profile, the cache edit profile
 * shares).
 * - c1 back (history, else Setări / Acasă until Setări ships) + h1 «Notificări»;
 * - c2 the master switch reflects profile.notificationsEnabled (null = off, fish Boolean());
 * - c3 toggling: core toggleNotificationsMutation (fish useToggleNotifications — PATCH
 *   /notifications/enable-disable-pns {enabled}, the cached profile flipped at once, the profile
 *   refetched when the request settles). On a failure the web also puts the snapshot back at once
 *   (fish relies on the refetch alone, which a CMS that is down cannot answer either) and says so in
 *   the site toast; the settle refetch then confirms the server's value (a failed refetch keeps the
 *   screen: the error card replaces it only when no profile was ever read). One save at a time: a
 *   toggle while a PATCH is in flight is ignored (no queued PATCHes, no flicker between settles);
 * - c4/c5 CONCURSURI · «Concursuri urmărite» → /setari/notificari/concursuri; with the master off the
 *   card is at half opacity and the row is aria-disabled, not a link (fish onPress undefined).
 * Web push is out of scope: the switch drives the account's CMS flag only (the phone's pushes).
 */
export function NotificationSettingsScreen() {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const toast = useSiteToast();
  const profile = useQuery(profileQuery(t));
  // One save at a time: a click while a PATCH is in flight is ignored (the switch already shows the
  // pending value). Queued PATCHes would each restore their own snapshot on error and each settle
  // would refetch, so a refetch landing between two saves flipped the switch back and forth. A ref,
  // not toggle.isPending: two clicks in the same frame must not both get through.
  const saving = useRef(false);
  const toggle = useMutation({
    ...toggleNotificationsMutation(t, qc),
    onError: (_error, _enabled, context) => {
      if (context?.previousProfile) qc.setQueryData<Profile>(profileKeys.my, context.previousProfile);
      toast(TOGGLE_FAILED, 'danger');
    },
  });
  const save = (next: boolean) => {
    if (saving.current) return;
    saving.current = true;
    toggle.mutate(next, {
      onSettled: () => {
        saving.current = false;
      },
    });
  };

  if (profile.isPending) return <NotificationSettingsSkeleton />;
  // The error card only when there is nothing to show. A failed REFETCH keeps `data` (TanStack v5:
  // status 'error' with the last data) — after a failed toggle (its settle refetch fails too while the
  // CMS is down) or a failed refetch on focus — and the screen stays, as fish's (it only reads data).
  const data = profile.data;
  if (data === undefined) {
    // A session that died after the gate: the providers' onSessionDead refreshes the route and the
    // gate sends the visitor to /intra — keep the skeleton meanwhile (never a sign-out card first).
    if (isApiError(profile.error) && profile.error.code === 'SESSION_DEAD') return <NotificationSettingsSkeleton />;
    return <LoadError error={profile.error} retrying={profile.isFetching} attempt={profile.errorUpdateCount} onRetry={() => void profile.refetch()} />;
  }

  const enabled = Boolean(data.notificationsEnabled);
  return (
    <SettingsScreenFrame title={NOTIFICATION_SETTINGS_TITLE} titleId={TITLE_ID} backFallback={NOTIFICATION_SETTINGS_BACK}>
      <SettingsCard data-testid="notifications-master">
        <SwitchRow
          icon={<BellAlertIcon />}
          label={MASTER_LABEL}
          helper={MASTER_HELPER}
          checked={enabled}
          busy={toggle.isPending}
          onChange={save}
        />
      </SettingsCard>
      <SettingsSection label="Concursuri">
        <SettingsCard inactive={!enabled} data-testid="notifications-competitions">
          <NavRow
            icon={<TrophyIcon />}
            label={FOLLOWED_LABEL}
            helper={FOLLOWED_HELPER}
            href={routes.notificationPreferences()}
            disabled={!enabled}
          />
        </SettingsCard>
      </SettingsSection>
    </SettingsScreenFrame>
  );
}

function LoadError({ error, retrying, attempt, onRetry }: { error: unknown; retrying: boolean; attempt: number; onRetry: () => void }) {
  const described = describeError(error);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useSiteToast();
  const [signingOut, startSignOut] = useTransition();

  // fish ErrorScreen «Deconectează-te» (a 401): close the session, forget user data, re-render — the gate sends to /intra.
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
    <SettingsScreenFrame title={NOTIFICATION_SETTINGS_TITLE} titleId={TITLE_ID} backFallback={NOTIFICATION_SETTINGS_BACK}>
      <ListError
        title={described.kind === 'unknown' ? LOAD_ERROR_TITLE : described.title}
        description={described.message}
        onRetry={described.canRetry ? onRetry : undefined}
        retrying={retrying}
        attempt={attempt}
        secondaryAction={
          described.showSignOut ? (
            <Button variant="outline" aria-disabled={signingOut || undefined} aria-busy={signingOut || undefined} onClick={signOut}>
              {signingOut ? 'Se deconectează…' : 'Deconectează-te'}
            </Button>
          ) : undefined
        }
      />
    </SettingsScreenFrame>
  );
}
