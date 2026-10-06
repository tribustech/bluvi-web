import type { Crumb } from '@/components/nav/Breadcrumbs';
import { routes } from '@/lib/routes';

/** The parent crumb of an article (page, loading and error bands). */
export const NEWS_CRUMB: Crumb = { label: 'Noutăți', href: routes.news() };
/** The parent crumb of a sponsor page: the sponsors live on Acasă (fish has no sponsors page). */
export const HOME_CRUMB: Crumb = { label: 'Acasă', href: routes.home() };
