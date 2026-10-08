import { ClockIcon } from '@heroicons/react/24/outline';
import { DashboardAlert, ICON_TILE, TONE_SQUARE } from '@/components/templates/T5';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import type { LakeOperatorStats } from '@/core/lakes';
import { pendingSubtitle, pendingTitle } from './model';

/**
 * c8 / c9 — fish AlertCard «{n} cereri așteaptă răspuns»: shown only while requests wait, the page's
 * one filled button («Răspunde» → De aprobat). The «în așteptare» pair (T5 `pending`): the same
 * colour as the Rezervări badge.
 *
 * wide (below 1280): the T5 DashboardAlert, one row from 768. narrow: the left column's 240–256px
 * card — icon and title on top, the oldest request under them, the button full width at the bottom.
 */
export function PendingAlert({
  pending,
  oldest,
  href,
  layout = 'wide',
}: {
  pending: number;
  oldest: LakeOperatorStats['oldestPending'];
  href: string;
  layout?: 'wide' | 'narrow';
}) {
  if (pending <= 0) return null;
  const title = pendingTitle(pending);
  const description = pendingSubtitle(oldest);
  const action = { href, label: 'Răspunde', srLabel: 'Răspunde la cererile în așteptare' };
  if (layout === 'wide') {
    return <DashboardAlert tone="pending" icon={<ClockIcon />} title={title} description={description} action={action} />;
  }
  return (
    <div className="flex flex-col gap-3 rounded-card bg-surface p-4.5 shadow-e0">
      <div className="flex items-start gap-3">
        <span aria-hidden className={cn(ICON_TILE, TONE_SQUARE.pending)}>
          <ClockIcon />
        </span>
        <p className="min-w-0 flex-1 t-heading text-pretty text-ink">{title}</p>
      </div>
      <p className="t-caption text-status-pending-fg">{description}</p>
      <ButtonLink href={action.href} aria-label={action.srLabel} block>
        {action.label}
      </ButtonLink>
    </div>
  );
}
