import Link from 'next/link';
import { cn } from '@/components/ui/cn';

export const DEMO_PATH = '/dev/templates/t5';

export const DEMO_STATES = [
  { key: 'ready', label: 'Date reale', hint: 'CMS local, contul QA' },
  { key: 'signed-out', label: 'Neautentificat' },
  { key: 'loading', label: 'Se încarcă' },
  { key: 'error', label: 'Eroare' },
  { key: 'empty', label: 'Zi liberă', hint: 'date reale, golite' },
  { key: 'no-lake', label: 'Fără baltă' },
  { key: 'not-owner', label: 'Baltă străină', hint: 'cerere reală, refuzată' },
  { key: 'slow', label: 'CMS lent', hint: 'schelet 8 s, apoi eroarea' },
  { key: 'busy', label: 'Zi plină', hint: 'simulat' },
  { key: 'one-pending', label: 'O cerere', hint: 'simulat, singular' },
  { key: 'many-pending', label: '120 de cereri', hint: 'simulat, «99+»' },
  { key: 'detail', label: 'Detaliu rezervare', hint: 'simulat, rândul deschis' },
  { key: 'refresh-failed', label: 'Actualizare eșuată', hint: 'simulat, datele rămân' },
  { key: 'trend-loading', label: 'Grafic: se încarcă', hint: 'simulat, «Luna»' },
  { key: 'trend-failed', label: 'Grafic: eroare', hint: 'simulat, «Luna»' },
  { key: 'legacy', label: 'CMS vechi', hint: 'simulat' },
] as const;

export type DemoState = (typeof DEMO_STATES)[number]['key'];

export function parseState(v: string | string[] | undefined): DemoState {
  const s = Array.isArray(v) ? v[0] : v;
  return DEMO_STATES.some((d) => d.key === s) ? (s as DemoState) : 'ready';
}

/** Dev-only strip above the template: every state of T5 one click away (?state=…). */
export function StateSwitcher({ current }: { current: DemoState | null }) {
  const hint = DEMO_STATES.find((d) => d.key === current && 'hint' in d);
  return (
    <nav aria-label="Stări demo T5" className="border-b border-hairline bg-surface">
      <div className="mx-auto flex max-w-436 flex-col gap-2 px-4 py-3 md:px-6 xl:flex-row xl:items-center xl:gap-4 xl:px-8">
        <p className="shrink-0 t-eyebrow text-muted uppercase">
          T5 · Dashboard{hint && 'hint' in hint ? <span className="normal-case"> — {hint.hint}</span> : null}
        </p>
        <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5 md:mx-0 md:flex-wrap md:px-0">
          {DEMO_STATES.map((s) => (
            <li key={s.key} className="shrink-0">
              <Link
                href={s.key === 'ready' ? DEMO_PATH : `${DEMO_PATH}?state=${s.key}`}
                aria-current={s.key === current ? 'page' : undefined}
                className={cn(
                  'inline-flex h-8 items-center rounded-full px-3 t-label whitespace-nowrap transition-colors duration-(--duration-fast)',
                  s.key === current ? 'bg-navy text-lavender' : 'bg-soft-fill text-ink-2 hover:bg-accent-tint hover:text-accent-ink',
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
