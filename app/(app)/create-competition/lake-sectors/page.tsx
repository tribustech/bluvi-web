import { OrganizerDraftStep } from "@/components/domain/organizer-draft-step";

export default function CreateCompetitionLakeSectorsPage() {
  return (
    <OrganizerDraftStep
      step="lakeSectors"
      previousHref="/create-competition/ranking"
      nextHref="/create-competition/review"
    />
  );
}
