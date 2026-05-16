import type { StrapiResponse } from "./strapi";

export interface WeighingCatch {
  id?: string;
  weight: number;
  fishName?: string | null;
  createdAt?: string;
}

export interface Weighing extends StrapiResponse {
  weighingType: "normal" | "extra";
  startDate: string;
  endDate?: string | null;
  totalWeight?: number;
  catchCount?: number;
  catches?: WeighingCatch[];
}

export interface WeighingSummary {
  totalWeightKg: number;
  catchCount: number;
  latestWeighingEndDate?: string | null;
}
