import type { ReactNode } from 'react';
import { CardShell, CardTitle } from './CardShell';
import { formatDecimal, formatInt, plural } from './format';
import { Avatar } from '@/components/ui/Avatar';

export type AnglerCardProps = {
  username: string;
  avatarUrl?: string | null;
  city?: string | null;
  followersCount: number;
  competitionsCount: number;
  podiumsCount: number;
  /** Personal record in kg; null shows "–". */
  recordKg?: number | null;
  href?: string;
  /** The follow control (FollowButton, or nothing for the signed-in user's own card). */
  action?: ReactNode;
};

/** Fundații §07 card · pescar. */
export function AnglerCard({
  username,
  avatarUrl,
  city,
  followersCount,
  competitionsCount,
  podiumsCount,
  recordKg,
  href,
  action,
}: AnglerCardProps) {
  const stats = [
    { value: formatInt(competitionsCount), label: competitionsCount === 1 ? 'concurs' : 'concursuri' },
    { value: formatInt(podiumsCount), label: podiumsCount === 1 ? 'podium' : 'podiumuri' },
    { value: recordKg != null ? formatDecimal(recordKg, 1, 1) : '–', label: 'record kg' },
  ];
  const meta = [city, plural(followersCount, 'urmăritor', 'urmăritori')].filter(Boolean).join(' · ');

  return (
    <CardShell interactive={!!href} className="gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Avatar name={username} src={avatarUrl} size={44} tone="indigo" />
        <div className="min-w-0 flex-1">
          <CardTitle href={href} className="truncate t-body-strong text-ink">
            {username}
          </CardTitle>
          <p className="truncate t-caption text-muted">{meta}</p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-1.5">
        {stats.map(s => (
          <div key={s.label} className="flex flex-col-reverse">
            <dt className="t-micro text-muted">{s.label}</dt>
            <dd className="t-stat tracking-normal text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
      {action}
    </CardShell>
  );
}
