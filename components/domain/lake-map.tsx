"use client";

import { MapPin } from "lucide-react";
import type { LakeCoordinates } from "@/types";

export function LakeMap({ coordinates, name }: { coordinates: LakeCoordinates; name: string }) {
  const lat = parseFloat(coordinates.lat);
  const lng = parseFloat(coordinates.long);

  if (isNaN(lat) || isNaN(lng)) return null;

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-indigo-5" />
        <h3 className="text-lg font-bold text-gray-7">Locatie</h3>
      </div>
      <div className="overflow-hidden rounded-card shadow-sm">
        <iframe
          title={`Harta ${name}`}
          src={embedUrl}
          className="h-64 w-full border-0 md:h-80"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="text-xs text-gray-5">
        Coordonate: {lat.toFixed(5)}, {lng.toFixed(5)}
      </p>
    </div>
  );
}
