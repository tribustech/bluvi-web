import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ExtraScales({
  requestedCount,
  onRequest,
}: {
  requestedCount: number;
  onRequest?: () => void;
}) {
  return (
    <div className="surface-card rounded-card flex items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-indigo-1 p-3 text-indigo-7">
          <Scale className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-gray-7">Cantariri extra</p>
          <p className="text-sm text-gray-5">{requestedCount} cereri active in acest moment</p>
        </div>
      </div>
      <Button variant="secondary" onClick={onRequest}>
        Solicita extras
      </Button>
    </div>
  );
}
