"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { resolveMediaUrl, cn } from "@/lib/utils";
import type { ImageInfo } from "@/types";

export function ImageCarousel({ images }: { images: ImageInfo[] }) {
  const [current, setCurrent] = useState(0);

  if (!images.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
        <ImageIcon className="h-20 w-20 text-gray-2" />
      </div>
    );
  }

  const prev = () => setCurrent((c) => (c === 0 ? images.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c === images.length - 1 ? 0 : c + 1));

  return (
    <div className="space-y-3">
      <div className="group relative overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
        <div className="relative aspect-[16/9] w-full">
          <Image
            src={resolveMediaUrl(images[current].url) || "/logo.svg"}
            alt={images[current].alternativeText || "Imagine"}
            fill
            className="object-cover transition-opacity duration-300"
            sizes="(max-width: 768px) 100vw, 60vw"
            priority={current === 0}
          />
        </div>
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 opacity-0 shadow-card backdrop-blur-sm transition group-hover:opacity-100"
              aria-label="Imaginea anterioara"
            >
              <ChevronLeft className="h-5 w-5 text-gray-7" />
            </button>
            <button
              onClick={next}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 p-2 opacity-0 shadow-card backdrop-blur-sm transition group-hover:opacity-100"
              aria-label="Imaginea urmatoare"
            >
              <ChevronRight className="h-5 w-5 text-gray-7" />
            </button>
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    "h-2 rounded-full transition-all",
                    i === current ? "w-6 bg-white" : "w-2 bg-white/50",
                  )}
                  aria-label={`Imaginea ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.documentId || i}
              onClick={() => setCurrent(i)}
              className={cn(
                "relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-card transition",
                i === current ? "shadow-[0_0_0_2px_#6366F1]" : "opacity-60 hover:opacity-100",
              )}
            >
              <Image
                src={resolveMediaUrl(img.url) || "/logo.svg"}
                alt={img.alternativeText || "Thumbnail"}
                fill
                className="object-cover"
                sizes="96px"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
