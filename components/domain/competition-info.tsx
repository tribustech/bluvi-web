import type { Competition } from "@/types";
import { renderRichText } from "@/lib/content";

export function CompetitionInfo({ competition }: { competition: Competition }) {
  return (
    <div className="prose-bluvi space-y-6 rounded-card bg-white p-6">
      <section>
        <h2>Descriere</h2>
        {renderRichText(competition.description)}
      </section>
      <section>
        <h2>Premii</h2>
        {renderRichText(competition.reward)}
      </section>
      <section>
        <h2>Regulament</h2>
        {renderRichText(competition.regulation)}
      </section>
    </div>
  );
}
