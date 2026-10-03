import type { ReactNode } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { SadSearchIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';

/*
 * Empty · loading · error — Fundații §07. Photos load with their blurhash (from the DTO), never a
 * coloured skeleton; the grey skeleton is for text only.
 */

const CARD = 'flex items-center gap-3 rounded-card bg-surface p-4';

type EmptyProps = { title: string; description?: ReactNode; icon?: ReactNode; className?: string };

/** Nothing to show (e.g. «Momentan nu este niciun concurs live.»). */
export function EmptyState({ title, description, icon, className }: EmptyProps) {
  return (
    <div className={cn(CARD, 'shadow-e0', className)}>
      <span className="flex size-12 shrink-0 items-center justify-center text-ink">
        {icon ?? <SadSearchIcon size={48} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="t-body-strong">{title}</p>
        {description ? <p className="t-caption text-muted">{description}</p> : null}
      </div>
    </div>
  );
}

/** Text skeleton row: square placeholder + two grey lines. Announced once as «Se încarcă». */
export function LoadingRow({ className, label = 'Se încarcă…' }: { className?: string; label?: string }) {
  return (
    <div role="status" aria-label={label} className={cn(CARD, 'shadow-e0', className)}>
      <span aria-hidden className="size-12 shrink-0 rounded-avatar bg-soft-fill animate-shimmer" />
      <span aria-hidden className="flex flex-1 flex-col gap-2">
        <span className="h-3 w-[70%] rounded-full bg-soft-fill" />
        <span className="h-2.5 w-[45%] rounded-full bg-soft-fill" />
      </span>
    </div>
  );
}

type ErrorProps = {
  title: string;
  /** e.g. «Ultima versiune: acum 3 min» — what the user still sees. */
  description?: ReactNode;
  /** The retry control (a Button with onClick, or a form). */
  action?: ReactNode;
  className?: string;
};

/** Load failure with an optional retry («Reîncearcă»). */
export function ErrorState({ title, description, action, className }: ErrorProps) {
  return (
    <div role="alert" className={cn(CARD, 'shadow-[inset_0_0_0_1px_var(--color-status-danger-line)]', className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-status-danger-bg text-status-danger-fg">
        <ExclamationCircleIcon className="size-[22px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="t-body-strong">{title}</p>
        {description ? <p className="t-caption text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
