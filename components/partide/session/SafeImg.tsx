'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

/*
 * A CMS photo that may be gone (a deleted S3 object): when it fails to load, `fallback` takes its
 * place — never the browser's broken-image glyph (as the kit AvatarPhoto / Lightbox do). A load
 * that failed before hydration (no onError then) is caught on mount.
 */
export function SafeImg({ src, className, fallback }: { src: string; className: string; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  if (failed) return <>{fallback}</>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={className} />;
}
