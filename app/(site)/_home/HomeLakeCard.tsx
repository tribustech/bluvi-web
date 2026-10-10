import { createElement } from 'react';
import Image from 'next/image';
import { StarIcon } from '@heroicons/react/20/solid';
import { getLakeLocationSubtitle, type LakeCard } from '@/core/lakes';
import { CardShell, CardTitle, formatDecimal, Pill } from '@/components/cards';
import { routes } from '@/lib/routes';
import { cn } from '@/components/ui/cn';
import { facilityIcon } from './facilityIcon';

/** fish constants/lakeIconColors FACILITY_ICON_COLORS (blue, cyan, green, amber, red, violet) as the nearest tokens. */
const FACILITY_TONES = ['text-bait-2', 'text-bait-5', 'text-bait-3', 'text-yellow-6', 'text-bait-1', 'text-bait-6'];

// The third line names at most two facilities (or species), then «+N».
const MAX_NAMED = 2;

/**
 * The skeleton's height per breakpoint (photo 100 + name + place + the fact line; the type steps
 * grow from 1280). The card itself sizes to its content — every card carries the same three lines.
 */
export const LAKE_CARD_HEIGHT = 'h-44 md:h-47 xl:h-48.5';

/** «Pontoane · Toaletă +2»: the first names, then how many more. */
function named(names: string[]) {
  const shown = names.slice(0, MAX_NAMED).join(' · ');
  const more = names.length - MAX_NAMED;
  return more > 0 ? `${shown} +${more}` : shown;
}

/**
 * fish components/MiniatureLakeCard.tsx as Acasă configures it (lakesHomeCardPresentation: the
 * rating as a badge on the photo, only when the lake has reviews; the facilities). The kit LakeCard
 * has no facilities and shows price instead, so the home variant is composed here from the kit
 * shell and its photo Pill.
 *
 * Web difference: fish's row of up to four bare facility glyphs read as decoration (no label), and
 * a lake without facilities ended in a blank band. Every card now ends on the same kind of line, a
 * labelled fact (owner rule 5, ROADMAP §4b: no empty footer space): the facilities by name with the
 * first one's glyph («Pontoane · Toaletă +2»), else the species («Crap · Caras +2»), else the regime.
 * A lake with none of them ends on its place (the card is sized to its content, never padded).
 */
export function HomeLakeCard({ lake }: { lake: LakeCard }) {
  const image = lake.images[0];
  const src = image ? (image.mediumUrl ?? image.url) : null;
  const location = getLakeLocationSubtitle(
    { county: lake.county, countyRef: lake.countyRef ?? null, cityRef: lake.cityRef ?? null },
    { includeAddress: false }
  );
  const hasReviews = !!lake.reviewsMeta && lake.reviewsMeta.count > 0;
  const facilities = lake.facility.map((f) => f.name);
  const species = lake.fishSpecies.map((s) => s.fish.Name);
  const fact =
    facilities.length > 0
      ? { label: 'Facilități', text: named(facilities) }
      : species.length > 0
        ? { label: 'Specii', text: named(species) }
        : lake.regime
          ? { label: 'Regim', text: lake.regime }
          : null;

  return (
    <CardShell
      elevated
      interactive
      // Phone: fish's home presentation (recent_viewed + facilities) — no card surface, the photo
      // rounded 24 and lifted, the text flush under it (ROADMAP §4b rule 25).
      className="w-full max-md:overflow-visible max-md:rounded-none max-md:bg-transparent max-md:shadow-none max-md:hover:shadow-none max-md:focus-within:shadow-none"
    >
      <div className="relative h-26.5 shrink-0 overflow-hidden bg-soft-fill max-md:rounded-3xl max-md:shadow-e1 md:h-25">
        {src ? <Image src={src} alt="" fill sizes="(min-width: 1280px) 300px, (min-width: 768px) 272px, 200px" className="object-cover" /> : null}
        {hasReviews ? (
          // fish: the white rating badge, top-right on the photo.
          <Pill tone="light" className="absolute top-2 right-2 shadow-e1">
            <StarIcon aria-hidden className="size-3.5 text-rating" />
            <span className="sr-only">Rating </span>
            {formatDecimal(lake.reviewsMeta!.overall ?? 0, 1, 1)}
          </Pill>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 px-px pt-2 md:p-2.5">
        <div>
          <CardTitle href={routes.lake(lake.documentId)} className="line-clamp-1 t-body-strong text-ink max-md:line-clamp-4 max-md:t-heading">
            {lake.name}
          </CardTitle>
          {location ? <p className="line-clamp-1 t-body text-muted md:text-ink-2">{location}</p> : null}
        </div>
        {/* Phone: fish's bare facility glyphs (20px cells, 13px icons, fish's colour cycle), at most four, then «+N». */}
        {facilities.length > 0 ? (
          <ul aria-label="Facilități" className="flex items-center gap-1 md:hidden">
            {facilities.slice(0, 4).map((name, i) => (
              <li key={`${name}-${i}`} className="flex size-5 items-center justify-center">
                {createElement(facilityIcon(name), { 'aria-hidden': true, className: cn('size-3.25', FACILITY_TONES[i % FACILITY_TONES.length]) })}
                <span className="sr-only">{name}</span>
              </li>
            ))}
            {facilities.length > 4 ? <li className="t-micro text-ink-2">+{facilities.length - 4}</li> : null}
          </ul>
        ) : null}
        {fact ? (
          <p className="flex min-w-0 items-center gap-1.5 t-caption text-muted max-md:hidden">
            {/* The first facility's glyph (fish getFacilityIcon), beside its name. */}
            {facilities[0] ? createElement(facilityIcon(facilities[0]), { 'aria-hidden': true, className: 'size-4 shrink-0 text-accent-ink' }) : null}
            <span className="sr-only">{fact.label}: </span>
            <span className="truncate">{fact.text}</span>
          </p>
        ) : null}
      </div>
    </CardShell>
  );
}
