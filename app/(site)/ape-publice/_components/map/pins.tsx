'use client';

import { T2Spinner } from '@/components/templates/T2';
import { cn } from '@/components/ui/cn';
import { LakeIcon, RiverIcon } from '../icons';

/**
 * fish PublicWaterClusters SinglePin: one water as a round icon pin (waves for a river, a droplet
 * for a lake) — never a «1» badge. Selected: the amber of the selection highlight
 * (SelectedWaterPinMarker), raised, so the water stays findable when zoomed out. A real button
 * with a 44px target; the pin sits centred on the water's centroid.
 */
export function WaterPin({
  id,
  kind,
  label,
  selected = false,
  busy = false,
  onClick,
}: {
  id: number;
  kind: 'river' | 'lake';
  label: string;
  selected?: boolean;
  /** Its record is loading after a tap: the glyph turns into the spinner. */
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-water-pin={id}
      aria-label={label}
      aria-pressed={selected}
      aria-busy={busy || undefined}
      onClick={(e) => {
        // The map's own click handler must not also run for this tap.
        e.stopPropagation();
        onClick();
      }}
      className="group flex size-11 cursor-pointer items-center justify-center outline-none"
    >
      <span
        className={cn(
          'flex size-7 items-center justify-center rounded-full border-2 border-surface text-on-accent shadow-e2 transition-transform duration-(--duration-fast) ease-select group-hover:scale-110',
          'group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent',
          selected ? 'scale-125 bg-rating text-ink' : 'bg-accent-ink',
        )}
      >
        {busy ? (
          <T2Spinner className="size-3.5" />
        ) : kind === 'river' ? (
          <RiverIcon className="size-3.5" strokeWidth={2.4} />
        ) : (
          <LakeIcon className="size-3.25" />
        )}
      </span>
    </button>
  );
}
