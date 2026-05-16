import { LakeCard } from "@/components/domain/lake-card";
import { safeStrapiGet } from "@/lib/strapi";
import type { LakesHomeResponse } from "@/types/lake-home";

export async function LakesHomeCarousel() {
  const response = await safeStrapiGet<LakesHomeResponse>(
    "/lakes/home",
    undefined,
    { tags: ["lakes"], revalidate: 300 },
  );

  const sections = response?.data?.sections ?? [];
  const visibleSections = sections.filter((section) => section.lakes.length > 0);

  if (!visibleSections.length) return null;

  return (
    <div className="space-y-8">
      {visibleSections.map((section) => (
        <section key={section.key} className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-7">{section.title}</h2>
          <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {section.lakes.map((lake) => (
              <div key={lake.documentId} className="w-[280px] shrink-0 md:w-[320px]">
                <LakeCard lake={lake} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
