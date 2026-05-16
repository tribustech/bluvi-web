export interface StrapiResponse {
  id: number;
  documentId: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface ImageFormat {
  ext: string;
  url: string;
  hash: string;
  mime: string;
  name: string;
  size: number;
  width: number;
  height: number;
}

export interface ImageFormats {
  large?: ImageFormat;
  medium?: ImageFormat;
  small?: ImageFormat;
  thumbnail?: ImageFormat;
}

export interface ImageInfo extends StrapiResponse {
  name: string;
  alternativeText?: string | null;
  caption?: string | null;
  width?: number | null;
  height?: number | null;
  formats?: ImageFormats | null;
  url: string;
  hash?: string;
  ext?: string;
  mime?: string;
  size?: number;
  blurhash?: string | null;
}

export interface StrapiPagination {
  page: number;
  pageSize: number;
  total: number;
  pageCount?: number;
}

export interface StrapiPaginatedResponse<T> {
  data: T[];
  meta: {
    pagination: StrapiPagination;
  };
}

export interface RichTextNode {
  type?: string;
  children?: RichTextNode[];
  text?: string;
  level?: number;
  format?: string;
  url?: string;
}
