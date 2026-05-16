import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPinned, Star } from "lucide-react";
import type { Lake } from "@/types";
import { Badge } from "@/components/ui/badge";
import { resolveMediaUrl } from "@/lib/utils";

export function LakeCard({ lake }: { lake: Lake }) {
  const image = resolveMediaUrl(lake.images?.[0]?.url) || "/logo.svg";

  return (
    <Link href={`/lakes/${lake.documentId}`}>
      <div className="overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_8px_25px_rgba(0,0,0,0.12)]">
        <div className="relative h-[200px] w-full">
          <Image src={image} alt={lake.name} fill className="object-cover" />
        </div>

        <div className="card-image-overlap px-4 pb-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <h3 className="text-lg font-bold text-gray-7">{lake.name}</h3>
              {lake.isVerified ? <BadgeCheck className="h-4 w-4 text-indigo-5" /> : null}
            </div>
            {lake.reviewsMeta?.averageRating ? (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-yellow-5 text-yellow-5" />
                <span className="text-sm font-bold text-gray-7">{lake.reviewsMeta.averageRating.toFixed(1)}</span>
              </div>
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <MapPinned className="h-3.5 w-3.5 text-indigo-5" />
            <span className="text-sm text-gray-5">{lake.address || lake.county || "Romania"}</span>
          </div>

          <div className="separator my-3" />

          <div className="flex flex-wrap gap-1.5">
            {lake.fishSpecies?.slice(0, 4).map((item, i) => (
              <Badge key={i} variant="indigo">
                {item.fish?.Name || "Specie"}
              </Badge>
            ))}
            {(lake.fishSpecies?.length ?? 0) > 4 ? <Badge variant="gray">+{(lake.fishSpecies?.length ?? 0) - 4}</Badge> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
