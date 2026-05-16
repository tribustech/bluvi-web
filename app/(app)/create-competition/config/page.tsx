import { OrganizerDraftStep } from "@/components/domain/organizer-draft-step";

export default function CreateCompetitionConfigPage() {
  return (
    <OrganizerDraftStep
      step="config"
      previousHref="/create-competition/basics"
      nextHref="/create-competition/ranking"
    />
  );
}
