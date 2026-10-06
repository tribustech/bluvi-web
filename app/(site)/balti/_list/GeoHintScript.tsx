'use client';

import { useSyncExternalStore } from 'react';
import { GEO_HINT_SCRIPT } from './geoHint';

const noop = () => () => {};

/**
 * The geo hint's inline script (./geoHint.ts) in the server HTML only: it runs while the page
 * parses. Hydration renders it as the server did (getServerSnapshot); a client navigation mounts
 * nothing (a script React creates never runs, and React warns about it) — the location store is
 * already known by then.
 */
export function GeoHintScript() {
  const clientMount = useSyncExternalStore(noop, () => true, () => false);
  return clientMount ? null : <script dangerouslySetInnerHTML={{ __html: GEO_HINT_SCRIPT }} />;
}
