import type { ReactNode } from 'react';
import { CalendarIcon, ChatBubbleLeftRightIcon, EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';
import { ROW_LINE, ROW_PAD_X, SettingsCard, SettingsSection } from '@/components/account/settings';
import { cn } from '@/components/ui/cn';
import type { Profile } from '@/core/social';
import { DASH, formatActiveSince, formatPhone, formatProvider } from './format';

/**
 * c15 (fish settings.tsx:246-288): INFORMAȚII — Email, Telefon («0712 345 678»), «Activ de la»
 * («05 oct 2026»), «Autentificat cu» (the provider capitalised); «-» for what is missing. fish draws
 * the icon and the label muted, the value in ink on the right: a read-only fact, not a control.
 * A description list, so the label and its value are read as a pair.
 */
export function InfoSection({ profile }: { profile: Profile }) {
  return (
    <SettingsSection label="Informații">
      <SettingsCard>
        <dl className="divide-y divide-hairline" data-testid="settings-info">
          <Fact icon={<EnvelopeIcon />} label="Email" value={profile.email || DASH} />
          <Fact icon={<PhoneIcon />} label="Telefon" value={formatPhone(profile.phone)} />
          <Fact icon={<CalendarIcon />} label="Activ de la" value={formatActiveSince(profile.createdAt)} />
          <Fact icon={<ChatBubbleLeftRightIcon />} label="Autentificat cu" value={formatProvider(profile.provider)} />
        </dl>
      </SettingsCard>
    </SettingsSection>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className={cn(ROW_LINE, ROW_PAD_X)}>
      <dt className="flex shrink-0 items-center gap-3 t-body-strong text-muted">
        <span aria-hidden className="size-5 shrink-0 [&>svg]:size-5">
          {icon}
        </span>
        {label}
      </dt>
      {/* The value may be long (an email): it takes the rest of the line and breaks rather than hide. */}
      <dd className="t-body-strong min-w-0 flex-1 text-right break-words text-ink">{value}</dd>
    </div>
  );
}
