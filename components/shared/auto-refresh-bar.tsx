"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

interface AutoRefreshBarProps {
  countdown: number;
  isRefreshing: boolean;
  cooldownRemaining: number;
  canManualRefresh: boolean;
  onRefresh: () => void;
}

export function AutoRefreshBar({
  countdown,
  isRefreshing,
  cooldownRemaining,
  canManualRefresh,
  onRefresh,
}: AutoRefreshBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-indigo-1 px-4 py-3">
      <Typography preset="body2" color="#737373">
        Se actualizeaza in {countdown}s
      </Typography>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={!canManualRefresh}>
        <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
        {cooldownRemaining > 0 ? `Asteapta ${cooldownRemaining}s` : "Actualizeaza"}
      </Button>
    </div>
  );
}
