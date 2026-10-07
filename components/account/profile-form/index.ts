/**
 * The profile form (fish components/EditProfileScreen.tsx) — used by edit profile (/setari/profil),
 * complete profile and the Home «Completează profilul» sheet:
 *
 *   const form = useProfileForm(profile, { allowPristineSubmit, onSaved, onError });
 *   <ProfileForm form={form} formId="profil" />
 *   <ProfileSubmitButton form={form} formId="profil" />   // in the screen's action bar
 *   form.guardLeave(close)                                 // the screen's own exits ask first while unsaved
 *
 * Loading / error states are the screen's (the profile query is profileQuery from core/social).
 */
export { ProfileForm, ProfileSubmitButton, providerLabel } from './ProfileForm';
export { ProfileFormSkeleton } from './ProfileFormSkeleton';
export { useProfileForm, type ProfileFormSource, type ProfileFormState, type UseProfileFormOptions } from './useProfileForm';
export { AvatarPicker } from './AvatarPicker';
export { useLeaveGuard, LEAVE_TITLE } from './useLeaveGuard';
export type { AvatarValue, SavePhase } from './useSaveProfile';
export * from './schema';
export { buildAvatarUrl, randomAvatarUrl, DICEBEAR_PERSONAS } from './generatedAvatar';
