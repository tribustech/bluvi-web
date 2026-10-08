'use client';

import { MapPinIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import type { Coord } from './model';

/*
 * fish features/partide/components/AnchorMapPreview.tsx — the tappable satellite tile that shows
 * where the partidă starts (it replaced the raw «44.0849, 25.6696» line). Pressing anywhere opens
 * the full-screen adjust map (MapPointPicker); panning happens there, never here.
 *
 * Web: a static mosaic of satellite tiles (Esri World Imagery, the picker's own satellite source) —
 * no map engine for a picture: 5 × 3 tiles at zoom 17 (~180 m across a phone tile, fish DELTA
 * 0.0016) positioned so the anchor sits at the centre, under fish's green dot. Without an anchor:
 * a neutral «Se încarcă poziția…» tile while the lake's coordinates load, else the red dashed
 * «Fixează poziția pe hartă» prompt (fish: shown only once we KNOW there are none).
 */

const ZOOM = 17;
const TILE = 256;
const COLS = 5;
const ROWS = 3;
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

/** Web-Mercator tile coordinates (fractional) of a point at ZOOM. */
export function tileOf(c: Coord, zoom = ZOOM): { x: number; y: number } {
  const n = 2 ** zoom;
  const lat = (Math.max(-85, Math.min(85, c.lat)) * Math.PI) / 180;
  return {
    x: ((c.lng + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n,
  };
}

type Props = {
  anchor: Coord | null;
  /** The lake's coordinates are still loading — the neutral tile instead of the red prompt. */
  loading?: boolean;
  /** The venue's name, as a pill on the tile. */
  label?: string | null;
  /** Dimmed: the stand comes first, a press opens the stand list (fish opacity .45). */
  dimmed?: boolean;
  onPress: () => void;
  /** Tailwind height classes of the tile (fish 132). */
  heightClass?: string;
  testId?: string;
};

export function AnchorPreview({ anchor, loading = false, label, dimmed = false, onPress, heightClass = 'h-33', testId = 'anchor-preview' }: Props) {
  const base = cn(
    'group relative block w-full cursor-pointer overflow-hidden rounded-card text-left',
    'transition-[opacity,filter] duration-(--duration-fast) ease-fast active:opacity-85',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    heightClass,
  );

  if (!anchor) {
    return (
      <button
        type="button"
        onClick={onPress}
        data-testid={testId}
        data-state={loading ? 'loading' : 'missing'}
        aria-busy={loading || undefined}
        className={cn(
          base,
          'flex flex-col items-center justify-center gap-1.5 border bg-soft-fill',
          loading ? 'border-hairline' : 'border-dashed border-status-danger-fg/60 hover:bg-status-danger-bg/40',
        )}
      >
        {loading ? (
          <span className="t-caption text-muted">Se încarcă poziția…</span>
        ) : (
          <>
            <MapPinIcon aria-hidden className="size-6 text-status-danger-fg" />
            <span className="t-label text-status-danger-fg">Fixează poziția pe hartă</span>
          </>
        )}
      </button>
    );
  }

  const { x, y } = tileOf(anchor);
  const x0 = Math.floor(x) - Math.floor(COLS / 2);
  const y0 = Math.floor(y) - Math.floor(ROWS / 2);
  // The anchor's pixel inside the mosaic: the mosaic is shifted so it lands on the tile's centre.
  const offX = (x - x0) * TILE;
  const offY = (y - y0) * TILE;
  // Solid navy pills on the faded picture (AA on any ground), the photo scrim on the live one.
  const pill = dimmed ? 'bg-navy' : 'bg-photo-scrim';

  return (
    <button
      type="button"
      onClick={onPress}
      data-testid={testId}
      data-state={dimmed ? 'dimmed' : 'ready'}
      data-lat={anchor.lat.toFixed(5)}
      data-lng={anchor.lng.toFixed(5)}
      aria-label={dimmed ? 'Alege standul, apoi poți ajusta poziția pe hartă' : `Ajustează poziția pe hartă${label ? ` — ${label}` : ''}`}
      className={cn(base, dimmed ? 'bg-soft-fill' : 'bg-navy')}
    >
      <span
        aria-hidden
        // Dimmed (fish opacity .45): only the picture fades; the pills stay solid and legible.
        className={cn('pointer-events-none absolute grid grid-cols-5', dimmed && 'opacity-45')}
        style={{ left: `calc(50% - ${offX}px)`, top: `calc(50% - ${offY}px)`, width: COLS * TILE, height: ROWS * TILE }}
      >
        {Array.from({ length: ROWS }, (_, r) =>
          Array.from({ length: COLS }, (_, c) => (
            // eslint-disable-next-line @next/next/no-img-element -- raster map tiles, not content images
            <img
              key={`${r}-${c}`}
              src={`${ESRI}/${ZOOM}/${y0 + r}/${x0 + c}`}
              alt=""
              width={TILE}
              height={TILE}
              loading="lazy"
              decoding="async"
              draggable={false}
              // A tile that does not load (offline, blocked) leaves the navy ground, never a broken-image glyph.
              onError={e => {
                e.currentTarget.style.visibility = 'hidden';
              }}
              className="block size-64 max-w-none select-none"
            />
          )),
        )}
      </span>
      {/* fish's 14px green dot with a white ring, on the anchor. */}
      <span aria-hidden className={cn('pointer-events-none absolute top-1/2 left-1/2 size-3.5 -translate-1/2 rounded-full bg-success ring-2 ring-on-photo-scrim shadow-e1', dimmed && 'opacity-45')} />
      {label ? (
        <span aria-hidden className={cn('pointer-events-none absolute top-2.5 left-2.5 max-w-[80%] truncate rounded-full px-2.5 py-1 t-label text-on-photo-scrim', pill)}>
          {label}
        </span>
      ) : null}
      <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center">
        <span className={cn('rounded-full px-3 py-1.5 t-caption text-on-photo-scrim group-hover:underline', pill)}>
          {dimmed ? 'Alege mai întâi standul' : 'Apasă pentru a ajusta poziția'}
        </span>
      </span>
      <span aria-hidden className={cn('pointer-events-none absolute right-1.5 bottom-0.5 t-micro', dimmed ? 'text-ink-2' : 'text-on-photo-scrim/80')}>
        © Esri
      </span>
    </button>
  );
}
