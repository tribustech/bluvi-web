import type { ComponentType, ReactNode } from 'react';

/*
 * The species glyphs of the Pești filter (lakes.filters.c3) — fish
 * features/lakes/components/FishGlyphs.tsx, ported 1:1: small coloured line art (24 viewBox, round
 * caps) built from six body archetypes with per-species palettes. Like the brand illustrations in
 * components/icons/brand.tsx, these are fixed artwork with their own palette (a carp is amber, a
 * trout pink in both themes), so their colours are not theme tokens. Species without an entry fall
 * back to the generic outline fish at the call site.
 * TODO(kit): move to components/icons when Partide's catch catalog needs them.
 */

export type FishGlyphProps = { size?: number };

type Archetype = 'deep' | 'torpedo' | 'pike' | 'catfish' | 'sturgeon' | 'bighead';

type SpeciesSpec = {
  archetype: Archetype;
  fill: string;
  stroke: string;
  finColor?: string;
  spots?: string;
  stripes?: boolean;
  spikyDorsal?: boolean;
  patch?: string;
  finlets?: string;
  lateral?: string;
  longWhiskers?: boolean;
};

const SW = 1.4;

type BodyProps = { size?: number; spec: SpeciesSpec };

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable="false" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function Dorsal({ stroke, spiky }: { stroke: string; spiky?: boolean }) {
  return spiky ? (
    <path d="M8.8 7.9 L9.6 5.7 L10.4 7.6 L11.2 5.8 L12 7.5 L12.8 6 L13.6 7.5" stroke={stroke} strokeWidth={SW} />
  ) : (
    <path d="M9.4 7.7 L10.9 5.4 L13.4 7.3" stroke={stroke} strokeWidth={SW} />
  );
}

function Tail({ stroke }: { stroke: string }) {
  return <path d="M19 12 L22.4 9.5 M19 12 L22.4 14.5" stroke={stroke} strokeWidth={SW} />;
}

/** Deep-bodied cyprinid (carp family): humped back, blunt head. */
function DeepBody({ size = 18, spec }: BodyProps) {
  return (
    <Svg size={size}>
      <path
        d="M4 12.2 C5.5 8.6 9 6.9 12.5 7.4 C15.8 7.9 18 9.7 19 12 C18 14.3 15.8 16.1 12.5 16.6 C9 17.1 5.5 15.6 4 12.2 Z"
        fill={spec.fill}
        stroke={spec.stroke}
        strokeWidth={SW}
      />
      {spec.patch ? <path d="M9 8.4 C10.5 7.2 13 7.2 14.6 8.3 C13.6 9.9 10.4 10.1 9 8.4 Z" fill={spec.patch} /> : null}
      <Dorsal stroke={spec.stroke} spiky={spec.spikyDorsal} />
      <Tail stroke={spec.stroke} />
      <path d="M8.2 9.3 C9.1 11 9.1 13.4 8.2 15.1" stroke={spec.stroke} strokeWidth={SW} />
      {spec.stripes ? (
        <path d="M11 8.2 C11.4 10.5 11.4 13.6 11 15.9 M14 8.4 C14.4 10.4 14.4 13.4 14 15.5" stroke={spec.stroke} strokeWidth={SW * 0.85} />
      ) : null}
      {spec.finColor ? <path d="M10.8 16.6 L11.8 18.3 M14 16.3 L15 17.9" stroke={spec.finColor} strokeWidth={SW} /> : null}
      <circle cx="6.2" cy="11.1" r="0.9" fill={spec.stroke} />
    </Svg>
  );
}

/** Slim streamlined body (asp, chub, grass carp, tuna, trout). */
function Torpedo({ size = 18, spec }: BodyProps) {
  return (
    <Svg size={size}>
      <path
        d="M2.8 12 C5 9.8 9.5 8.8 13.5 9.2 C16.5 9.5 18.6 10.6 19.4 12 C18.6 13.4 16.5 14.5 13.5 14.8 C9.5 15.2 5 14.2 2.8 12 Z"
        fill={spec.fill}
        stroke={spec.stroke}
        strokeWidth={SW}
      />
      <path d="M12.3 9.3 L13.5 7.4 L15.1 9.5" stroke={spec.stroke} strokeWidth={SW} />
      <path d="M19.4 12 L22.5 9.7 M19.4 12 L22.5 14.3" stroke={spec.stroke} strokeWidth={SW} />
      {spec.finlets ? (
        <path d="M16.6 9.9 L17.3 9 M17.9 10.1 L18.6 9.2 M16.9 14.1 L17.6 15 M18.1 13.9 L18.8 14.8" stroke={spec.finlets} strokeWidth={SW} />
      ) : null}
      {spec.lateral ? <path d="M6 12.1 C9.5 11.6 14 11.6 17 12" stroke={spec.lateral} strokeWidth={SW} /> : null}
      {spec.spots ? (
        <>
          <circle cx="9" cy="10.8" r="0.55" fill={spec.spots} />
          <circle cx="12" cy="10.4" r="0.55" fill={spec.spots} />
          <circle cx="14.8" cy="10.9" r="0.55" fill={spec.spots} />
        </>
      ) : null}
      <circle cx="5.7" cy="11.3" r="0.85" fill={spec.stroke} />
    </Svg>
  );
}

