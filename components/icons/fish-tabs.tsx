import type { SVGProps } from 'react';

/*
 * The fish app's bottom-tab icons (fish app/(app)/(tabs)/_layout.tsx), ported path for path from
 * the packages fish renders them with, so the web tab bar draws the same glyphs:
 *  - Acasă, Bălți, Competiții: react-native-heroicons 4.0.0 /outline HomeIcon, MapIcon, TrophyIcon
 *    (24 viewBox, stroke 1.5, round caps and joins);
 *  - Partide: lucide-react-native 1.17.0 FishIcon, drawn by fish with strokeWidth={1.8}.
 * Stroke is currentColor: the tab's text colour (active accent / inactive muted) colours the glyph.
 * Decorative (aria-hidden): the tab's label names it.
 */
type Props = Omit<SVGProps<SVGSVGElement>, 'children'> & { size?: number };

function outline(displayName: string, strokeWidth: number, paths: string[]) {
  function TabIcon({ size = 24, ...props }: Props) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
        focusable="false"
        {...props}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    );
  }
  TabIcon.displayName = displayName;
  return TabIcon;
}

/** heroicons outline HomeIcon (Acasă). */
export const TabHomeIcon = outline('TabHomeIcon', 1.5, [
  'm2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
]);

/** heroicons outline MapIcon (Bălți). */
export const TabMapIcon = outline('TabMapIcon', 1.5, [
  'M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z',
]);

/** heroicons outline TrophyIcon (Competiții). */
export const TabTrophyIcon = outline('TabTrophyIcon', 1.5, [
  'M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-3.044 0',
]);

/** lucide FishIcon (Partide), stroke 1.8 as fish draws it. */
export const TabFishIcon = outline('TabFishIcon', 1.8, [
  'M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z',
  'M18 12v.5',
  'M16 17.93a9.77 9.77 0 0 1 0-11.86',
  'M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33',
  'M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4',
  'm16.01 17.93-.23 1.4A2 2 0 0 1 13.8 21H9.5a5.96 5.96 0 0 0 1.49-3.98',
]);
