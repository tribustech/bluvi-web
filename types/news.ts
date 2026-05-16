import type { ImageInfo, RichTextNode, StrapiResponse } from "./strapi";

export interface NewsArticle extends StrapiResponse {
  title: string;
  slug?: string;
  excerpt?: string | null;
  banner?: ImageInfo | null;
  content?: RichTextNode[] | string | null;
}
