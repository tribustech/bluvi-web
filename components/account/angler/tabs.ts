/** The profile's tabs (account.angler-profile c15) and their `?tab=` values; Capturi is the default. */
export type ProfileTab = 'capturi' | 'sesiuni' | 'concursuri';

export const PROFILE_TABS: readonly ProfileTab[] = ['capturi', 'sesiuni', 'concursuri'];

export function parseProfileTab(value: string | null | undefined): ProfileTab {
  return value === 'sesiuni' || value === 'concursuri' ? value : 'capturi';
}
