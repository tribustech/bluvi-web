'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { profilePictureFilename, updateProfileMutation, uploadProfilePictureMutation } from '@/core/social';
import { isApiError } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';
import { rasteriseGeneratedAvatar } from './generatedAvatar';
import { BLU_CODE_FIELD, toProfileRequest, type ProfileErrors, type ProfileValues } from './schema';

/** The avatar the form holds: the saved one, a generated DiceBear one, or a picked (prepared) photo. */
export type AvatarValue =
  | { kind: 'remote'; url: string }
  | { kind: 'generated'; url: string }
  | { kind: 'file'; blob: Blob; previewUrl: string };

export type SavePhase = 'idle' | 'uploading' | 'saving';

export type SaveResult = { ok: true } | { ok: false; message: string; fieldErrors: ProfileErrors };

/** Generic failure copy (the CMS's own message wins when it sends one). */
export const AVATAR_PREPARE_ERROR = 'Nu am putut pregăti fotografia. Încearcă din nou.';
const FALLBACK_ERROR = 'A apărut o problemă. Te rugăm să încerci mai târziu.';

/**
 * The save pipeline of fish EditProfileScreen onSubmit:
 * 1. avatar changed → the image as a JPEG (a generated SVG is rasterised; a picked photo was
 *    prepared when it was picked) uploaded as `profile_id_{id}_{ms}.jpg` (POST /upload), then
 *    PATCH /user/profile { avatar: uploadedId, username, phone, bio };
 * 2. otherwise PATCH /user/profile { username, phone, bio } only.
 * Empty phone → null, blank bio → null (schema.ts toProfileRequest). The update mutation
 * (core updateProfileMutation) invalidates the own profile and every anglers query on settle.
 *
 * It returns the outcome instead of toasting or navigating — those are the screen's: a bluCode
 * (USERNAME_ALREADY_IN_USE, PHONE_NUMBER_ALREADY_IN_USE, UPDATE_PROFILE:BIO_TOO_LONG) comes back as a
 * field error carrying the server's message, and every failure carries the message to toast.
 */
export function useSaveProfile(profileId: number) {
  const t = useMemo(() => createBrowserTransport(), []);
  const qc = useQueryClient();
  const upload = useMutation(uploadProfilePictureMutation(t));
  const update = useMutation(updateProfileMutation(t, qc));
  const [phase, setPhase] = useState<SavePhase>('idle');

  const save = async (values: ProfileValues, avatar: AvatarValue | null): Promise<SaveResult> => {
    const fields = toProfileRequest(values);
    let avatarId: number | undefined;
    try {
      if (avatar && avatar.kind !== 'remote') {
        setPhase('uploading');
        let blob: Blob;
        try {
          blob = avatar.kind === 'file' ? avatar.blob : await rasteriseGeneratedAvatar(avatar.url);
        } catch {
          return { ok: false, message: AVATAR_PREPARE_ERROR, fieldErrors: {} };
        }
        const uploaded = await upload.mutateAsync({ files: [{ blob, filename: profilePictureFilename(profileId, Date.now()) }] });
        avatarId = uploaded[0]?.id;
        if (avatarId === undefined) return { ok: false, message: FALLBACK_ERROR, fieldErrors: {} };
      }
      setPhase('saving');
      await update.mutateAsync(avatarId === undefined ? fields : { avatar: avatarId, ...fields });
      return { ok: true };
    } catch (e) {
      const message = isApiError(e) || e instanceof Error ? e.message || FALLBACK_ERROR : FALLBACK_ERROR;
      const field = isApiError(e) && e.bluCode ? BLU_CODE_FIELD[e.bluCode] : undefined;
      return { ok: false, message, fieldErrors: field ? { [field]: message } : {} };
    } finally {
      setPhase('idle');
    }
  };

  return { save, phase, pending: phase !== 'idle' };
}
