'use client';

import { useParams } from 'next/navigation';
import {
  T4ActionBar,
  T4ActionTotal,
  T4Frame,
  T4Header,
  T4LineBar,
  T4Summary,
  type T4Back,
} from '@/components/templates/T4';
import { buttonClass } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The extras step before the availability (or the session gate) has answered: the step's own frame
 * — header «Extra», the subtitle and context lines, two card-shaped bars, the summary with «—» and
 * the held «Continuă» — so nothing moves when the cards land (CLS ≤ 0.05). Also shown for the
 * instant the guard spends sending a bad link back to the grid. `gridHref`: the back link before the
 * screen is up (the angler's grid by default; the walk-in passes its calendar).
 */
export function ExtrasSkeleton({ lakeName, back, gridHref }: { lakeName?: string; back?: T4Back; gridHref?: string }) {
  const { id } = useParams<{ id: string }>();
  return (
    <T4Frame
      header={
        <T4Header
          eyebrow={lakeName || <T4LineBar type="t-eyebrow" className="w-32" />}
          title="Extra"
          back={back ?? { label: 'Înapoi la selecție', href: gridHref ?? routes.lakeBooking(id ?? '') }}
        />
      }
      busy
      label="Extra"
      aside={
        <T4Summary
          title="Rezumat"
          rows={[
            { label: 'Standul', value: null },
            { label: 'Perioada', value: null },
          ]}
          total={{ label: 'Total', value: null, sub: 'Calculăm prețul…', busy: true }}
        />
      }
      actions={
        <T4ActionBar
          primary={
            <button type="button" aria-disabled className={buttonClass({ disabled: true })}>
              Continuă
            </button>
          }
          meta={<T4ActionTotal label="Total" value={null} sub="Calculăm prețul…" busy />}
          metaBelowXl
        />
      }
    >
      <div aria-hidden className="flex flex-col gap-1">
        <p className="t-body text-muted">Poți adăuga la rezervare, dacă vrei.</p>
        <T4LineBar type="t-caption xl:hidden" className="w-64 max-w-full" />
      </div>
      <div aria-hidden data-testid="extras-skeleton" className="grid gap-2.5 md:gap-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-3 rounded-card bg-surface p-4 shadow-e0">
            <span className="size-6 shrink-0 rounded-full bg-soft-fill animate-shimmer" />
            <span className="flex flex-1 flex-col">
              <T4LineBar type="t-body-strong" className="w-28" />
              <T4LineBar type="t-caption" className="w-40" />
            </span>
            <T4LineBar type="t-heading" className="w-16" />
          </div>
        ))}
      </div>
    </T4Frame>
  );
}
