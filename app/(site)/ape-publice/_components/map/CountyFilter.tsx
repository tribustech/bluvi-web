'use client';

import { CheckIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { filterCounties, watersCountLabel, type PublicWaterCounty } from '@/core/lakes';

/*
 * fish PublicWaterCountyFilter body (parity public-waters.harta-ape.c32/c33): «Caută un județ»
 * (diacritic-insensitive), «Toate» clears the draft (shown when ≥ 1 is ticked), then one row per
 * county — the name, «N apă/ape» and a checkbox. The panel (T2Panel) carries «Județe» and the
 * «Anulează» / «Aplică (N)» footer; the draft is committed only by «Aplică» (shown only once the
 * counties are here). Loading: rows in the list's own shape; a failed read: «Încearcă din nou».
 */
export function CountyFilterBody({
  counties,
  status,
  draft,
  onToggle,
  onClear,
  term,
  onTerm,
  retrying = false,
  onRetry,
}: {
  counties: PublicWaterCounty[];
  status: 'pending' | 'error' | 'success';
  draft: ReadonlySet<number>;
  onToggle: (id: number) => void;
  onClear: () => void;
  term: string;
  onTerm: (t: string) => void;
  retrying?: boolean;
  onRetry?: () => void;
}) {
  const shown = filterCounties(counties, term);
  return (
    <div className="flex flex-col gap-2 pt-2">
      <div className="flex items-center gap-2.5">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-full bg-soft-fill px-3.5 focus-within:outline-2 focus-within:outline-accent">
          <MagnifyingGlassIcon aria-hidden className="size-4.5 shrink-0 text-muted" />
          <span className="sr-only">Caută un județ</span>
          <input
            type="search"
            value={term}
            onChange={(e) => onTerm(e.target.value)}
            placeholder="Caută un județ"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent t-field text-ink outline-none placeholder:text-muted"
          />
        </label>
        {draft.size > 0 ? (
          <button type="button" onClick={onClear} className="shrink-0 cursor-pointer rounded-control px-1 t-body-strong text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent">
            Toate
          </button>
        ) : null}
      </div>
      {status === 'pending' ? (
        <div>
          <p role="status" className="sr-only">
            Se încarcă județele…
          </p>
          <ul aria-hidden className="flex flex-col">
            {['w-[44%]', 'w-[32%]', 'w-[52%]', 'w-[38%]', 'w-[46%]', 'w-[30%]', 'w-[40%]', 'w-[36%]'].map((w, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-hairline py-3">
                <span className="flex flex-1 flex-col gap-1.5">
                  <span className={cn('h-4 animate-shimmer rounded-full bg-soft-fill', w)} />
                  <span className="h-3 w-16 animate-shimmer rounded-full bg-soft-fill" />
                </span>
                <span className="size-6 shrink-0 rounded-badge bg-soft-fill" />
              </li>
            ))}
          </ul>
        </div>
      ) : status === 'error' ? (
        <div role="alert" className="flex flex-col items-start gap-3 py-4">
          <p className="t-body text-status-danger-fg">Județele nu s-au putut încărca.</p>
          {onRetry ? (
            <Button
              variant="secondary"
              size="compact"
              aria-busy={retrying || undefined}
              aria-disabled={retrying || undefined}
              onClick={() => {
                if (!retrying) onRetry();
              }}
            >
              {retrying ? 'Se încarcă…' : 'Încearcă din nou'}
            </Button>
          ) : null}
        </div>
      ) : (
        <fieldset>
          <legend className="sr-only">Județe</legend>
          <ul className="flex flex-col">
            {shown.map((c) => {
              const on = draft.has(c.id);
              return (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-hairline py-3 has-focus-visible:outline-2 has-focus-visible:outline-accent">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="t-body-strong text-ink">{c.name}</span>
                      <span className="t-caption text-muted">{watersCountLabel(c.fishingWatersCount)}</span>
                    </span>
                    <input type="checkbox" checked={on} onChange={() => onToggle(c.id)} className="peer sr-only" />
                    <span
                      aria-hidden
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-badge',
                        on ? 'bg-accent-ink text-on-accent' : 'border-2 border-faint bg-surface',
                      )}
                    >
                      {on ? <CheckIcon className="size-4" strokeWidth={3} /> : null}
                    </span>
                  </label>
                </li>
              );
            })}
            {!shown.length ? <li className="py-4 t-body text-muted">{`Niciun județ pentru „${term.trim()}”.`}</li> : null}
          </ul>
        </fieldset>
      )}
    </div>
  );
}
