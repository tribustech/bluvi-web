import type { Registration } from "@/types";
import { Badge } from "@/components/ui/badge";

const variantMap = {
  pending: "yellow",
  registered: "green",
  rejected: "red",
  cancelled: "gray",
} as const;

export function ParticipantsList({ registrations }: { registrations: Registration[] }) {
  if (!registrations.length) {
    return <div className="rounded-card border border-dashed border-gray-2 bg-white p-6 text-sm text-gray-5">Nu exista inscrieri momentan.</div>;
  }

  return (
    <div className="space-y-3">
      {registrations.map((registration) => (
        <div key={registration.documentId} className="surface-card rounded-card flex items-center justify-between gap-4 p-4">
          <div>
            <p className="font-bold text-gray-7">{registration.teamName || registration.author?.username || "Participant"}</p>
            <p className="text-sm text-gray-5">
              {registration.participants?.map((participant) => participant.username).join(", ") || registration.guestName || "Inscriere individuala"}
            </p>
          </div>
          <Badge variant={variantMap[registration.registrationStatus] || "gray"}>
            {registration.registrationStatus}
          </Badge>
        </div>
      ))}
    </div>
  );
}
