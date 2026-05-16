import type { Lake } from "./lake";

export type LakeHomeSectionKey =
  | "recent_viewed"
  | "nearby"
  | "all_lakes"
  | "top_rated"
  | "with_retention"
  | "with_cabins"
  | "competition_lakes"
  | "recently_added";

export type LakesNearbyPermissionPlaceholderMode =
  | "never_asked"
  | "denied"
  | "services_off";

export interface LakeHomeSection {
  key: LakeHomeSectionKey;
  title: string;
  lakes: Lake[];
  nearbyPermissionPlaceholderMode?: LakesNearbyPermissionPlaceholderMode;
}

export interface NearbyLakeHomeSection
  extends Omit<LakeHomeSection, "key" | "lakes"> {
  key: "nearby";
  lakes: (Lake & { distanceKm: number })[];
}

export interface LakesHomeResponse {
  data: {
    sections: LakeHomeSection[];
  };
  meta?: {
    generatedAt?: string;
  };
}
