import { ShieldCheckIcon } from '@heroicons/react/24/outline';

// The same policy the sign-in page links to (app/(site)/intra).
const PRIVACY_URL = 'https://app.termly.io/policy-viewer/policy.html?policyUUID=958c9787-3e75-4040-990d-cb6bf2c8b3e3';

/**
 * fish (tabs)/index.tsx ConfidentialitySettingsCard (signed out only, after Contact): a white card,
 * shield icon, «Setări de confidențialitate». fish opens its consent screen (/cmp-personalize).
 * The web has no consent manager yet — it sets only the strictly necessary session cookie — so
 * the card opens the privacy policy. Point it at the CMP re-open once the web has one.
 */
export function PrivacySettingsCard() {
  return (
    <a
      href={PRIVACY_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex w-full items-center gap-2 rounded-control bg-surface p-2.5 text-left shadow-e1 transition-opacity hover:opacity-80"
    >
      <ShieldCheckIcon aria-hidden className="size-5 shrink-0 stroke-2 text-ink" />
      <span className="t-body">Setări de confidențialitate</span>
      <span className="sr-only"> (se deschide într-o filă nouă)</span>
    </a>
  );
}
