import Image from "next/image";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import type { Competition } from "@/types";
import { Badge } from "@/components/ui/badge";
import { formatDate, resolveMediaUrl } from "@/lib/utils";

const statusMap: Record<string, { label: string; variant: "indigo" | "green" | "gray" | "yellow" }> = {
  notStarted: { label: "Urmeaza", variant: "indigo" },
  started: { label: "Live", variant: "green" },
  completed: { label: "Finalizata", variant: "gray" },
  draft: { label: "Draft", variant: "yellow" },
};

export function CompetitionCard({ competition }: { competition: Competition }) {
  const image = resolveMediaUrl(competition.banner?.url) || "/logo.svg";
  const status = statusMap[competition.competitionStatus] || { label: competition.competitionStatus, variant: "gray" as const };

  return (
    <Link href={`/competitions/${competition.documentId}`}>
      <div className="overflow-hidden rounded-card bg-white shadow-[0_5px_15px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0_8px_25px_rgba(0,0,0,0.12)]">
        <div className="relative h-[200px] w-full">
          <Image src={image} alt={competition.name} fill className="object-cover" />
        </div>

        <div className="card-image-overlap px-4 pb-4">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-5">
            {formatDate(competition.startDate)} - {formatDate(competition.endDate)}
          </p>

          <h3 className="mt-1 text-lg font-bold text-gray-7">{competition.name}</h3>

          <div className="mt-1 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-indigo-5" />
            <span className="text-sm text-gray-5">{competition.lake?.name ?? "Locatie in curs"}</span>
          </div>

          <div className="separator my-3" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-gray-5">
                <Users className="h-3.5 w-3.5 text-indigo-5" />
                <span>
                  {competition.participantsRegistered ?? 0}/{competition.participantsLimit ?? "-"}
                </span>
              </div>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-lg font-bold text-gray-7">{competition.registerFee} lei</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
