'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BellAlertIcon, TicketIcon } from '@heroicons/react/24/outline';
import { ContactCard } from '@/components/account/ContactSurface';
import { ReputationBlock } from '@/components/account/angler/ReputationBlock';
import { NavRow, SETTINGS_CARD, SettingsCard } from '@/components/account/settings';
import { describeError, ListError } from '@/components/templates/T1';
import { DashboardRefresh } from '@/components/templates/T5/DashboardRefresh';
import { profileQuery, type Profile } from '@/core/social';
import { isApiError } from '@/core/transport';
import { useSignOut } from '@/lib/client/sign-out';
import { createBrowserTransport } from '@/lib/client/transport';
import { ON_WEB, routes } from '@/lib/routes';
import { InfoSection } from './InfoSection';
import { LeaveActions } from './LeaveActions';
import { LegalCard } from './LegalCard';
import { OrganizerRow } from './OrganizerRow';
import { ProfileCardRow } from './ProfileCardRow';
import { SettingsColumns, SettingsFrame } from './SettingsFrame';
import { SettingsSkeleton } from './SettingsSkeleton';

export const LOAD_ERROR_TITLE = 'Nu am putut încărca setările';

/**
 * «Setări» (account.settings) — fish app/(app)/settings.tsx. Rendered only for a signed-in viewer
 * (the page's requireViewer gate). The profile is per user: read in the browser through /api/cms
 * (core profileQuery — GET /user/profile, 24h cache shared with edit profile and the notification
 * settings).
 * - c1: the full skeleton while it loads; a failed read → the error card with a retry and no back
 *   control (fish ErrorScreen goBack={false});
 * - c2: back + h1 «Setări»; c20: «Reîmprospătează» (fish pull-to-refresh) refetches the profile;
 * - c3 ProfileCardRow, c4 «Notificări», c5–c12 OrganizerRow, c13 «Rezervările mele» (shown once
 *   /rezervari is on the web, ON_WEB.myBookings, M3), c14 the own ReputationBlock, c15 InfoSection,
 *   c16 LegalCard, c17 ContactCard, c18/c19 LeaveActions.
 * Leaving (sign-out, delete) stops the profile read (`enabled`) and keeps the last profile on screen,
 * so nothing refetches without the cookie and the cards never flash to a skeleton or an error card
 * before /intra lands.
 */
export function SettingsScreen() {
  const t = useMemo(() => createBrowserTransport(), []);
  const [deleting, setDeleting] = useState(false);
  const { signOut, signingOut } = useSignOut({ to: routes.signIn() });
  const leaving = deleting || signingOut;
  const profile = useQuery({ ...profileQuery(t), enabled: !leaving });
  // The last profile read, kept for the leaving moment (state adjusted during render, React's
  // «storing information from previous renders» pattern).
  const [kept, setKept] = useState<Profile | undefined>(undefined);
  if (profile.data && profile.data !== kept) setKept(profile.data);
  const data = profile.data ?? (leaving ? kept : undefined);

  if (data === undefined) {
    if (profile.isPending || leaving) return <SettingsSkeleton />;
    // A session that died after the gate: the providers' onSessionDead sends the visitor to /intra —
    // keep the skeleton meanwhile (never an error card first).
    if (isApiError(profile.error) && profile.error.code === 'SESSION_DEAD') return <SettingsSkeleton />;
    const described = describeError(profile.error);
    return (
      <SettingsFrame back={false}>
        <ListError
          title={described.kind === 'unknown' ? LOAD_ERROR_TITLE : described.title}
          description={described.message}
          onRetry={() => void profile.refetch()}
          retrying={profile.isFetching}
          attempt={profile.errorUpdateCount}
        />
      </SettingsFrame>
    );
  }

  return (
    <SettingsFrame
      actions={
        <DashboardRefresh
          onRefresh={async () => {
            const r = await profile.refetch();
            return !r.isError;
          }}
        />
      }
    >
      <SettingsColumns
        profile={<ProfileCardRow profile={data} />}
        actions={
          <SettingsCard data-testid="settings-actions">
            <NavRow icon={<BellAlertIcon />} label="Notificări" href={routes.notificationSettings()} />
            <OrganizerRow profile={data} />
            {ON_WEB.myBookings ? <NavRow icon={<TicketIcon />} label="Rezervările mele" href={routes.myBookings()} /> : null}
          </SettingsCard>
        }
        reputation={
          <div className={`${SETTINGS_CARD} p-5`}>
            <ReputationBlock userId={data.documentId} />
          </div>
        }
        info={<InfoSection profile={data} />}
        legal={<LegalCard />}
        contact={<ContactCard />}
        leave={<LeaveActions onSignOut={signOut} signingOut={signingOut} onLeaving={setDeleting} />}
      />
    </SettingsFrame>
  );
}
