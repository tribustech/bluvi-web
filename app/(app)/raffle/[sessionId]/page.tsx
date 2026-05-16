"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Gift } from "lucide-react";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { AutoRefreshBar } from "@/components/shared/auto-refresh-bar";
import { RaffleDashboard } from "@/components/domain/raffle-dashboard";
import { getJson } from "@/services/api/_shared";
import type { RaffleActiveResponse } from "@/types";

export default function RaffleSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();

  const { data: raffle, refetch } = useQuery({
    queryKey: ["raffle", sessionId],
    queryFn: async () => {
      const response = await getJson<{ data?: RaffleActiveResponse } | RaffleActiveResponse>(
        `/raffle-sessions/${sessionId}`,
      );
      if (response && typeof response === "object" && "data" in response) {
        return (response as { data?: RaffleActiveResponse }).data ?? null;
      }
      return response as RaffleActiveResponse;
    },
    enabled: Boolean(sessionId),
  });

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const autoRefresh = useAutoRefresh({ onRefresh, enabled: true });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Gift className="h-5 w-5 text-indigo-5" />
        <h1 className="text-xl font-bold text-gray-7">Tombola</h1>
      </div>

      <AutoRefreshBar
        countdown={autoRefresh.countdown}
        isRefreshing={autoRefresh.isRefreshing}
        cooldownRemaining={autoRefresh.cooldownRemaining}
        canManualRefresh={autoRefresh.canManualRefresh}
        onRefresh={autoRefresh.manualRefresh}
      />

      <RaffleDashboard raffle={raffle ?? null} />
    </div>
  );
}
