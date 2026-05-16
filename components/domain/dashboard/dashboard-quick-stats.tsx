import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DashboardQuickStatsProps {
  competitionsCount: number;
  phone: string | null | undefined;
  isOrganizer: boolean;
}

export function DashboardQuickStats({
  competitionsCount,
  phone,
  isOrganizer,
}: DashboardQuickStatsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sumar rapid</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        <div className="rounded-card bg-indigo-1 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-7">Competitii</p>
          <p className="mt-2 text-2xl font-bold text-gray-7">{competitionsCount}</p>
        </div>
        <div className="rounded-card bg-white p-4 ring-1 ring-gray-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-gray-5">Telefon</p>
          <p className="mt-2 text-sm text-gray-7">{phone || "Necompletat"}</p>
        </div>
        {isOrganizer ? (
          <div className="rounded-card bg-green-2 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-green-7">Organizer mode</p>
            <p className="mt-2 text-sm text-gray-7">Ai acces la dashboard-ul de organizator.</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
