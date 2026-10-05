/*
 * The demo's switches: `?screen=` picks the T3 user, `?state=` the state. Every state renders
 * from the same real CMS read, reshaped where the state needs it (empty, a failed section…).
 */

export const SCREENS = [
  { key: 'lake', label: 'Baltă · capitole' },
  { key: 'competition', label: 'Concurs · tab-uri' },
] as const;
export type Screen = (typeof SCREENS)[number]['key'];

export const STATES = [
  { key: 'real', label: 'Date reale' },
  { key: 'signed-out', label: 'Neautentificat' },
  // The session read did not answer in time: no sign-in prompts, no account-dependent links.
  { key: 'session-unknown', label: 'Sesiune necunoscută' },
  { key: 'empty', label: 'Gol' },
  { key: 'loading', label: 'Se încarcă' },
  { key: 'error', label: 'Eroare' },
  // The main read answered SESSION_DEAD / 401: no retry (it can never succeed), «Intră din nou».
  { key: 'session-dead', label: 'Sesiune expirată' },
  { key: 'section-error', label: 'Eroare secțiune' },
  { key: 'not-found', label: 'Inexistent (404)' },
  { key: 'long-title', label: 'Titlu lung' },
  // Lake only.
  { key: 'no-photo', label: 'Fără poze', screens: ['lake'] },
  { key: 'gallery', label: 'Galerie (3+ poze)', screens: ['lake'] },
  { key: 'booking-phone', label: 'Rezervări la telefon', screens: ['lake'] },
  { key: 'no-booking', label: 'Fără rezervări', screens: ['lake'] },
  { key: 'no-coords', label: 'Fără coordonate', screens: ['lake'] },
  { key: 'no-operator', label: 'Fără administrator', screens: ['lake'] },
  { key: 'owner-no-id', label: 'Administrator fără profil', screens: ['lake'] },
  // Competition only: the other lifecycle states and the follower counts.
  { key: 'live', label: 'Live', screens: ['competition'] },
  { key: 'upcoming', label: 'Viitor', screens: ['competition'] },
  { key: 'cancelled', label: 'Anulat', screens: ['competition'] },
  { key: 'draft', label: 'Ciornă', screens: ['competition'] },
  // The viewer's own registration (the highlighted row; signed out, a demo row stands in).
  { key: 'mine', label: 'Înscrierea mea', screens: ['competition'] },
  { key: 'viewers-1', label: '1 urmăritor', screens: ['competition'] },
] as const satisfies ReadonlyArray<{ key: string; label: string; screens?: readonly Screen[] }>;
export type DemoState = (typeof STATES)[number]['key'];

export function parseScreen(v: string | string[] | undefined): Screen {
  return SCREENS.some(s => s.key === v) ? (v as Screen) : 'lake';
}

export function parseState(v: string | string[] | undefined, screen?: Screen): DemoState {
  const found = STATES.find(s => s.key === v);
  if (!found) return 'real';
  // A state of the other screen (switching screens keeps the state) falls back to the real data.
  if (screen && 'screens' in found && !(found.screens as readonly Screen[]).includes(screen)) return 'real';
  return found.key;
}

export function demoHref(screen: Screen, state: DemoState): string {
  const q = new URLSearchParams();
  if (screen !== 'lake') q.set('screen', screen);
  if (state !== 'real') q.set('state', state);
  const s = q.toString();
  return `/dev/templates/t3${s ? `?${s}` : ''}`;
}

export const LONG_TITLE = 'Complexul piscicol Lacul cu Nuferi și Sălcii de lângă Pădurea Comana — sectorul de pescuit sportiv';
