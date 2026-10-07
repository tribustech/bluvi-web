import * as z from 'zod';

/*
 * The profile form's UI-side validation — fish schemas/userProfile.schema.ts + schemas/phone.schema.ts,
 * copy word for word (fish's trailing space after «caractere» on the max-20 message dropped). The CMS
 * re-checks username / phone uniqueness and the bio length (bluCodes, see useSaveProfile.ts).
 */

/** fish phone.schema PHONE_REGEX: 7–15 digits with an optional leading `+` (foreign numbers too). */
export const PHONE_REGEX = /^\+?\d{7,15}$/;
export const PHONE_ERROR = 'Numărul de telefon trebuie să aibă între 7 și 15 cifre';

export const USERNAME_MIN_ERROR = 'Numele de utilizator trebuie să conțină minim 3 caractere';
export const USERNAME_MAX_ERROR = 'Numele de utilizator poate conține maximum 20 de caractere';
export const BIO_MAX = 200;
export const BIO_MAX_ERROR = 'Biografia poate conține maximum 200 de caractere';

/** fish sanitizePhoneInput: keeps digits and a single leading `+`; everything else is dropped. */
export function sanitizePhoneInput(text: string): string {
  const plus = text.trimStart().startsWith('+') ? '+' : '';
  return plus + text.replace(/\D/g, '');
}

/** fish userProfileSchema (the avatar is not a text field here: the form tracks it apart). */
export const userProfileSchema = z.object({
  username: z.string().min(3, { message: USERNAME_MIN_ERROR }).max(20, USERNAME_MAX_ERROR),
  // fish optionalPhoneSchema: empty is fine, anything typed must be a full number.
  phone: z.string().refine((v) => v === '' || PHONE_REGEX.test(v), { message: PHONE_ERROR }),
  bio: z.string().max(BIO_MAX, BIO_MAX_ERROR),
});

export type ProfileValues = z.infer<typeof userProfileSchema>;
export type ProfileField = keyof ProfileValues;
export type ProfileErrors = Partial<Record<ProfileField, string>>;

/** The first message per field (fish's resolver shows one), or {} when the values are valid. */
export function validateProfile(values: ProfileValues): ProfileErrors {
  const res = userProfileSchema.safeParse(values);
  if (res.success) return {};
  const errors: ProfileErrors = {};
  for (const issue of res.error.issues) {
    const field = issue.path[0] as ProfileField;
    errors[field] ??= issue.message;
  }
  return errors;
}

/**
 * What PATCH /user/profile receives for the text fields (fish EditProfileScreen onSubmit): an empty
 * phone is null, a blank (whitespace-only) bio is null; a bio with text is sent as typed.
 */
export function toProfileRequest(values: ProfileValues): { username: string; phone: string | null; bio: string | null } {
  return {
    username: values.username,
    phone: values.phone ? values.phone : null,
    bio: values.bio.trim() ? values.bio : null,
  };
}

/** Server bluCode → the field its message goes on (fish EditProfileScreen useEffect). */
export const BLU_CODE_FIELD: Record<string, ProfileField> = {
  USERNAME_ALREADY_IN_USE: 'username',
  PHONE_NUMBER_ALREADY_IN_USE: 'phone',
  'UPDATE_PROFILE:BIO_TOO_LONG': 'bio',
};
