import type { Competition } from "./competition";
import type { ReviewMeta } from "./review";
import type { Stand } from "./stand";
import type { ImageInfo, RichTextNode, StrapiResponse } from "./strapi";

export interface LakeCoordinates {
  lat: string;
  long: string;
}

export interface Facility extends StrapiResponse {
  name: string;
}

export interface FishSpeciesInfo extends StrapiResponse {
  quality?: string | null;
  fish?: {
    id: number;
    documentId: string;
    Name: string;
    Image?: ImageInfo | null;
  } | null;
}

export interface PriceInfo extends StrapiResponse {
  header: string;
  description?: string | null;
  price: number;
}

export interface ContactInfo extends StrapiResponse {
  header: string;
  name: string;
  phone: string;
}

export interface Lake extends StrapiResponse {
  name: string;
  description?: string | RichTextNode[] | null;
  address?: string | null;
  website?: string | null;
  isVerified?: boolean | null;
  facilities?: string[] | null;
  facility?: Facility[];
  directions?: string | null;
  fishingType?: string | null;
  surface?: number | null;
  fishingSpotTypes?: string | null;
  numberOfSeats?: number | null;
  regime?: string | null;
  distance?: string | null;
  county?: string | null;
  images?: ImageInfo[] | null;
  regulation?: ImageInfo | null;
  competitions?: Competition[] | null;
  depth?: { min?: number; max?: number } | null;
  contact?: ContactInfo[] | null;
  coordinates?: LakeCoordinates | null;
  fishSpecies?: FishSpeciesInfo[] | null;
  price?: PriceInfo[];
  stands?: Stand[];
  reviewsMeta?: ReviewMeta;
  acceptsReservations?: boolean;
}
