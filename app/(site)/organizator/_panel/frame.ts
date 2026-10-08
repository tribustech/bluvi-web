import { UNDER_BAR_TOP } from '@/components/nav/shell';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/* The panel's layout constants, shared by the screen (client) and its skeleton / error frame (server). */

export const PANEL_TITLE = 'Panou organizator';
/** From 768 the breadcrumb band: «Acasă / Administrare / Panou organizator» (Administrare is the top bar's menu, not a page). */
export const PANEL_TRAIL = [{ label: 'Acasă', href: routes.home() }, { label: 'Administrare' }, { label: PANEL_TITLE }];
/** The pinned band (owner rule 3: attached to the top edge, under the bar — never floating). */
export const BAND = cn('sticky z-sticky -mx-4 bg-page px-4 md:-mx-6 md:px-6 xl:-mx-8 xl:px-8', UNDER_BAR_TOP);
/** The card grid: two columns on a phone (fish), auto-filling ~224px columns from 768 (owner rule 5). */
export const GRID = 'grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fill,minmax(--spacing(56),1fr))] xl:gap-4';
