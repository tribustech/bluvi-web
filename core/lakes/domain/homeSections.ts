import type {
  LakeHomeSection,
  LakeHomeSectionKey,
  LakeHomeSectionLake,
  LakesNearbyPermissionPlaceholderMode,
  NearbyLakeHomeSection,
} from '../schemas';

/* fish `features/lakes/helpers/lakesHomeSections.ts` */

interface BuildLakesHomeSectionsParams {
  // Accepts both legacy Lake (/lakes/home) and feed LakeCard (recent-viewed via /feed/lakes/by-ids).
  recentViewedLakes?: LakeHomeSectionLake[];
  nearbySection?: NearbyLakeHomeSection | null;
  allLakesSection?: LakeHomeSection | null;
  nearbyPermissionPlaceholderMode?: LakesNearbyPermissionPlaceholderMode | null;
  fixedSections?: LakeHomeSection[];
}

const NEARBY_SECTION_DEFAULT_TITLE = 'Bălți din zona ta';

function removeDuplicatesByDocumentId<T extends LakeHomeSectionLake>(lakes: T[], seen: Set<string>): T[] {
  const unique: T[] = [];
  for (const lake of lakes) {
    if (!lake?.documentId || seen.has(lake.documentId)) {
      continue;
    }
    seen.add(lake.documentId);
    unique.push(lake);
  }
  return unique;
}

export function buildLakesHomeSections({
  recentViewedLakes = [],
  nearbySection,
  allLakesSection,
  nearbyPermissionPlaceholderMode = null,
  fixedSections = [],
}: BuildLakesHomeSectionsParams): LakeHomeSection[] {
  const sections: LakeHomeSection[] = [];

  const recentWithIds = recentViewedLakes.filter(lake => Boolean(lake?.documentId));
  if (recentWithIds.length > 0) {
    sections.push({ key: 'recent_viewed', title: 'Vizualizate recent', lakes: [...recentWithIds].reverse() });
  }

  const seenDocumentIds = new Set<string>();
  if (nearbySection?.lakes?.length) {
    const nearbyUnique = removeDuplicatesByDocumentId(nearbySection.lakes, seenDocumentIds);
    if (nearbyUnique.length > 0) {
      sections.push({ key: 'nearby', title: nearbySection.title, lakes: nearbyUnique });
    }
  } else if (nearbyPermissionPlaceholderMode) {
    sections.push({
      key: 'nearby',
      title: nearbySection?.title ?? NEARBY_SECTION_DEFAULT_TITLE,
      lakes: [],
      nearbyPermissionPlaceholderMode,
    });
  }

  if (allLakesSection?.lakes?.length) {
    sections.push({ ...allLakesSection, key: 'all_lakes' });
  }

  for (const section of fixedSections) {
    if (!section?.lakes?.length) {
      continue;
    }
    const uniqueLakes = removeDuplicatesByDocumentId(section.lakes, seenDocumentIds);
    if (!uniqueLakes.length) {
      continue;
    }
    sections.push({ ...section, lakes: uniqueLakes });
  }

  return sections;
}

export function getTotalLakesInSections(sections: LakeHomeSection[]): number {
  return sections.reduce((acc, section) => acc + section.lakes.length, 0);
}

/* fish `features/lakes/helpers/lakesHomeCardPresentation.ts` */

export interface LakesHomeCardPresentation {
  width: number;
  imageHeight: number;
  cardBorderRadius: number;
  cardIsTransparent: boolean;
  contentHorizontalPadding: number;
  showFacilities: boolean;
  showRegime: boolean;
  facilitiesIconsOnly: boolean;
  ratingOnImageBadge: boolean;
  showFishSpecies: boolean;
  maxFacilitiesToShow: number;
  strongerShadow: boolean;
}

const DEFAULT_LAKES_HOME_CARD_PRESENTATION: LakesHomeCardPresentation = {
  width: 182,
  imageHeight: 116,
  cardBorderRadius: 10,
  cardIsTransparent: false,
  contentHorizontalPadding: 10,
  showFacilities: true,
  showRegime: true,
  facilitiesIconsOnly: true,
  ratingOnImageBadge: true,
  showFishSpecies: false,
  maxFacilitiesToShow: 4,
  strongerShadow: true,
};

const RECENT_VIEWED_LAKES_HOME_CARD_PRESENTATION: LakesHomeCardPresentation = {
  ...DEFAULT_LAKES_HOME_CARD_PRESENTATION,
  width: 132,
  imageHeight: 106,
  cardBorderRadius: 24,
  cardIsTransparent: true,
  contentHorizontalPadding: 1,
  showFacilities: false,
  showRegime: false,
  facilitiesIconsOnly: false,
  maxFacilitiesToShow: 0,
};

export function getLakesHomeCardPresentation(sectionKey: LakeHomeSectionKey | (string & {})): LakesHomeCardPresentation {
  return sectionKey === 'recent_viewed' ? RECENT_VIEWED_LAKES_HOME_CARD_PRESENTATION : DEFAULT_LAKES_HOME_CARD_PRESENTATION;
}

/**
 * fish `app/(app)/(tabs)/lakes/index.tsx` — the /lakes/home answer split into the builder's inputs:
 * the nearby row, the all-lakes row and the fixed rows in server order.
 *
 * fish bug: its `fixedSections` keeps `all_lakes` (it only drops `nearby`), so buildLakesHomeSections
 * adds the all-lakes row twice — once in its own slot, again at its server position with whatever
 * the earlier rows did not show (a duplicate list key). The web leaves `all_lakes` out of the fixed
 * rows: it shows once, in its slot after the nearby row (parity lakes.home.c7).
 */
export function splitLakesHomeSections(homeSections: LakeHomeSection[]): {
  nearbySection: NearbyLakeHomeSection | null;
  allLakesSection: LakeHomeSection | null;
  fixedSections: LakeHomeSection[];
} {
  const nearby = homeSections.find(section => section.key === 'nearby');
  return {
    nearbySection: nearby ? (nearby as NearbyLakeHomeSection) : null,
    allLakesSection: homeSections.find(section => section.key === 'all_lakes') ?? null,
    fixedSections: homeSections.filter(section => section.key !== 'nearby' && section.key !== 'all_lakes'),
  };
}
