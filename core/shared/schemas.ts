import { z } from 'zod';

/** Strapi pagination meta (`meta.pagination`). */
export const paginationMetaSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  pageCount: z.number(),
  total: z.number(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export type PaginationParams = { page?: number; pageSize?: number };

/** `{ data: T[], meta: { pagination } }` — the list envelope of most `/feed/*` and legacy routes. */
export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    data: z.array(item),
    meta: z.object({ pagination: paginationMetaSchema }),
  });
}

/** `{ data: T }` — the detail envelope. */
export function dataSchema<T extends z.ZodType>(item: T) {
  return z.object({ data: item });
}

/** The next page number for an infinite query, or undefined on the last page. */
export function nextPageParam(meta: { pagination: PaginationMeta } | undefined): number | undefined {
  const p = meta?.pagination;
  if (!p) return undefined;
  return p.page < p.pageCount ? p.page + 1 : undefined;
}

/** One Strapi image derivative (`formats.small` …). */
export const imageFormatSchema = z.object({
  ext: z.string().nullish(),
  url: z.string(),
  hash: z.string().nullish(),
  mime: z.string().nullish(),
  name: z.string().nullish(),
  path: z.string().nullish(),
  size: z.number().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  sizeInBytes: z.number().nullish(),
});

/**
 * Strapi derivatives. Breakpoints REPLACE each other and old files lack `xlarge`/`thumbnail`
 * (fish `models/_generic.ts`), so every format is optional.
 */
export const imageFormatsSchema = z.object({
  xlarge: imageFormatSchema.optional(),
  large: imageFormatSchema.optional(),
  medium: imageFormatSchema.optional(),
  small: imageFormatSchema.optional(),
  thumbnail: imageFormatSchema.optional(),
});

/** Full Strapi media object (legacy routes and populated relations). fish `ImageInfo`. */
export const strapiImageSchema = z.object({
  id: z.number().optional(),
  documentId: z.string().optional(),
  name: z.string().nullish(),
  alternativeText: z.string().nullish(),
  caption: z.string().nullish(),
  width: z.number().nullish(),
  height: z.number().nullish(),
  formats: imageFormatsSchema.nullish(),
  hash: z.string().nullish(),
  ext: z.string().nullish(),
  mime: z.string().nullish(),
  size: z.number().nullish(),
  url: z.string(),
  previewUrl: z.string().nullish(),
  provider: z.string().nullish(),
  blurhash: z.string().nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
export type StrapiImage = z.infer<typeof strapiImageSchema>;

/** Lean image used by `/feed/*` DTOs: `{ url, mediumUrl, blurhash }`. */
export const feedImageSchema = z.object({
  url: z.string(),
  mediumUrl: z.string().nullish(),
  blurhash: z.string().nullish(),
});
export type FeedImage = z.infer<typeof feedImageSchema>;

/**
 * Strapi rich-text ("blocks") node. Kept structural and recursive: the UI renders it,
 * the data layer only guarantees the shape `{ type, children? }`.
 */
export type RichTextNode = {
  type: string;
  text?: string;
  children?: RichTextNode[];
  [key: string]: unknown;
};
export const richTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.looseObject({
    type: z.string(),
    text: z.string().optional(),
    children: z.array(richTextNodeSchema).optional(),
  })
);
export const richTextSchema = z.array(richTextNodeSchema);

/** Common Strapi document fields. */
export const strapiDocumentSchema = z.object({
  id: z.number(),
  documentId: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});
