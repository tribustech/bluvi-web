'use client';

import { useParams } from 'next/navigation';
import { routes } from '@/lib/routes';

/**
 * A subpage's way back while it has no data yet (its route skeleton, its error card): the water's
 * own page from the route param — the same target the loaded page's back control falls back to,
 * never the public-waters map.
 */
export function useWaterBackHref(): string {
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? decodeURIComponent(params.id) : '';
  return id ? routes.publicWater(id) : routes.publicWaters();
}
