import type { CompetitionSlugMap } from '@/lib/competition-slug-route';
import { cmsSlugMap } from './slug-map';

/**
 * The CMS's competition URL map (GET /feed/competitions/slugs: every non-draft competition's slug,
 * plus `aliases`, the earlier slugs of one renamed before its start) for proxy.ts, in memory five
 * minutes (slug-map.ts).
 */
export const getCompetitionSlugMap: () => Promise<CompetitionSlugMap> = cmsSlugMap('/feed/competitions/slugs');
