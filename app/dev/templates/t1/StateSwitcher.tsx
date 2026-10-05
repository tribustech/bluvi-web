import Link from 'next/link';
import { SHELL_GUTTERS, SHELL_MAX } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';

export const DEMO_PATH = '/dev/templates/t1';

/**
 * Every state the demo can be put in (`?state=`), one per state of
 * docs/parity/areas/competitions-list.yml that needs forcing. `live` = real data, real session.
 * Outages (loading / empty / error) are forced in the TRANSPORT (demoTransport.ts), so every region
 * — tabs, bento, aside — reacts as it would in production; see CompetitionsDemo for the rest.
 */
export const DEMO_STATES = [
  { key: 'live', label: 'Date reale' },
  { key: 'signed-out', label: 'Deconectat' },
  { key: 'loading', label: 'Se încarcă' },
  { key: 'loading-list', label: 'Se încarcă · listă' },
  { key: 'empty', label: 'Gol' },
  { key: 'error', label: 'Eroare' },
  { key: 'error-recover', label: 'Eroare, apoi revine' },
  { key: 'error-session', label: 'Eroare: sesiune expirată' },
  { key: 'error-server', label: 'Eroare: server' },
  { key: 'slow', label: 'CMS blocat' },
  { key: 'slow-server', label: 'Server lent' },
  { key: 'results', label: 'Căutare' },
  { key: 'results-empty', label: 'Căutare fără rezultate' },
  { key: 'filtered', label: 'Filtre active' },
  { key: 'filtered-empty', label: 'Filtre fără rezultate' },
  { key: 'busy', label: 'Schimbare de tab' },
  { key: 'next-page', label: 'Pagina următoare' },
  { key: 'next-page-error', label: 'Pagina următoare eșuează' },
  { key: 'gate', label: 'Urmărite, deconectat' },
  { key: 'followed-empty', label: 'Urmărite, goale' },
  { key: 'mine', label: 'Ale mele' },
  { key: 'mine-finished', label: 'Ale mele, toate încheiate' },
  { key: 'live-tab', label: 'Tab Live' },
  { key: 'completed', label: 'Rezultate · listă' },
  { key: 'actions', label: 'Acțiune fixă' },
  { key: 'crash', label: 'Eroare de randare' },
] as const;

export type DemoState = (typeof DEMO_STATES)[number]['key'];

export function parseDemoState(value: string | string[] | undefined): DemoState {
  const v = Array.isArray(value) ? value[0] : value;
  return DEMO_STATES.some((s) => s.key === v) ? (v as DemoState) : 'live';
}

/** Dev-only band under the top bar: jumps between the template's states. */
export function StateSwitcher({ current }: { current?: DemoState }) {
  return (
    <nav aria-label="Stări demonstrație T1" className="border-b border-hairline bg-soft-fill">
      <div className={cn('mx-auto flex items-center gap-3 py-2', SHELL_MAX, SHELL_GUTTERS)}>
        <span className="t-label shrink-0 text-muted">T1 · stare</span>
        <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {DEMO_STATES.map((s) => (
            <li key={s.key} className="shrink-0">
              <Link
                href={s.key === 'live' ? DEMO_PATH : `${DEMO_PATH}?state=${s.key}`}
                aria-current={s.key === current ? 'page' : undefined}
                className={cn(
                  'flex h-8 items-center rounded-full px-3 t-label whitespace-nowrap',
                  s.key === current ? 'bg-navy text-lavender' : 'bg-surface text-ink-2 shadow-e0 hover:text-ink',
                )}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
