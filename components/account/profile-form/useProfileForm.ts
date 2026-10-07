'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '@/core/social';
import { prepareAvatarFile } from './avatarImage';
import { randomAvatarUrl } from './generatedAvatar';
import { sanitizePhoneInput, validateProfile, type ProfileErrors, type ProfileField, type ProfileValues } from './schema';
import { useLeaveGuard } from './useLeaveGuard';
import { AVATAR_PREPARE_ERROR, useSaveProfile, type AvatarValue, type SaveResult } from './useSaveProfile';

/** The profile fields the form reads (GET /user/profile, core social.profileSchema). */
export type ProfileFormSource = Pick<Profile, 'id' | 'username' | 'phone' | 'bio' | 'provider' | 'avatar'>;

export type UseProfileFormOptions = {
  /**
   * «Finalizează» is enabled before anything changed (complete-profile: the prefilled values are
   * accepted as they are). Edit profile keeps fish's default: disabled until the form is dirty.
   */
  allowPristineSubmit?: boolean;
  /** Called after a successful save (the screen navigates and toasts). */
  onSaved: () => void;
  /** Called with the message of every failure (the screen toasts it). */
  onError: (message: string) => void;
};

/**
 * The state of the profile form (fish components/EditProfileScreen.tsx), shared by edit profile,
 * complete profile and the Home sheet:
 * - prefilled from the profile; without a saved avatar a random generated one is set AND marked
 *   changed, so it is uploaded on submit (fish setValue(..., { shouldDirty: true }));
 * - validation on submit, then live on every change (react-hook-form's defaults fish runs on);
 * - a server bluCode puts its message on its field until that field is edited.
 * Dirty = the avatar changed or a field differs from what was loaded (typing a value back is not a
 * change — fish's form compared with its empty defaults and stayed dirty; the web is stricter).
 *
 * Leaving with unsaved edits asks first (useLeaveGuard): `unsaved` counts the USER's edits only (a
 * field changed, or the avatar regenerated / picked — never the generated avatar set on load), and
 * not while saving or after a save. <ProfileForm> renders the dialog (`leaveDialog`); a screen
 * wraps its own exits (back chip, a sheet's close) in `guardLeave(leave)`.
 */
export function useProfileForm(profile: ProfileFormSource, { allowPristineSubmit = false, onSaved, onError }: UseProfileFormOptions) {
  const [initial] = useState<ProfileValues>(() => ({ username: profile.username, phone: profile.phone ?? '', bio: profile.bio ?? '' }));
  const [values, setValues] = useState<ProfileValues>(initial);
  const [avatar, setAvatar] = useState<AvatarValue>(() =>
    profile.avatar ? { kind: 'remote', url: profile.avatar.url } : { kind: 'generated', url: randomAvatarUrl() },
  );
  const [avatarChanged, setAvatarChanged] = useState(!profile.avatar);
  // The user changed the avatar (the generated one set on load does not count as an edit).
  const [avatarTouched, setAvatarTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ProfileErrors>({});
  const [preparing, setPreparing] = useState(false);
  const { save, phase, pending } = useSaveProfile(profile.id);

  // A picked photo's preview is an object URL: revoked when it is replaced or the form unmounts.
  const previewUrl = avatar.kind === 'file' ? avatar.previewUrl : null;
  useEffect(() => (previewUrl ? () => URL.revokeObjectURL(previewUrl) : undefined), [previewUrl]);

  const clientErrors = submitted ? validateProfile(values) : {};
  const errors: ProfileErrors = { ...clientErrors, ...serverErrors };

  const fieldsChanged = values.username !== initial.username || values.phone !== initial.phone || values.bio !== initial.bio;
  const dirty = avatarChanged || fieldsChanged;
  const unsaved = (fieldsChanged || avatarTouched) && !pending && !saved;
  const { guard: guardLeave, dialog: leaveDialog } = useLeaveGuard(unsaved);

  const setField = useCallback((field: ProfileField, raw: string) => {
    const value = field === 'phone' ? sanitizePhoneInput(raw) : raw;
    setValues((v) => ({ ...v, [field]: value }));
    setServerErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
  }, []);

  /** fish handleRegenerateAvatar. */
  const regenerateAvatar = useCallback(() => {
    setAvatar({ kind: 'generated', url: randomAvatarUrl() });
    setAvatarChanged(true);
    setAvatarTouched(true);
  }, []);

  /** fish handlePickImage, after the picker: the photo prepared for upload, previewed as is. */
  const pickAvatar = useCallback(
    async (file: File) => {
      setPreparing(true);
      try {
        const blob = await prepareAvatarFile(file);
        setAvatar({ kind: 'file', blob, previewUrl: URL.createObjectURL(blob) });
        setAvatarChanged(true);
        setAvatarTouched(true);
      } catch {
        onError(AVATAR_PREPARE_ERROR);
      } finally {
        setPreparing(false);
      }
    },
    [onError],
  );

  /** Validates, then saves. Returns the first invalid field (to focus) or null. */
  const submit = useCallback(async (): Promise<ProfileField | null> => {
    setSubmitted(true);
    const invalid = validateProfile(values);
    const first = (['username', 'phone', 'bio'] as const).find((f) => invalid[f]);
    if (first) return first;
    const result: SaveResult = await save(values, avatarChanged ? avatar : null);
    if (result.ok) {
      setSaved(true);
      onSaved();
      return null;
    }
    setServerErrors(result.fieldErrors);
    onError(result.message);
    const field = (['username', 'phone', 'bio'] as const).find((f) => result.fieldErrors[f]);
    return field ?? null;
  }, [values, avatar, avatarChanged, save, onSaved, onError]);

  return {
    values,
    errors,
    avatar,
    avatarChanged,
    provider: profile.provider ?? null,
    dirty,
    unsaved,
    guardLeave,
    leaveDialog,
    canSubmit: (allowPristineSubmit || dirty) && !pending && !preparing,
    pending,
    preparing,
    phase,
    setField,
    regenerateAvatar,
    pickAvatar,
    submit,
  };
}

export type ProfileFormState = ReturnType<typeof useProfileForm>;
