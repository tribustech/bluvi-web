import * as z from 'zod';
import type { PaginationParams } from '../shared';
import { call, type Transport } from '../transport';
import { announcementDetailSchema, announcementListResponseSchema } from './schemas';

/** fish `services/api/news.ts#getNews` */
export function getNews(t: Transport, { page = 1, pageSize = 200 }: PaginationParams = {}) {
  return call(
    t,
    { method: 'GET', path: '/feed/announcements', query: { page, pageSize }, auth: 'none' },
    announcementListResponseSchema
  );
}

/** fish `services/api/news.ts#getNewsById` */
export async function getNewsById(t: Transport, documentId: string) {
  const res = await call(
    t,
    { method: 'GET', path: `/feed/announcements/${encodeURIComponent(documentId)}`, auth: 'none' },
    z.object({ data: announcementDetailSchema })
  );
  return res.data;
}
