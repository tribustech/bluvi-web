import { CompetitionCard } from "@/components/domain/competition-card";
import type { Competition } from "@/types";

interface MyCompetitionsSectionProps {
  competitions: Competition[];
}

export function MyCompetitionsSection({ competitions }: MyCompetitionsSectionProps) {
  if (!competitions.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-7">Competitiile tale</h2>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {competitions.map((competition) => (
          <CompetitionCard key={competition.documentId} competition={competition} />
        ))}
      </div>
    </section>
  );
}
