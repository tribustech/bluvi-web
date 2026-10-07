import type { ReactNode } from 'react';
import { ArrowTopRightOnSquareIcon, DocumentIcon, LockClosedIcon } from '@heroicons/react/24/outline';
import { ROW_FOCUS, ROW_ICON, ROW_LINE, ROW_PAD_X, SettingsCard } from '@/components/account/settings';
import { cn } from '@/components/ui/cn';
import { PRIVACY_URL, TERMS_URL } from '../../intra/logic';

/**
 * c16 (fish settings.tsx:290-312): «Termeni și condiții» and «Politica de confidențialitate» open the
 * Termly pages (fish Linking.openURL → a new tab here, said in the name: «se deschide într-o filă
 * nouă»; the same URLs as /intra's consent line). fish's third row, «Setări de confidențialitate»,
 * opens the GDPR SDK (account.cmp-personalize); on the web that is the cookie-consent preferences,
 * which ship with the consent banner in M8 — the row is not shown until then (owner rule 4).
 */
export function LegalCard() {
  return (
    <SettingsCard data-testid="settings-legal">
      <ExternalRow href={TERMS_URL} icon={<DocumentIcon />} label="Termeni și condiții" />
      <ExternalRow href={PRIVACY_URL} icon={<LockClosedIcon />} label="Politica de confidențialitate" />
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
