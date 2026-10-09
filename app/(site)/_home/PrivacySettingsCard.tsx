import { ShieldCheckIcon } from '@heroicons/react/24/outline';
import { OpenConsentSettings } from '@/components/consent/OpenConsentSettings';

/**
 * fish (tabs)/index.tsx ConfidentialitySettingsCard (signed out only, after Contact): a white card,
 * shield icon, «Setări de confidențialitate». fish opens its consent screen (/cmp-personalize); the
 * web opens the cookie-consent preferences dialog in place (m8.consent) — with JS off, a link to the
 * public /cookie-uri page.
 */
export function PrivacySettingsCard() {
  return (
    <OpenConsentSettings className="flex min-h-12 w-full items-center gap-3 rounded-card bg-surface px-4.5 py-3 text-left text-ink shadow-e0 transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent">
      <ShieldCheckIcon aria-hidden className="size-6 shrink-0" />
      <span className="t-body-strong">Setări de confidențialitate</span>
    </OpenConsentSettings>
  );
}
