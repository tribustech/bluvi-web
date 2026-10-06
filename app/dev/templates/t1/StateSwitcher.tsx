import { DemoStateBar } from '@/components/templates/DemoStateBar';

export const DEMO_PATH = '/dev/templates/t1';

/**
 * Every state the demo can be put in (`?state=`), one per state of
 * docs/parity/areas/competitions-list.yml that needs forcing. `live` = real data, real session.
 * The demo renders the PRODUCTION screen (/concursuri's CompetitionsScreen); outages (loading /
 * empty / error) are forced in its TRANSPORT (demoTransport.ts), so every region — tabs, bento,
 * aside — reacts exactly as the shipped page does.
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
  { key: 'results', label: 'Căutare' },
  { key: 'results-empty', label: 'Căutare fără rezultate' },
  { key: 'filtered', label: 'Filtre active' },
  { key: 'filtered-empty', label: 'Filtre fără rezultate' },
  { key: 'next-page', label: 'Pagina următoare' },
  { key: 'next-page-error', label: 'Pagina următoare eșuează' },
  { key: 'gate', label: 'Urmărite, deconectat' },
  { key: 'followed-empty', label: 'Urmărite, goale' },
  { key: 'mine', label: 'Ale mele' },
  { key: 'mine-finished', label: 'Ale mele, toate încheiate' },
  { key: 'live-tab', label: 'Tab Live' },
  { key: 'completed', label: 'Rezultate · listă' },
  { key: 'crash', label: 'Eroare de randare' },
] as const;

export type DemoState = (typeof DEMO_STATES)[number]['key'];

export function parseDemoState(value: string | string[] | undefined): DemoState {
  const v = Array.isArray(value) ? value[0] : value;
  return DEMO_STATES.some((s) => s.key === v) ? (v as DemoState) : 'live';
}

/** Dev-only band under the top bar: jumps between the template's states (the shared DemoStateBar). */
export function StateSwitcher({ current }: { current?: DemoState }) {
  return (
    <DemoStateBar
      label="Stări demonstrație T1"
      title="T1 · stare"
      groups={[
        DEMO_STATES.map((s) => ({
          key: s.key,
          label: s.label,
          href: s.key === 'live' ? DEMO_PATH : `${DEMO_PATH}?state=${s.key}`,
          current: s.key === current,
        })),
      ]}
    />
  );
}
