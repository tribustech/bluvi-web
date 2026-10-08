import type { SVGProps } from 'react';

/*
 * The fish glyphs (lucide) heroicons has no counterpart for, drawn as 24-grid outline icons with the
 * heroicons stroke (1.5, round) in currentColor, so they take the token colours. Paths after lucide
 * (ISC). The same drawing as app/(site)/balti/_list/icons.tsx.
 */

type Props = SVGProps<SVGSVGElement>;

function Outline({ children, ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

/** lucide Waves — a public water (fish VenueRow). */
export function WavesIcon(props: Props) {
  return (
    <Outline {...props}>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </Outline>
  );
}

/** lucide MapPinned — a pin dropped on the map (fish VenuePicker, VenueRow). */
export function MapPinnedIcon(props: Props) {
  return (
    <Outline {...props}>
      <path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0" />
      <circle cx="12" cy="8" r="2" />
      <path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712" />
    </Outline>
  );
}

/** lucide Navigation — the location permission card (fish LakesNearbyPermissionPlaceholder). */
export function NavigationIcon(props: Props) {
  return (
    <Outline {...props}>
      <path d="M3 11 22 2l-9 19-2-8-8-2Z" />
    </Outline>
  );
}

/** lucide LocateFixed — the retry card (fish NearbyLocationRetryCard). */
export function LocateFixedIcon(props: Props) {
  return (
    <Outline {...props}>
      <line x1="2" x2="5" y1="12" y2="12" />
      <line x1="19" x2="22" y1="12" y2="12" />
      <line x1="12" x2="12" y1="2" y2="5" />
      <line x1="12" x2="12" y1="19" y2="22" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
    </Outline>
  );
}
