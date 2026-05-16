export interface CompetitionDraftState {
  basics: {
    name: string;
    startDate: string;
    endDate: string;
    registerFee: string;
    description: string;
  };
  config: {
    competitionType: "single" | "team";
    participantsLimit: string;
    teamParticipants: string;
  };
  ranking: {
    rankingType: string;
    bestOfFishCount: string;
    numberOfWinners: string;
  };
  lakeSectors: {
    lakeId: string;
    lakeName: string;
    sectors: string;
    sponsors: string;
  };
}

export const defaultCompetitionDraft: CompetitionDraftState = {
  basics: {
    name: "",
    startDate: "",
    endDate: "",
    registerFee: "",
    description: "",
  },
  config: {
    competitionType: "single",
    participantsLimit: "",
    teamParticipants: "",
  },
  ranking: {
    rankingType: "quantity",
    bestOfFishCount: "",
    numberOfWinners: "",
  },
  lakeSectors: {
    lakeId: "",
    lakeName: "",
    sectors: "",
    sponsors: "",
  },
};

export const organizerDraftStorageKey = "bluvi-organizer-draft";
