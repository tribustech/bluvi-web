import * as z from 'zod';
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
  // `text` is optional in the CMS (blocks, not `required`): an empty block comes as null and renders
  // nothing (fish CustomBlocksRenderer `!content`), never failing the whole article.
  z.object({ __component: z.literal('news-block.simple-text'), ...newsBlockBase, text: richTextSchema.nullish() }),
  z.object({
    __component: z.literal('news-block.image-right-text-left'),
    ...newsBlockBase,
    text: richTextSchema.nullish(),
    image: strapiImageSchema.nullable(),
  }),
  z.object({
    __component: z.literal('news-block.image-left-text-right'),
    ...newsBlockBase,
    text: richTextSchema.nullish(),
    image: strapiImageSchema.nullable(),
  }),
  z.object({ __component: z.literal('news-block.simple-image'), ...newsBlockBase, image: z.array(strapiImageSchema).nullable() }),
]);
export type NewsBlock = z.infer<typeof newsBlockSchema>;

/** The block types fish renders (`renderNewsContentBlock`); any other renders nothing there. */
export const NEWS_BLOCK_TYPES: readonly NewsBlock['__component'][] = [
  'news-block.simple-text',
  'news-block.image-right-text-left',
  'news-block.image-left-text-right',
  'news-block.simple-image',
];

/**
 * The CMS passes the dynamic zone through verbatim (`toAnnouncementDetailDTO`), so a block type
 * added in the CMS after this build reaches us too. fish's switch renders `null` for it; here it is
 * dropped before validation, so one new block type never fails the whole article. A KNOWN block
 * with a wrong shape still fails (the contract test catches it).
 */
export function dropUnknownNewsBlocks(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  return content.filter(
    b => !!b && typeof b === 'object' && NEWS_BLOCK_TYPES.includes((b as { __component?: unknown }).__component as NewsBlock['__component'])
  );
}

export const announcementDetailSchema = announcementListItemSchema.extend({
  content: z.preprocess(dropUnknownNewsBlocks, z.array(newsBlockSchema).nullable()),
});
export type AnnouncementDetail = z.infer<typeof announcementDetailSchema>;

export const announcementListResponseSchema = paginatedSchema(announcementListItemSchema);
export type AnnouncementListResponse = z.infer<typeof announcementListResponseSchema>;
