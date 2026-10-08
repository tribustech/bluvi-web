import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';

/*
 * The Setări tab's grouped rows (fish InfoScene: small uppercase section label over a white card of
 * hairline-separated rows) — Revolut-clean: one card per group, label left muted, value right strong.
 */

/** A white card (radius 16, the e0 ring) at every width — inset on the phone, like fish. */
export const CARD = 'rounded-card bg-surface shadow-e0';

export function Group({ id, title, testId, children }: { id: string; title: string; testId?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} data-testid={testId} className="flex flex-col gap-2">
      <h2 id={id} className="px-1 t-eyebrow text-muted uppercase">
        {title}
      </h2>
      <ul className={cn(CARD, 'divide-y divide-hairline px-4')}>{children}</ul>
    </section>
  );
}

/** A read-only fact: «Început   7 oct. · 09:46». `sub` is a second line under the value. */
export function FactRow({ label, value, sub, testId }: { label: string; value: string; sub?: string; testId?: string }) {
  return (
    <li data-testid={testId} className="flex min-h-12 items-center justify-between gap-4 py-3">
      <span className="shrink-0 t-body text-muted">{label}</span>
      <span className="flex min-w-0 flex-col items-end gap-0.5 text-right">
        <span className="max-w-full truncate t-body-strong text-ink">{value}</span>
        {sub ? <span className="max-w-full truncate t-caption text-muted">{sub}</span> : null}
      </span>
    </li>
  );
}

/** An editable setting: icon · label · value · chevron, the whole row a button. */
export function NavRow({ icon, label, value, onClick, testId }: { icon: ReactNode; label: string; value: string; onClick: () => void; testId?: string }) {
  return (
    <li>
      <button
        type="button"
        data-testid={testId}
        onClick={onClick}
        className="-mx-4 flex min-h-13 w-[calc(100%+--spacing(8))] cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-(--duration-fast) hover:bg-soft-fill focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden className="flex size-5 shrink-0 items-center justify-center text-muted [&>svg]:size-5">
          {icon}
        </span>
        <span className="shrink-0 t-body text-muted">{label}</span>
        <span className="min-w-0 flex-1 truncate text-right t-body-strong text-ink">{value}</span>
        <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-faint" />
      </button>
    </li>
  );
}
