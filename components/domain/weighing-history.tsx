import { Fish, Clock, Weight } from "lucide-react";
import type { Weighing } from "@/types";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function WeighingHistory({ weighings }: { weighings: Weighing[] }) {
  if (!weighings.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-card bg-white p-8 text-center shadow-[0_5px_15px_rgba(0,0,0,0.08)]">
        <Weight className="h-10 w-10 text-gray-2" />
        <p className="text-sm text-gray-5">Nu exista cantariri pentru acest stand.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {weighings.map((weighing) => (
        <div key={weighing.documentId} className="surface-card overflow-hidden rounded-card">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${weighing.weighingType === "extra" ? "bg-yellow-1" : "bg-indigo-1"}`}>
                <Weight className={`h-5 w-5 ${weighing.weighingType === "extra" ? "text-yellow-6" : "text-indigo-5"}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-gray-7">
                    {weighing.weighingType === "extra" ? "Cantarire extra" : "Cantarire standard"}
                  </p>
                  {!weighing.endDate && <Badge variant="green">Activa</Badge>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-5">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(weighing.startDate)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-indigo-7">{(weighing.totalWeight ?? 0).toFixed(2)} kg</p>
              <p className="text-xs text-gray-5">{weighing.catchCount ?? 0} capturi</p>
            </div>
          </div>

          {weighing.catches?.length ? (
            <div className="border-t border-gray-1 bg-gray-1/50 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {weighing.catches.map((c, i) => (
                  <div key={c.id || i} className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs shadow-sm">
                    <Fish className="h-3 w-3 text-indigo-5" />
                    <span className="font-bold text-gray-7">{c.weight} kg</span>
                    {c.fishName && <span className="text-gray-5">({c.fishName})</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
