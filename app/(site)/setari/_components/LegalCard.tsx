import type { ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon, ChevronRightIcon, DocumentIcon, LockClosedIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import { ROW_FOCUS, ROW_ICON, ROW_LINE, ROW_PAD_X, SettingsCard } from '@/components/account/settings';
import { OpenConsentSettings } from '@/components/consent/OpenConsentSettings';
import { cn } from '@/components/ui/cn';
import { PRIVACY_URL, TERMS_URL } from '../../intra/logic';

/**
 * c16 (fish settings.tsx:290-312): «Termeni și condiții» and «Politica de confidențialitate» open the
 * Termly pages (fish Linking.openURL → a new tab here, said in the name: «se deschide într-o filă
 * nouă»; the same URLs as /intra's consent line). fish's third row, «Setări de confidențialitate»,
 * opens the GDPR SDK (account.cmp-personalize); on the web it opens the cookie-consent preferences
 * dialog in place (m8.consent, components/consent), a link to the public /cookie-uri page with JS off.
 */
export function LegalCard() {
  return (
    <SettingsCard data-testid="settings-legal">
      <ExternalRow href={TERMS_URL} icon={<DocumentIcon />} label="Termeni și condiții" />
      <ExternalRow href={PRIVACY_URL} icon={<LockClosedIcon />} label="Politica de confidențialitate" />
      <OpenConsentSettings
        className={cn('block transition-colors duration-(--duration-fast) ease-fast hover:bg-soft-fill active:bg-soft-fill', ROW_PAD_X, ROW_FOCUS)}
      >
        <span className={ROW_LINE}>
          <span aria-hidden className={ROW_ICON}>
            <ShieldCheckIcon />
          </span>
          <span className="t-body-strong min-w-0 flex-1 text-ink">Setări de confidențialitate</span>
          <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-ink-2" />
        </span>
      </OpenConsentSettings>
    </SettingsCard>
  );
}

function ExternalRow({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('block transition-colors duration-(--duration-fast) ease-fast hover:bg-soft-fill active:bg-soft-fill', ROW_PAD_X, ROW_FOCUS)}
    >
      <span className={ROW_LINE}>
        <span aria-hidden className={ROW_ICON}>
          {icon}
        </span>
        <span className="t-body-strong min-w-0 flex-1 text-ink">
          {label}
          <span className="sr-only"> (se deschide într-o filă nouă)</span>
        </span>
        <ArrowTopRightOnSquareIcon aria-hidden className="size-5 shrink-0 text-ink-2" />
      </span>
    </a>
  );
}