/** Long predator with a duckbill snout (pike) or spiky dorsal (zander). */
function Pike({ size = 18, spec }: BodyProps) {
  return (
    <Svg size={size}>
      <path
        d="M1.8 12 C4.5 10.4 9.5 9.4 14.5 9.9 C17.2 10.2 18.8 10.9 19.5 12 C18.8 13.1 17.2 13.8 14.5 14.1 C9.5 14.6 4.5 13.6 1.8 12 Z"
        fill={spec.fill}
        stroke={spec.stroke}
        strokeWidth={SW}
      />
      <path d="M1.8 12 L5.2 12.5" stroke={spec.stroke} strokeWidth={SW} />
      {spec.spikyDorsal ? (
        <path d="M12.5 9.8 L13.2 7.9 L13.9 9.6 L14.6 8 L15.3 9.7 L16 8.2 L16.7 9.9" stroke={spec.stroke} strokeWidth={SW} />
      ) : (
        <path d="M15 9.95 L16.2 7.8 L17.8 10.3" stroke={spec.stroke} strokeWidth={SW} />
      )}
      <path d="M19.5 12 L22.6 9.7 M19.5 12 L22.6 14.3" stroke={spec.stroke} strokeWidth={SW} />
      <circle cx="5.6" cy="11.1" r="0.85" fill={spec.stroke} />
    </Svg>
  );
}

/** Broad flat head + whiskers, tapering body (som, clarias). */
function Catfish({ size = 18, spec }: BodyProps) {
  const whisker = spec.longWhiskers ? 'M3.6 10.6 L0.6 8.6 M3.6 13.4 L0.6 15.4' : 'M3.6 10.6 L1.2 9.2 M3.6 13.4 L1.2 14.8';
  return (
    <Svg size={size}>
      <path
        d="M3 12 C3.5 9.4 6 8.1 9 8.3 C13 8.6 16.5 10 19 12 C16.5 14 13 15.4 9 15.7 C6 15.9 3.5 14.6 3 12 Z"
        fill={spec.fill}
        stroke={spec.stroke}
        strokeWidth={SW}
      />
      <path d={whisker} stroke={spec.stroke} strokeWidth={SW} />
      {spec.longWhiskers ? <path d="M6 9.1 C10 8.5 13.5 8.9 16.8 10.4" stroke={spec.stroke} strokeWidth={SW * 0.85} /> : null}
      <path d="M19 12 L22.2 10 M19 12 L22.2 14" stroke={spec.stroke} strokeWidth={SW} />
      <circle cx="6.3" cy="10.8" r="0.9" fill={spec.stroke} />
    </Svg>
  );
}

/** Sturgeon: pointed rostrum, back scutes, asymmetric tail. */
function Sturgeon({ size = 18, spec }: BodyProps) {
  return (
    <Svg size={size}>
      <path
        d="M2.2 12.3 C5 10.5 10 9.6 14.5 10.1 C17 10.4 19 11.2 19.8 12.2 C19 13.2 17 13.9 14.5 14.1 C10 14.5 5 13.8 2.2 12.3 Z"
        fill={spec.fill}
        stroke={spec.stroke}
        strokeWidth={SW}
      />
      <path d="M4.6 12.8 L4.6 14.1 M5.7 12.9 L5.7 14.2" stroke={spec.stroke} strokeWidth={SW * 0.85} />
      <path d="M7.5 10.3 L8.2 9.6 M10.2 10 L10.9 9.3 M12.9 9.9 L13.6 9.2 M15.6 10.1 L16.3 9.4" stroke={spec.stroke} strokeWidth={SW * 0.85} />
      <path d="M19.8 12.2 L22.9 9.4 M19.8 12.2 L21.9 13.9" stroke={spec.stroke} strokeWidth={SW} />
      <circle cx="6.4" cy="11.4" r="0.8" fill={spec.stroke} />
    </Svg>
  );
}

/** Silver/bighead carp: oversized head, eye set low below the mouth line. */
function BigHead({ size = 18, spec }: BodyProps) {
  return (
    <Svg size={size}>
      <path
        d="M3.4 12 C4.2 9 7.5 7.4 11.5 7.6 C15.2 7.8 17.9 9.6 19 12 C17.9 14.4 15.2 16.2 11.5 16.4 C7.5 16.6 4.2 15 3.4 12 Z"
        fill={spec.fill}
        stroke={spec.stroke}
        strokeWidth={SW}
      />
      <path d="M9.8 8.2 C11 10 11 14 9.8 15.8" stroke={spec.stroke} strokeWidth={SW} />
      <path d="M11.5 7.6 L12.8 5.6 L14.8 7.9" stroke={spec.stroke} strokeWidth={SW} />
      <Tail stroke={spec.stroke} />
      <circle cx="5.6" cy="13" r="0.9" fill={spec.stroke} />
    </Svg>
  );
}

