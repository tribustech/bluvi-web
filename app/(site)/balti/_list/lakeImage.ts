import type { LakeHomeSectionLake, LakePinImage, LegacyLake } from '@/core/lakes';

/*
 * fish helpers/getImageFormat.ts for the three lake image shapes this area meets: the legacy
 * Strapi image (`formats.medium`), the flattened /feed image (`mediumUrl`) and the map pin image
 * (`formats.medium` only). The medium format is what fish's cards load.
 */

type AnyImage = { url: string; mediumUrl?: string | null; smallUrl?: string | null; blurhash?: string | null; formats?: unknown };

export type LakeImageSrc = { src: string; blurhash: string | null };

function mediumOf(img: AnyImage): string {
  if (img.mediumUrl) return img.mediumUrl;
  const formats = img.formats as { medium?: { url?: string } | null; small?: { url?: string } | null } | null | undefined;
  return formats?.medium?.url ?? formats?.small?.url ?? img.url;
}

export function imageSrc(img: AnyImage | LakePinImage): LakeImageSrc {
  return { src: mediumOf(img as AnyImage), blurhash: (img as AnyImage).blurhash ?? null };
}

/** The card photo of a home-row lake, or null. */
export function lakeImage(lake: LakeHomeSectionLake): LakeImageSrc | null {
  const first = (lake.images as AnyImage[] | null | undefined)?.[0];
  return first ? imageSrc(first) : null;
}

/** Up to `n` photos of a legacy (in-bbox) lake. */
export function lakePhotos(lake: Pick<LegacyLake, 'images'>, n = 3): LakeImageSrc[] {
  return (lake.images ?? []).slice(0, n).map((img) => imageSrc(img as AnyImage));
}
