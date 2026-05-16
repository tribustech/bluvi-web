"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { Scale, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";
import { useWeighings } from "@/services/queries/use-weighing";
import { AutoRefreshBar } from "@/components/shared/auto-refresh-bar";
import { WeighingForm } from "@/components/domain/weighing-form";
import { WeighingHistory } from "@/components/domain/weighing-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ScaleStandPage() {
  const { competitionId, standId } = useParams<{ competitionId: string; standId: string }>();
  const { data: weighings, refetch } = useWeighings(competitionId, standId);

  const onRefresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const autoRefresh = useAutoRefresh({ onRefresh, enabled: true });
  const weighingsList = weighings ?? [];
  const activeWeighing = weighingsList.find((w) => !w.endDate);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/scale/${competitionId}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-2 bg-white text-gray-7 transition hover:bg-gray-1"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Scale className="h-5 w-5 text-indigo-5" />
          <h1 className="text-xl font-bold text-gray-7">Cantarire</h1>
        </div>
      </div>

      <AutoRefreshBar
        countdown={autoRefresh.countdown}
        isRefreshing={autoRefresh.isRefreshing}
        cooldownRemaining={autoRefresh.cooldownRemaining}
        canManualRefresh={autoRefresh.canManualRefresh}
        onRefresh={autoRefresh.manualRefresh}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-indigo-5" />
            Adauga capturi
          </CardTitle>
        </CardHeader>
        <CardContent>
          <WeighingForm
            competitionId={competitionId}
            standId={standId}
            activeWeighingId={activeWeighing?.documentId ?? null}
            onSuccess={() => void refetch()}
          />
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-7">Istoric cantariri</h2>
        <WeighingHistory weighings={weighingsList} />
      </div>
    </div>
  );
}
