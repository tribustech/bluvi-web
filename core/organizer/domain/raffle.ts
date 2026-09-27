import type {
  RaffleActiveRaw,
  RaffleActiveResponse,
  RaffleParticipationDto,
  RaffleParticipationRaw,
  RafflePrizeDto,
  RafflePrizeItemDto,
  RaffleRegulationSectionDto,
  RaffleTypeDto,
  RaffleWinnerEntry,
} from '../schemas';

/**
 * Resolve Strapi media URL to absolute. fish reads the origin from `EXPO_PUBLIC_API_URL`;
 * core never reads env, so the caller passes `mediaOrigin` (e.g. `http://localhost:1337`).
 * Without an origin a relative URL is returned untouched (S3 URLs are always absolute).
 * fish `services/api/raffle.ts#resolveMediaUrl`
 */
export function resolveMediaUrl(url: string | null | undefined, mediaOrigin?: string): string | null {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (!mediaOrigin) return url;
  return `${mediaOrigin.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`;
}

function normalizePrizeItemImage(item: RafflePrizeItemDto, mediaOrigin?: string): RafflePrizeItemDto {
  return {
    ...item,
    image: item.image?.url != null ? { url: resolveMediaUrl(item.image.url, mediaOrigin) ?? item.image.url } : item.image,
  };
}

/** fish `normalizeSessionPrizes` — also accepts the legacy `subItems` alias. */
export function normalizeSessionPrizes(
  prizes: RaffleActiveRaw['session']['prizes'],
  mediaOrigin?: string
): RafflePrizeDto[] {
  if (!prizes?.length) return [];
  return prizes.map(({ subItems, ...p }) => {
    const items = p.items ?? subItems;
    return {
      ...p,
      image: p.image?.url != null ? { url: resolveMediaUrl(p.image.url, mediaOrigin) ?? p.image.url } : p.image,
      items: items?.length ? items.map(i => normalizePrizeItemImage(i, mediaOrigin)) : undefined,
    };
  });
}

/** The `fetchActiveRaffle` body transform: resolve logos/prizes/winner avatars, default flags. */
export function normalizeActiveRaffle(raw: RaffleActiveRaw, mediaOrigin?: string): RaffleActiveResponse {
  const { headerLogoLeft, headerLogoRight, ...session } = raw.session;
  const rawWinners = raw.winnersByTypeKey ?? {};
  const winnersByTypeKey: Record<string, RaffleWinnerEntry[]> = {};
  for (const key of Object.keys(rawWinners)) {
    winnersByTypeKey[key] = (rawWinners[key] ?? []).map(w => ({
      documentId: w.documentId,
      username: w.username ?? null,
      avatarUrl: resolveMediaUrl(w.avatarUrl ?? null, mediaOrigin) ?? null,
    }));
  }
  return {
    ...raw,
    session: {
      ...session,
      prizes: normalizeSessionPrizes(session.prizes, mediaOrigin),
      headerLogoLeftUrl: resolveMediaUrl(headerLogoLeft?.url, mediaOrigin) ?? null,
      headerLogoRightUrl: resolveMediaUrl(headerLogoRight?.url, mediaOrigin) ?? null,
      dashboardTitle: session.dashboardTitle ?? null,
      dashboardSubtitle: session.dashboardSubtitle ?? null,
    },
    isEnded: raw.isEnded ?? false,
    hasWinners: raw.hasWinners ?? false,
    winnersByTypeKey,
  };
}

/** fish's participation transform: `receiptImageUrl` falls back to `receiptUrl`, made absolute. */
export function normalizeParticipation(raw: RaffleParticipationRaw, mediaOrigin?: string): RaffleParticipationDto {
  const { receiptUrl, ...dto } = raw;
  return {
    ...dto,
    // The upload response omits it; fish typed it required and read `undefined`.
    canChangeType: dto.canChangeType ?? false,
    receiptImageUrl: resolveMediaUrl(dto.receiptImageUrl ?? receiptUrl, mediaOrigin) ?? dto.receiptImageUrl,
  };
}

/* ------------------------------------------------------------------ */
/* fish hooks/useRaffle.ts — derived raffle state                      */
/* ------------------------------------------------------------------ */

