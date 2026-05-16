import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Banknote, Fish, MapPinned, Star } from "lucide-react";
import type { Lake } from "@/types";
import { Badge } from "@/components/ui/badge";
import { resolveMediaUrl } from "@/lib/utils";

const MAX_FACILITIES = 3;
const MAX_FISH_SPECIES = 3;

function getLocationLabel(lake: Lake): string {
  const city = lake.cityRef?.name?.trim() || null;
  const county = lake.countyRef?.name?.trim() || lake.county?.trim() || null;
  const parts = [city, county].filter(Boolean) as string[];
  if (parts.length) return parts.join(", ");
  return lake.address?.trim() || "Romania";
}

function getPriceLabel(lake: Lake): string | null {
  const prices = lake.price?.map((p) => p.price).filter((n): n is number => typeof n === "number" && n > 0);
  if (!prices?.length) return null;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? `${min} lei` : `${min}-${max} lei`;
}

export function LakeCard({ lake }: { lake: Lake }) {
  const image = resolveMediaUrl(lake.images?.[0]?.url) || "/logo.svg";
  const locationLabel = getLocationLabel(lake);
  const priceLabel = getPriceLabel(lake);
  const facilities = lake.facility?.slice(0, MAX_FACILITIES) ?? [];
  const extraFacilities = Math.max(0, (lake.facility?.length ?? 0) - MAX_FACILITIES);
  const fishSpecies = lake.fishSpecies?.slice(0, MAX_FISH_SPECIES) ?? [];
  const extraFishSpecies = Math.max(0, (lake.fishSpecies?.length ?? 0) - MAX_FISH_SPECIES);
  const rating = lake.reviewsMeta?.averageRating;

  return (
    <Link href={`/lakes/${lake.documentId}`} className="block">
      <div className="overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_8px_25px_rgba(0,0,0,0.12)]">
        <div className="relative h-[200px] w-full">
          <Image src={image} alt={lake.name} fill className="object-cover" />
          {rating ? (
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2 py-1 shadow-sm">
              <Star className="h-3.5 w-3.5 fill-yellow-5 text-yellow-5" />
              <span className="text-xs font-bold text-gray-7">{rating.toFixed(1)}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 px-4 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-base font-bold text-gray-7">{lake.name}</h3>
              {lake.isVerified ? <BadgeCheck className="h-4 w-4 text-indigo-5" /> : null}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-sm text-gray-5">
            <MapPinned className="h-3.5 w-3.5 text-indigo-5" />
            <span className="truncate">{locationLabel}</span>
          </div>

          {priceLabel ? (
            <div className="flex items-center gap-1.5 text-sm text-gray-7">
              <Banknote className="h-3.5 w-3.5 text-green-7" />
              <span className="font-bold">{priceLabel}</span>
            </div>
          ) : null}

          {facilities.length ? (
            <div className="flex flex-wrap gap-1.5">
              {facilities.map((facility) => (
                <Badge key={facility.documentId} variant="gray">
                  {facility.name}
                </Badge>
              ))}
              {extraFacilities > 0 ? <Badge variant="gray">+{extraFacilities}</Badge> : null}
            </div>
          ) : null}

          {fishSpecies.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Fish className="h-3.5 w-3.5 text-indigo-5" />
              {fishSpecies.map((item, i) => (
                <Badge key={item.documentId ?? i} variant="indigo">
                  {item.fish?.Name || "Specie"}
                </Badge>
              ))}
              {extraFishSpecies > 0 ? <Badge variant="indigo">+{extraFishSpecies}</Badge> : null}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
