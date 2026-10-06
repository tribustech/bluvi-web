import { DemoStateBar } from '@/components/templates/DemoStateBar';
import { demoHref, SCREENS, STATES, type DemoState, type Screen } from './states';

/**
 * Dev-only switcher above the template (the shared DemoStateBar): which T3 user, which state. Not
 * part of the template. Without a screen (the static shell, before the URL is known) the same bar
 * with no chips: the same height.
 */
export function StateBar({ screen, state }: { screen?: Screen; state?: DemoState }) {
  const states = screen ? STATES.filter(s => !('screens' in s) || (s.screens as readonly Screen[]).includes(screen)) : [];
  return (
    <DemoStateBar
      label="Demo T3: ecran și stare"
      title="T3 · Detaliu cu tab-uri"
      groups={
        !screen || !state
          ? []
          : [
              SCREENS.map(s => ({ key: s.key, label: s.label, href: demoHref(s.key, state), current: s.key === screen })),
              states.map(s => ({ key: s.key, label: s.label, href: demoHref(screen, s.key), current: s.key === state })),
            ]
      }
    />
  );
}
