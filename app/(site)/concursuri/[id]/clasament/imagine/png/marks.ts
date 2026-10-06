import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { LogoHorizontal } from '@/components/nav/brand';

/*
 * The marks the image draws, taken from the kit so the artwork exists once: the Bluvi logo
 * (components/nav/brand.tsx LogoHorizontal, its paths read off the element it renders — Satori
 * draws inline <svg> children, not components or fragments) and the winner's trophy (Heroicons 20
 * solid TrophyIcon, the mark the competition page's PlaceCell uses).
 */

type PathProps = { d?: string; fillRule?: string };

function paths(node: ReactNode, out: { d: string; evenodd: boolean }[] = []) {
  Children.forEach(node, child => {
    if (!isValidElement(child)) return;
    const el = child as ReactElement<PathProps & { children?: ReactNode }>;
    if (el.type === 'path' && el.props.d) out.push({ d: el.props.d, evenodd: el.props.fillRule === 'evenodd' });
    else paths(el.props.children, out);
  });
  return out;
}

const logo = LogoHorizontal({}) as ReactElement<{ viewBox: string; children?: ReactNode }>;

export const LOGO_VIEWBOX = logo.props.viewBox;
export const LOGO_PATHS = paths(logo.props.children);

/** @heroicons/react 20/solid TrophyIcon (MIT). */
export const TROPHY_PATH =
  'M10 1c-1.828 0-3.623.149-5.371.435a.75.75 0 0 0-.629.74v.387c-.827.157-1.642.345-2.445.564a.75.75 0 0 0-.552.698 5 5 0 0 0 4.503 5.152 6 6 0 0 0 2.946 1.822A6.451 6.451 0 0 1 7.768 13H7.5A1.5 1.5 0 0 0 6 14.5V17h-.75C4.56 17 4 17.56 4 18.25c0 .414.336.75.75.75h10.5a.75.75 0 0 0 .75-.75c0-.69-.56-1.25-1.25-1.25H14v-2.5a1.5 1.5 0 0 0-1.5-1.5h-.268a6.453 6.453 0 0 1-.684-2.202 6 6 0 0 0 2.946-1.822 5 5 0 0 0 4.503-5.152.75.75 0 0 0-.552-.698A31.804 31.804 0 0 0 16 2.562v-.387a.75.75 0 0 0-.629-.74A33.227 33.227 0 0 0 10 1ZM2.525 4.422C3.012 4.3 3.504 4.19 4 4.09V5c0 .74.134 1.448.38 2.103a3.503 3.503 0 0 1-1.855-2.68Zm14.95 0a3.503 3.503 0 0 1-1.854 2.68C15.866 6.449 16 5.74 16 5v-.91c.496.099.988.21 1.475.332Z';