export interface RaffleState {
  joined: boolean;
  entriesCount: number;
  selectedTypeKey: string | null;
  types: RaffleTypeDto[];
  registrationsByType: Record<string, number>;
  isRegistrationOpen: boolean;
  canChangeType: boolean;
  receiptUploaded: boolean;
  receiptImageUrl: string | null;
  receiptUnderVerification: boolean;
  countdownEnd: Date | null;
  registeredCount: number;
  sessionDocumentId: string | null;
  sessionPrizes: RafflePrizeDto[];
  previousWinnerAnnouncement: string | null;
  headerLogoLeftUrl: string | null;
  headerLogoRightUrl: string | null;
  dashboardTitle: string | null;
  dashboardSubtitle: string | null;
  isEnded: boolean;
  hasWinners: boolean;
  winnersByTypeKey: Record<string, RaffleWinnerEntry[]>;
  regulationTitle: string | null;
  regulationSections: RaffleRegulationSectionDto[];
}

export const defaultRaffleState: RaffleState = {
  joined: false,
  entriesCount: 0,
  selectedTypeKey: null,
  types: [],
  registrationsByType: {},
  isRegistrationOpen: false,
  canChangeType: false,
  receiptUploaded: false,
  receiptImageUrl: null,
  receiptUnderVerification: false,
  countdownEnd: null,
  registeredCount: 0,
  sessionDocumentId: null,
  sessionPrizes: [],
  previousWinnerAnnouncement: null,
  headerLogoLeftUrl: null,
  headerLogoRightUrl: null,
  dashboardTitle: null,
  dashboardSubtitle: null,
  isEnded: false,
  hasWinners: false,
  winnersByTypeKey: {},
  regulationTitle: null,
  regulationSections: [],
};

/** fish `useRaffle#deriveStateFromActiveAndParticipation` — the UI calls it with both query results. */
export function deriveRaffleState(
  active: RaffleActiveResponse | null | undefined,
  participation: RaffleParticipationDto | null | undefined,
  localSelectedTypeKey: string | null
): RaffleState {
  if (!active?.session) {
    return { ...defaultRaffleState, selectedTypeKey: localSelectedTypeKey };
  }
  const {
    session,
    registrationsByType = {},
    isRegistrationOpen,
    isEnded = false,
    hasWinners = false,
    winnersByTypeKey = {},
  } = active;
  const endDate = session.endDate ? new Date(session.endDate) : null;
  const types = session.types ?? [];
  const sessionPrizes: RafflePrizeDto[] = (session.prizes ?? []).map(p => ({
    title: p.title ?? '',
    description: p.description ?? null,
    priceLei: p.priceLei != null ? p.priceLei : undefined,
    count: p.count ?? 1,
    typeKey: p.typeKey ?? null,
    image: p.image?.url != null ? { url: p.image.url } : null,
    items: p.items ?? undefined,
  }));
  const registeredCount = Object.values(registrationsByType).reduce((acc, v) => acc + (v || 0), 0);
  const headerLogoLeftUrl = session.headerLogoLeftUrl ?? null;
  const headerLogoRightUrl = session.headerLogoRightUrl ?? null;
  const previousWinnerAnnouncement = session.previousWinnerAnnouncement ?? null;
  const dashboardTitle = session.dashboardTitle ?? null;
  const dashboardSubtitle = session.dashboardSubtitle ?? null;
  const regulationTitle = session.regulationTitle?.trim() ?? null;
  const regulationSections =
    session.regulationSections?.filter(Boolean).map(section => ({
      title: section?.title ?? '',
      body: section?.body ?? '',
    })) ?? [];

  const shared = {
    types,
    registrationsByType,
    isRegistrationOpen,
    countdownEnd: endDate,
    registeredCount,
    sessionPrizes,
    previousWinnerAnnouncement,
    headerLogoLeftUrl,
    headerLogoRightUrl,
    dashboardTitle,
    dashboardSubtitle,
    isEnded,
    hasWinners,
    winnersByTypeKey,
    regulationTitle,
    regulationSections,
  };

  if (!participation) {
    return {
      ...defaultRaffleState,
      ...shared,
      sessionDocumentId: session.documentId ?? null,
      selectedTypeKey: localSelectedTypeKey,
    };
  }

  const canChangeType = !isEnded && isRegistrationOpen;
  return {
    ...shared,
    joined: participation.joined,
    entriesCount: participation.entriesCount ?? 0,
    selectedTypeKey: participation.typeKey ?? localSelectedTypeKey,
    canChangeType,
    receiptUploaded: participation.receiptUploaded ?? false,
    receiptImageUrl: participation.receiptImageUrl ?? null,
    receiptUnderVerification: participation.receiptUnderVerification ?? false,
    sessionDocumentId: participation.sessionDocumentId ?? session.documentId ?? null,
  };
}
