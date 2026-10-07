import { Children, isValidElement, type ForwardRefExoticComponent, type ReactElement, type ReactNode } from 'react';
import { CalendarDaysIcon, MapPinIcon, StarIcon } from '@heroicons/react/20/solid';
import { LOGO_PATHS, LOGO_VIEWBOX } from '@/app/(site)/concursuri/[id]/clasament/imagine/png/marks';
import type { MetaIcon } from './model';

/*
 * The marks the cards draw, taken from the kit so the artwork exists once. Satori draws inline
 * <svg> children, not components, so the paths are read off the elements the components render:
 *  - the Bluvi logo (components/nav/brand.tsx LogoHorizontal, read by the ranking image's marks.ts);
 *  - the fish alone (the logo's paths without the wordmark), the brand panel's watermark;
 *  - Heroicons 20 solid (the site's icon set): the meta lines' pin and calendar, the rating star.
 */

export type MarkPath = { d: string; evenodd: boolean };

export { LOGO_PATHS, LOGO_VIEWBOX };
/** The logo's width per unit of height. */
export const LOGO_RATIO = Number(LOGO_VIEWBOX.split(/\s+/)[2]) / Number(LOGO_VIEWBOX.split(/\s+/)[3]);

/** The fish: every path of the logo but the last one (the «bluvi» wordmark). */
export const FISH_PATHS: MarkPath[] = LOGO_PATHS.slice(0, -1);
/** The fish's own box inside the logo's artboard. */
export const FISH_VIEWBOX = '120 130 680 400';
/** The fish's height per unit of width. */
export const FISH_RATIO = 400 / 680;

function heroPaths(icon: ForwardRefExoticComponent<object>): MarkPath[] {
  const render = (icon as unknown as { render: (props: object, ref: null) => ReactElement<{ children?: ReactNode }> }).render;
  const out: MarkPath[] = [];
  Children.forEach(render({}, null).props.children, child => {
    if (!isValidElement(child)) return;
    const p = child.props as { d?: string; fillRule?: string };
    if (child.type === 'path' && p.d) out.push({ d: p.d, evenodd: p.fillRule === 'evenodd' });
  });
  return out;
}

const PIN = heroPaths(MapPinIcon as ForwardRefExoticComponent<object>);
const CALENDAR = heroPaths(CalendarDaysIcon as ForwardRefExoticComponent<object>);
export const STAR_PATHS = heroPaths(StarIcon as ForwardRefExoticComponent<object>);

/** The 20×20 paths of each meta line's icon. */
export const META_ICON: Record<MetaIcon, MarkPath[]> = {
  pin: PIN,
  lake: PIN,
  water: PIN,
  calendar: CALENDAR,
};
