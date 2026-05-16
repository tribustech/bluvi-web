export const queryKeys = {
  competitions: {
    all: ["competitions"] as const,
    my: ["competitions", "my"] as const,
    organizedByMe: ["competitions", "organized-by-me"] as const,
    byId: (id: string) => ["competitions", id] as const,
    byStatus: (status: string) => ["competitions", status] as const,
    registrations: (id: string) => ["competitions", id, "registrations"] as const,
    activeWeighing: (id: string) => ["competitions", id, "active-weighing"] as const,
    allocatedParticipants: (id: string) => ["competitions", id, "allocated-participants"] as const,
    fishSpecies: (id: string) => ["competitions", id, "fish-species"] as const,
    extraScales: (id: string) => ["competitions", id, "extra-scales"] as const,
    live: ["competitions", "live"] as const,
  },
  lakes: {
    all: ["lakes"] as const,
    byId: (id: string) => ["lakes", id] as const,
    search: (search: string) => ["lakes", "search", search] as const,
  },
  news: {
    all: ["news"] as const,
    byId: (id: string) => ["news", id] as const,
  },
  rankings: {
    byCompetitionId: (id: string) => ["rankings", id] as const,
    bestN: (id: string) => ["rankings", id, "best-n"] as const,
    catches: (id: string, sort: string) => ["rankings", id, "catches", sort] as const,
    statistics: (id: string) => ["rankings", id, "statistics"] as const,
    thresholds: (id: string) => ["rankings", id, "thresholds"] as const,
  },
  profile: {
    my: ["my-profile"] as const,
    statistics: ["profile-statistics"] as const,
    statute: (competitionId: string) => ["profile-statute", competitionId] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    unread: ["notifications", "unread"] as const,
  },
  weighings: {
    summary: (competitionId: string) => ["weighings", competitionId, "summary"] as const,
    byStand: (competitionId: string, standId: string) =>
      ["weighings", competitionId, standId] as const,
    byId: (weighingId: string) => ["weighings", weighingId] as const,
    revisions: (weighingId: string) => ["weighings", weighingId, "revisions"] as const,
  },
  raffle: {
    active: ["raffle", "active"] as const,
    participation: ["raffle", "participation"] as const,
  },
  organizer: {
    dashboard: ["organizer", "dashboard"] as const,
    competitions: ["organizer", "competitions"] as const,
  },
  sponsors: {
    all: ["sponsors"] as const,
  },
  reviews: {
    byLake: (lakeId: string) => ["reviews", lakeId] as const,
    myByLake: (lakeId: string) => ["reviews", lakeId, "my"] as const,
  },
  users: {
    all: ["users"] as const,
    paginated: (search: string, page: number) => ["users", search, page] as const,
  },
  sectors: {
    all: ["sectors"] as const,
  },
  stands: {
    all: ["stands"] as const,
    statsByLake: (lakeId: string) => ["stands", lakeId, "stats"] as const,
  },
} as const;
