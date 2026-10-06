import { DemoStateBar } from '@/components/templates/DemoStateBar';

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

/** Dev-only strip above the template (the shared DemoStateBar): every state of T5 one click away (?state=…). */
export function StateSwitcher({ current }: { current: DemoState | null }) {
  const hint = DEMO_STATES.find((d) => d.key === current && 'hint' in d);
  return (
    <DemoStateBar
      label="Stări demo T5"
      title="T5 · Dashboard"
      hint={hint && 'hint' in hint ? hint.hint : undefined}
      groups={[
        DEMO_STATES.map((s) => ({
          key: s.key,
          label: s.label,
          href: s.key === 'ready' ? DEMO_PATH : `${DEMO_PATH}?state=${s.key}`,
          current: s.key === current,
          title: 'hint' in s ? s.hint : undefined,
        })),
      ]}
    />
  );
}
