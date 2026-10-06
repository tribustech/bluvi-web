"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

/**
 * Avatar's photo (./Avatar): the remote picture, or — when it fails to load (a dead CMS URL, a
 * 404) — the initials on their tone, never the browser's broken-image glyph. An error that fired
 * before hydration (onError was not attached yet) is caught on mount: a finished image with no
 * pixels is a failed one.
 */
export function AvatarPhoto({
  src,
  className,
  fallbackClassName,
  initials,
  a11y,
}: {
  src: string;
  className: string;
  /** The tone classes of the initials disc. */
  fallbackClassName: string;
  initials: string;
  a11y: { "aria-hidden": true } | { role: "img"; "aria-label": string };
}) {
  // The URL that failed (a new src is tried again).
  const [failed, setFailed] = useState<string | null>(null);
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = img.current;
    if (el && el.complete && el.naturalWidth === 0) setFailed(src);
  }, [src]);

  if (failed === src) {
    return (
      <span className={cn(className, fallbackClassName)} data-avatar-fallback="" {...a11y}>
        {initials}
      </span>
    );
  }
  return (
    <span className={cn(className, "bg-soft-fill")} {...a11y}>
      {/* Remote CMS photos at avatar size: the image optimizer buys nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={img}
        src={src}
        alt=""
        className="size-full object-cover"
        loading="lazy"
        decoding="async"
        onError={() => setFailed(src)}
      />
    </span>
  );
}
