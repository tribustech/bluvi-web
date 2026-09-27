import { z } from 'zod';
import { feedImageSchema, paginatedSchema, richTextSchema, strapiImageSchema } from '../shared';

/** fish `models/news.type.ts` */
export const newsCategorySchema = z.enum(['Evenimente', 'Noutati', 'Interesant', 'Concursuri', 'Tehnici']);
export type NewsCategory = z.infer<typeof newsCategorySchema>;

export const announcementListItemSchema = z.object({
  documentId: z.string(),
  title: z.string(),
  shortDescription: z.string().nullable(),
  // Kept as string: an unknown category from the CMS must not break the whole list.
  category: z.union([newsCategorySchema, z.string()]),
  createdAt: z.string(),
  banner: z.array(feedImageSchema).nullable(),
});
export type AnnouncementListItem = z.infer<typeof announcementListItemSchema>;

const newsBlockBase = { id: z.union([z.string(), z.number()]) };

/** fish `models/blocks.type.ts` — the announcement dynamic zone. */
export const newsBlockSchema = z.discriminatedUnion('__component', [
  z.object({ __component: z.literal('news-block.simple-text'), ...newsBlockBase, text: richTextSchema }),
  z.object({
    __component: z.literal('news-block.image-right-text-left'),
    ...newsBlockBase,
    text: richTextSchema,
    image: strapiImageSchema.nullable(),
  }),
  z.object({
    __component: z.literal('news-block.image-left-text-right'),
    ...newsBlockBase,
    text: richTextSchema,
    image: strapiImageSchema.nullable(),
  }),
  z.object({ __component: z.literal('news-block.simple-image'), ...newsBlockBase, image: z.array(strapiImageSchema).nullable() }),
]);
export type NewsBlock = z.infer<typeof newsBlockSchema>;

export const announcementDetailSchema = announcementListItemSchema.extend({
  content: z.array(newsBlockSchema).nullable(),
});
export type AnnouncementDetail = z.infer<typeof announcementDetailSchema>;

export const announcementListResponseSchema = paginatedSchema(announcementListItemSchema);
export type AnnouncementListResponse = z.infer<typeof announcementListResponseSchema>;
