'use client';

import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MapPinIcon } from '@heroicons/react/24/solid';
import { MapIcon } from '@heroicons/react/24/outline';
import { loadMaplibre } from '@/components/templates/T2/maplibre';
import { T2_MAP_STYLE } from '@/components/templates/T2/T2Map';
import { cn } from '@/components/ui/cn';

/*
 * fish LakeContactSection's static mini map (150px, liteMode, a marker, every gesture off): the
 * whole tile opens the lake's map page (parity lakes.detail.c28) — once that page is on the web
 * (`href`); until then the tile is a picture of where the lake is, not a control. MapLibre loads only when the
 * tile nears the viewport — the contact section is at the end of the page. Without WebGL or the
 * style host the tile stays a pin on the soft fill, still a link to the map page.
 */

export function MiniMap({
  lat,
  lng,
  href,
  name,
  tile = false,
}: {
  lat: number;
  lng: number;
  href?: string;
  name: string;
  /** A tile of the photo grid (beside a lone lake photo, from 768): its box's height, square corners (the grid rounds). */
  tile?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let map: { remove: () => void } | null = null;
    let cancelled = false;
    const start = async () => {
      try {
        const lib = await loadMaplibre();
        if (cancelled) return;
        const m = new lib.Map({
          container: el,
          style: T2_MAP_STYLE,
          center: [lng, lat],
          zoom: 13,
          interactive: false,
          attributionControl: false,
        });
        map = m;
        new lib.Marker({ color: getComputedStyle(el).getPropertyValue('--color-accent').trim() || undefined }).setLngLat([lng, lat]).addTo(m);
        m.once('load', () => !cancelled && setReady(true));
      } catch {
        // No WebGL / no style: the placeholder stays.
      }
    };
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          io.disconnect();
          void start();
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
      map?.remove();
    };
  }, [lat, lng]);

  const inner = (
    <>
      <div ref={box} aria-hidden className={cn('pointer-events-none absolute inset-0 transition-opacity duration-(--duration-slow)', ready ? 'opacity-100' : 'opacity-0')} />
      {!ready ? (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center text-accent">
          <MapPinIcon className="size-8" />
        </span>
      ) : null}
      {/* In the photo grid the whole tile is the link, and the grid's corner is «Vezi toate fotografiile»'s. */}
      {href && !tile ? (
        <span className="absolute right-2 bottom-2 inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-1 t-label text-ink shadow-e1 group-hover:bg-soft-fill">
          <MapIcon aria-hidden className="size-4" />
          Hartă
        </span>
      ) : null}
      <span className="absolute bottom-1 left-2 t-nano text-muted">© OpenStreetMap</span>
    </>
  );
  const BOX = cn('group relative block overflow-hidden bg-soft-fill', tile ? 'h-full' : 'h-37.5 rounded-control md:h-48');
  const testId = tile ? 'lake-hero-map' : 'lake-mini-map';
  return href ? (
    <Link href={href} aria-label={`Deschide harta: ${name}`} className={BOX} data-testid={testId}>
      {inner}
    </Link>
  ) : (
    <div className={BOX} data-testid={testId}>
      {inner}
    </div>
  );
}
