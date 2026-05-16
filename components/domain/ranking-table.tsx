import type { RankingResponse } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function RankingTable({ ranking }: { ranking: RankingResponse | null }) {
  if (!ranking) {
    return <div className="rounded-card border border-dashed border-gray-2 bg-white p-6 text-sm text-gray-5">Clasamentul va aparea dupa publicarea datelor din Strapi.</div>;
  }

  const rows = ranking.rankings as unknown as Array<Record<string, unknown>>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Stand</TableHead>
          <TableHead>Participant</TableHead>
          <TableHead>Capturi</TableHead>
          <TableHead>Cel mai mare peste</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.standId}-${index}`}>
            <TableCell>{row.generalPosition as number | string}</TableCell>
            <TableCell>{row.standName as string}</TableCell>
            <TableCell>
              {(row.participant as { username?: string } | null)?.username ||
                (row.teamName as string | null) ||
                "-"}
            </TableCell>
            <TableCell>{String(row.catchCount ?? row.quantity ?? "-")}</TableCell>
            <TableCell>{String(row.biggestFish ?? "-")} kg</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
