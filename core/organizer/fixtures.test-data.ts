/** Realistic CMS payloads (trimmed from the local CMS) shared by the organizer unit tests. */

export const competitionDoc = {
  id: 91,
  documentId: 'i8kzbi5k51vmbyq75dmyez3d',
  name: 'Cupa Bluvi',
  competitionStatus: 'draft',
  startDate: '2026-05-08T14:00:00.000Z',
  endDate: '2026-05-10T10:00:00.000Z',
  registrationDeadline: null,
  registerFee: '300',
  competitionType: 'single',
  rankingType: 'quantity',
  participantsLimit: 20,
  teamParticipants: null,
  bestOfFishCount: null,
  bestOfTierSizes: null,
  numberOfWinners: null,
  excludeBiggestCatch: false,
  generalRankingWinnerMode: null,
  gridRule: null,
  description: [{ type: 'paragraph', children: [{ type: 'text', text: 'Descriere' }] }],
  reward: null,
  regulation: null,
  draftMeta: {
    sectors: [{ name: 'A', minFishNumber: 1 }],
    standAllocations: { A: ['s1', 's2'] },
    sponsorIds: [],
    fishSpeciesIds: ['f1'],
    completedSteps: [1, 2],
  },
  createdAt: '2026-04-01T10:00:00.000Z',
  updatedAt: '2026-04-02T10:00:00.000Z',
  lake: { id: 5, documentId: 's84u55lo4n9z0emngozttt6e', name: 'Chita Lake' },
  banner: { id: 3, documentId: 'b1', url: 'https://x/banner.jpg' },
  author: { id: 13, documentId: 'q9kp', username: 'Toni', email: 'dropped@by.schema' },
};

export const paginated = <T>(data: T[], page = 1, pageSize = 10, total = data.length) => ({
  data,
  meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total } },
});

export const statDetailItem = {
  documentId: 'i8kz',
  competition: {
    documentId: 'i8kz',
    name: 'Cupa',
    startDate: '2026-05-08T14:00:00.000Z',
    endDate: null,
    participantsLimit: 20,
    participantsRegistered: 12,
    competitionStatus: 'notStarted',
  },
  pendingRegistrationsCount: 2,
  emptySpotsCount: 8,
  fillRate: 60,
};

export const weighingByStand = {
  id: 4737,
  documentId: 'mg4hfexz1t3otgc4sd86hhb9',
  weighingType: 'normal',
  weighingStatus: 'finished',
  startDate: '2026-05-08T14:55:00.000Z',
  endDate: '2026-05-08T15:00:00.000Z',
  catches: [{ weight: 4.2 }, { weight: 6.1 }, { weight: 3.8 }, { weight: 5.5 }],
};

export const weighingDetail = {
  id: 4737,
  documentId: 'mg4hfexz1t3otgc4sd86hhb9',
  weighingType: 'normal',
  weighingStatus: 'started',
  startDate: '2026-05-08T14:55:00.000Z',
  endDate: null,
  numberOfRevisions: 0,
  catches: [
    { id: 24346, documentId: 'bq8x', weight: 5.5, fishType: { Name: 'Caras' }, media: [] },
    { id: 24345, documentId: 'n04a', weight: 3.8, fishType: null, media: [{ url: 'https://x/c.jpg' }] },
  ],
  refereeSignature: null,
  witnessSignature: { url: 'https://x/sig.png' },
  competition: { rankingType: 'quantity' },
  stand: { sectorDrawPosition: null, id: 3677, documentId: 'nk68' },
};

export const revisionClosed = {
  id: 158,
  documentId: 'jr6a',
  sessionId: 1,
  action: 'closed',
  state: {
    added: [{ type: 'Babusca', weight: 3.8, catchId: 'dqer' }],
    removed: [],
    unmodified: [{ type: 'Babusca', weight: 4.872, catchId: 'ap3j' }],
  },
  createdAt: '2025-10-27T06:42:48.666Z',
  updatedAt: '2025-10-27T06:42:48.666Z',
  author: { id: 277, documentId: 'ce6a', username: 'Big ios' },
  weighing: { id: 4671, documentId: 'jq2v' },
};

export const revisionReopen = {
  ...revisionClosed,
  id: 157,
  documentId: 'hpwi',
  action: 'reopen',
  state: { reason: 'Uitat o captura', catches: [{ type: 'Babusca', weight: 4.872, catchId: 'ap3j' }] },
};

export const activeWeighing = {
  weighingDocumentId: 'w1',
  weighingType: 'extra',
  stand: { id: 3677, documentId: 'nk68', name: '1', sectors: [{ id: 582, documentId: 'riy4', name: 'A' }], sectorDrawPosition: null },
  competition: { rankingType: 'quantity' },
};

export const extraScale = {
  createdAt: '2026-04-30T10:58:02.357Z',
  id: 325,
  documentId: 'gk2f',
  extraStatus: 'done',
  updatedAt: '2026-05-04T08:16:13.356Z',
  stand: { id: 3677, documentId: 'nk68', name: '1', sectors: [{ id: 582, documentId: 'riy4', name: 'A' }], sectorDrawPosition: null },
  author: { id: 13, documentId: 'q9kp', username: 'Toni Radulescu' },
};

export const allocated = {
  ni5d: {
    participants: [{ id: 563, documentId: 'kbj3', name: 'Audit Pescar' }],
    teamName: '',
    registrationId: 'ufyp',
    guestName: '',
    clubName: '',
    sectorName: 'A',
    sectorDrawPosition: null,
  },
  empty: null,
};
