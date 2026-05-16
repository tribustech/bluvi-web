import { LakeCard } from "@/components/domain/lake-card";
import type { Lake } from "@/types";

interface RecommendedLakesSectionProps {
  lakes: Lake[];
}

export function RecommendedLakesSection({ lakes }: RecommendedLakesSectionProps) {
  if (!lakes.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-7">Balti recomandate</h2>
      {lakes.map((lake) => (
        <LakeCard key={lake.documentId} lake={lake} />
      ))}
    </section>
  );
}
