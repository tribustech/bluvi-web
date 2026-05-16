import { OrganizerDraftStep } from "@/components/domain/organizer-draft-step";

export default function CreateCompetitionRankingPage() {
  return (
    <OrganizerDraftStep
      step="ranking"
      previousHref="/create-competition/config"
      nextHref="/create-competition/lake-sectors"
    />
  );
}
