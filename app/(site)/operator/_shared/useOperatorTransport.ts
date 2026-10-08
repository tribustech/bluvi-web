'use client';

import { useMemo } from 'react';
import type { Transport } from '@/core/transport';
import { createBrowserTransport } from '@/lib/client/transport';

/**
 * One browser transport per operator screen, always through the same-origin proxy (/api/cms with the
 * httpOnly JWT): every operator read is per owner (/feed/owned-lakes*, operator-stats, the inbox) —
 * never the CDN, never cached (direct: false even for GETs).
 */
export function useOperatorTransport(): Transport {
  return useMemo(() => createBrowserTransport({ direct: false }), []);
}