const ARCHETYPES: Record<Archetype, ComponentType<BodyProps>> = {
  deep: DeepBody,
  torpedo: Torpedo,
  pike: Pike,
  catfish: Catfish,
  sturgeon: Sturgeon,
  bighead: BigHead,
};

// Keys are diacritic-stripped lowercase species names (see fishGlyphSpecies).
const SPECIES: Record<string, SpeciesSpec> = {
  crap: { archetype: 'deep', fill: '#FDE68A', stroke: '#B45309' },
  caras: { archetype: 'deep', fill: '#E5E7EB', stroke: '#6B7280' },
  'caras auriu': { archetype: 'deep', fill: '#FED7AA', stroke: '#EA580C' },
  koi: { archetype: 'deep', fill: '#FFF7ED', stroke: '#F97316', patch: '#FB923C' },
  buffalo: { archetype: 'deep', fill: '#CBD5E1', stroke: '#475569' },
  platica: { archetype: 'deep', fill: '#E2E8F0', stroke: '#64748B' },
  lin: { archetype: 'deep', fill: '#D9F99D', stroke: '#3F6212' },
  babusca: { archetype: 'deep', fill: '#F3F4F6', stroke: '#9CA3AF', finColor: '#DC2626' },
  rosioara: { archetype: 'deep', fill: '#F3F4F6', stroke: '#6B7280', finColor: '#B91C1C' },
  biban: { archetype: 'deep', fill: '#DCFCE7', stroke: '#166534', stripes: true, spikyDorsal: true, finColor: '#F97316' },
  scoicar: { archetype: 'deep', fill: '#9CA3AF', stroke: '#111827' },
  cteno: { archetype: 'torpedo', fill: '#D9F99D', stroke: '#65A30D' },
  avat: { archetype: 'torpedo', fill: '#DBEAFE', stroke: '#2563EB' },
  clean: { archetype: 'torpedo', fill: '#DCFCE7', stroke: '#16A34A' },
  ton: { archetype: 'torpedo', fill: '#BFDBFE', stroke: '#1E3A8A', finlets: '#FACC15' },
  pastrav: { archetype: 'torpedo', fill: '#FCE7F3', stroke: '#DB2777', spots: '#9D174D', lateral: '#F472B6' },
  stiuca: { archetype: 'pike', fill: '#ECFCCB', stroke: '#65A30D' },
  salau: { archetype: 'pike', fill: '#E7E5E4', stroke: '#57534E', spikyDorsal: true },
  somn: { archetype: 'catfish', fill: '#E2E8F0', stroke: '#475569' },
  'somn clarias': { archetype: 'catfish', fill: '#D1D5DB', stroke: '#1F2937', longWhiskers: true },
  sturion: { archetype: 'sturgeon', fill: '#E5E7EB', stroke: '#4B5563' },
  fitofag: { archetype: 'bighead', fill: '#F1F5F9', stroke: '#64748B' },
  novac: { archetype: 'bighead', fill: '#E2E8F0', stroke: '#334155' },
};

/** The glyph key of a species name (fish getFishGlyph: trimmed, lowercase, no diacritics). */
export function fishGlyphKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * The species glyph for `name`, or null (the caller draws the generic fish). `mono`: the same
 * silhouette as line art in currentColor at 1.5 (no fill, no coloured fins or spots) — for a row of
 * monochrome UI icons (the /balti category bar), where the coloured artwork would read as a
 * selected state. The coloured artwork stays for species chips and cards.
 */
export function FishGlyph({ name, size = 18, mono = false }: { name: string; size?: number; mono?: boolean }) {
  const key = fishGlyphKey(name);
  const spec = SPECIES[key];
  if (!spec) return null;
  const Body = ARCHETYPES[spec.archetype];
  const drawn: SpeciesSpec = mono
    ? {
        archetype: spec.archetype,
        fill: 'none',
        stroke: 'currentColor',
        stripes: spec.stripes,
        spikyDorsal: spec.spikyDorsal,
        longWhiskers: spec.longWhiskers,
      }
    : spec;
  return (
    <span
      data-fish-glyph={key}
      data-mono={mono ? '' : undefined}
      // CSS beats the paths' strokeWidth attributes: one 1.5 line, as the outline icons beside it.
      className={mono ? 'inline-flex shrink-0 [&_path]:[stroke-width:1.5]' : 'inline-flex shrink-0'}
    >
      <Body size={size} spec={drawn} />
    </span>
  );
}

export function hasFishGlyph(name: string): boolean {
  return fishGlyphKey(name) in SPECIES;
}
