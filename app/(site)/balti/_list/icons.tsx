import type { SVGProps } from 'react';

/*
 * The few fish glyphs (lucide) heroicons has no counterpart for, drawn as 24-grid outline icons
 * with the heroicons stroke (1.5, round), in currentColor — so they take the token colours.
 * Paths after lucide (ISC). TODO(kit): move to components/icons when another area needs them.
 */

type Props = SVGProps<SVGSVGElement>;

function Outline({ children, ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      {children}
    </svg>
  );
}

/** lucide Navigation — «În jurul meu», the location placeholder. */
export function NavigationIcon(props: Props) {
  return (
    <Outline {...props}>
      <path d="M3 11 22 2l-9 19-2-8-8-2Z" />
    </Outline>
  );
}

/** lucide Waves — a lake (search row, the all-lakes section). */
export function WavesIcon(props: Props) {
  return (
    <Outline {...props}>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </Outline>
  );
}

/** lucide Compass — the nearby section. */
export function CompassIcon(props: Props) {
  return (
    <Outline {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-1.8 5.4a2 2 0 0 1-1.28 1.28l-5.4 1.8 1.8-5.4a2 2 0 0 1 1.28-1.28z" />
    </Outline>
  );
}

/** lucide Telescope — any other section. */
export function TelescopeIcon(props: Props) {
  return (
    <Outline {...props}>
      <path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44" />
      <path d="m13.56 11.747 4.332-.924" />
      <path d="m16 21-3.105-6.21" />
      <path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z" />
      <path d="m6.158 8.633 1.114 4.456" />
      <path d="m8 21 3.105-6.21" />
      <circle cx="12" cy="13" r="2" />
    </Outline>
  );
}

/** lucide Repeat2 — the Regim chip. */
export function RepeatIcon(props: Props) {
  return (
    <Outline {...props}>
      <path d="m2 9 3-3 3 3" />
      <path d="M13 18H7a2 2 0 0 1-2-2V6" />
      <path d="m22 15-3 3-3-3" />
      <path d="M11 6h6a2 2 0 0 1 2 2v10" />
    </Outline>
  );
}

/** lucide Split — «Direcții». */
export function SplitIcon(props: Props) {
  return (
    <Outline {...props}>
      <path d="M16 3h5v5" />
      <path d="M8 3H3v5" />
      <path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" />
      <path d="m15 9 6-6" />
    </Outline>
  );
}
