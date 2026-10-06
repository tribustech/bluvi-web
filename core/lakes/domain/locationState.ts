import type { LakesNearbyPermissionPlaceholderMode } from '../schemas';

/*
 * fish `features/lakes/helpers/locationPermissionState.ts` — the pure half. The four states drive
 * the nearby section, its placeholder, the location dialogs and the map's locate button
 * (parity lakes.b.location-state). The platform reads (expo-location in fish, the Permissions and
 * Geolocation APIs on the web) stay in the UI.
 */

export type LakesLocationState = 'never_asked' | 'denied' | 'services_off' | 'granted';

/** fish `deriveLakesLocationState` — a permission answer (`status`) → the state, before the services check. */
export function deriveLakesLocationState(permission: { status?: string | null }): LakesLocationState {
  if (permission.status === 'granted') return 'granted';
  if (permission.status === 'denied') return 'denied';
  return 'never_asked';
}

/** fish `deriveNearbyPermissionPlaceholderMode` — the nearby slot's placeholder, none once granted. */
export function deriveNearbyPermissionPlaceholderMode(state: LakesLocationState): LakesNearbyPermissionPlaceholderMode | null {
  return state === 'granted' ? null : state;
}
