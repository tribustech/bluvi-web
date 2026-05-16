export type LakeRequestPayload = {
  lakeName: string;
  message?: string;
  isAdmin?: boolean;
  matchedLake?: string | null;
};
