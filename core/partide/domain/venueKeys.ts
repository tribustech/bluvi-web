/**
 * Community venue identity. fish `services/api/community.ts#communityVenueKey/#communityVenuePath`
 * and `features/partide/community/hooks.ts#venueSelectionKey`.
 * Key format mirrors the CMS's `venueKeyOf`: `lake:<documentId>` / `water:<publicWaterCode>`.
 */
export type CommunityVenueRef = { kind: 'lake'; id: string } | { kind: 'water'; code: string };

export function communityVenueKey(ref: CommunityVenueRef): string {
  return ref.kind === 'lake' ? `lake:${ref.id}` : `water:${ref.code}`;
}

export function communityVenuePath(ref: CommunityVenueRef): string {
  const collection = ref.kind === 'lake' ? 'lakes' : 'waters';
  const segment = ref.kind === 'lake' ? ref.id : ref.code;
  return `/feed/community/${collection}/${encodeURIComponent(segment)}`;
}

/**
 * Cache-key identity for a venue multi-select: 'all' for no selection, otherwise the SORTED keys
 * joined with '|' so ['b','a'] and ['a','b'] share one entry. Every distinct selection needs its
 * own entry now that the server narrows on all of them.
 */
export function venueSelectionKey(venueKeys: string[]): string {
  return venueKeys.length ? [...venueKeys].sort().join('|') : 'all';
}

/**
 * Serialises `venue` as REPEATED params (`venue=a&venue=b`), which is what the CMS's
 * `parseVenueKeys` reads. qs/axios defaults would emit brackets; the repeated form is the one the
 * server documents and tests — do not rely on the bracket form. Every other param passes through.
 */
export function venueParamsSerializer(params: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}
