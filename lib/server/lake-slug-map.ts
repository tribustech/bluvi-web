import type { LakeSlugMap } from '@/lib/lake-slug-route';
import { cmsSlugMap } from './slug-map';

/** The CMS's lake URL map (GET /feed/lakes/slugs) for proxy.ts, in memory five minutes (slug-map.ts). */
export const getLakeSlugMap: () => Promise<LakeSlugMap> = cmsSlugMap('/feed/lakes/slugs');
