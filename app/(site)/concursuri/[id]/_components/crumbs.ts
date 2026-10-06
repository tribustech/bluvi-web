import type { Crumb } from '@/components/nav/Breadcrumbs';
import { routes } from '@/lib/routes';

/**
 * The competition page's parent crumb: «Competiții» → /concursuri, the section the top bar marks
 * as current on this page (components/nav/items.ts navKeyForPath) — the band, the top bar and the
 * BreadcrumbList JSON-LD give one answer to «where does this page live». /concursuri is an interim
 * «în curând» page until the competitions list ships (M1) and points on to Acasă. The page renders
 * its own band on the server (SiteHeader ownsBreadcrumbBand): CompetitionRoute with the title and
 * the JSON-LD, loading.tsx with a placeholder, error.tsx with «Eroare».
 */
export const COMPETITIONS_CRUMB: Crumb = { label: 'Competiții', href: routes.competitions() };
