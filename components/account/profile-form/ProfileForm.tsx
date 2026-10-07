'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { EnvelopeIcon, UserCircleIcon } from '@heroicons/react/20/solid';
import { TextInput } from '@/components/forms/TextInput';
import { T2Spinner } from '@/components/templates/T2/T2MapOverlay';
import { T4TextArea } from '@/components/templates/T4/T4TextArea';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { AvatarPicker } from './AvatarPicker';
import { AVATAR_CELL, FORM_CONTAINER, FORM_GRID, PROVIDER_ROW } from './layout';
import { BIO_MAX, type ProfileField } from './schema';
import type { ProfileFormState } from './useProfileForm';

/**
 * fish shows the raw provider; the web names it (the CMS stores lower-case ids): the brands, and
 * Strapi's `local` (email + password) as «Email» — never a raw CMS id.
 */
const PROVIDER_LABEL: Record<string, string> = { google: 'Google', facebook: 'Facebook', apple: 'Apple', local: 'Email' };

/** «Autentificat cu Google» — `-` when the profile names no provider (fish). */
export function providerLabel(provider: string | null | undefined): string {
  if (!provider) return '-';
  return PROVIDER_LABEL[provider] ?? provider;
}

/**
 * The profile form body (fish components/EditProfileScreen.tsx): avatar picker, «Nume
 * utilizator*», «Telefon (opțional)» (fish's «optional» is a typo: owner rule, diacritics), «Biografie» (3 lines, n / 200) and the
 * read-only «Autentificat cu …» row. Geometry (one column, or avatar | fields from a 672 wide form): ./layout.ts.
 * State and submit live in useProfileForm; the submit button is <ProfileSubmitButton> so a screen
 * can put it in its own action bar (it targets the form by `formId`).
 *
 * On a refused submit (invalid field, or a server bluCode on a field) the first field in error
 * takes focus, so its label and message are read; every failure is also toasted by the screen.
 * It also renders the «Renunți la modificări?» dialog of the form's leave guard (useLeaveGuard).
 */
export function ProfileForm({ form, formId, className }: { form: ProfileFormState; formId: string; className?: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const busy = form.pending;

  // The field to focus after a refused submit, applied once (by the render that re-enables the
  // fieldset: the one that ends the save may land after the next frame).
  const pendingFocus = useRef<ProfileField | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  useEffect(() => {
    const field = pendingFocus.current;
    if (!field || busy) return;
    pendingFocus.current = null;
    const el = ref.current?.querySelector<HTMLElement>(`[name="${field}"]`);
    el?.focus({ preventScroll: true });
    el?.scrollIntoView({ block: 'center' });
  }, [focusTick, busy]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!form.canSubmit) return;
    const field = await form.submit();
    if (field) {
      pendingFocus.current = field;
      setFocusTick((n) => n + 1);
    }
  };

  const provider = providerLabel(form.provider);
  const ProviderIcon = form.provider === 'local' ? EnvelopeIcon : UserCircleIcon;

  return (
    <>
      <form ref={ref} id={formId} noValidate onSubmit={onSubmit} aria-busy={busy || undefined} className={cn(FORM_CONTAINER, className)}>
        <fieldset disabled={busy} className={FORM_GRID}>
          <legend className="sr-only">Profilul tău</legend>
          <AvatarPicker
            avatar={form.avatar}
            onRegenerate={form.regenerateAvatar}
            onPick={(file) => void form.pickAvatar(file)}
            busy={form.preparing}
            disabled={busy}
            className={AVATAR_CELL}
          />
          <div className="flex flex-col gap-4">
            <TextInput
              name="username"
              label="Nume utilizator*"
              value={form.values.username}
              onChange={(e) => form.setField('username', e.target.value)}
              error={form.errors.username}
              autoComplete="nickname"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <TextInput
              name="phone"
              type="tel"
              inputMode="tel"
              label="Telefon (opțional)"
              value={form.values.phone}
              onChange={(e) => form.setField('phone', e.target.value)}
              error={form.errors.phone}
              autoComplete="tel"
            />
            <T4TextArea
              name="bio"
              label="Biografie"
              rows={3}
              maxLength={BIO_MAX}
              // fish maxLength={200}: the browser refuses input past the cap (mid-text too), and a
              // stored bio already over it still deletes one character at a time.
              capInput
              value={form.values.bio}
              onChange={(e) => form.setField('bio', e.target.value)}
              error={form.errors.bio}
            />
          </div>
          <p className={PROVIDER_ROW} data-testid="profile-provider">
            <ProviderIcon aria-hidden className="size-5 shrink-0 text-muted" />
            <span className="t-body text-muted">
              Autentificat cu <span className="t-body-strong text-ink">{provider}</span>
            </span>
          </p>
        </fieldset>
        {/* What the button is doing, announced once per phase (the button's spinner is decorative). */}
        <p role="status" className="sr-only">
          {form.phase === 'uploading' ? 'Se încarcă fotografia…' : form.phase === 'saving' ? 'Se salvează profilul…' : ''}
        </p>
      </form>
      {form.leaveDialog}
    </>
  );
}

/** «Finalizează» (fish): off until the form changed (unless allowPristineSubmit), spinning while it saves. */
export function ProfileSubmitButton({ form, formId, block }: { form: ProfileFormState; formId: string; block?: boolean }) {
  return (
    <Button
      type="submit"
      form={formId}
      disabled={!form.canSubmit}
      aria-busy={form.pending || undefined}
      icon={form.pending ? <T2Spinner className="size-5" /> : undefined}
      block={block}
    >
      Finalizează
    </Button>
  );
}
