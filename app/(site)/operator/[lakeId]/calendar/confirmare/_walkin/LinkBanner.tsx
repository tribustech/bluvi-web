'use client';

import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { MatchedUser } from './model';

/*
 * The answer to the match dialog, under the phone field — fish review.tsx:356-397 (c12): the account
 * (avatar, username or «Cont existent») and what happens — «Rezervarea se leagă de acest cont» on
 * the success tint (fish teal) or «Rezervare separată, fără cont» on the plain card —, and
 * «Schimbă», which asks again. The decision itself is only made in the dialog. Announced politely
 * when it appears or flips.
 */
export function LinkBanner({
  user,
  linked,
  onChange,
  disabled = false,
}: {
  user: MatchedUser;
  linked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const name = user.username ?? 'Cont existent';
  return (
    <div
      data-testid="walkin-match-banner"
      data-linked={linked || undefined}
      className={cn(
        'flex items-center gap-3 rounded-control border p-3.5',
        linked ? 'border-status-success-fg/40 bg-status-success-bg' : 'border-hairline bg-surface',
      )}
    >
      <Avatar name={name} src={user.avatar} size={40} shape="square" />
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="t-body-strong truncate text-ink">{name}</p>
        <p className={cn('t-caption', linked ? 'text-status-success-fg' : 'text-muted')}>
          {linked ? 'Rezervarea se leagă de acest cont' : 'Rezervare separată, fără cont'}
        </p>
      </div>
      <button
        type="button"
        data-testid="walkin-match-change"
        disabled={disabled}
        onClick={onChange}
        className="t-body-strong shrink-0 rounded-control px-2 py-1.5 text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-50"
      >
        Schimbă<span className="sr-only"> legătura cu contul</span>
      </button>
    </div>
  );
}
