import { plural } from '@/components/cards/format';
import type { Crumb } from '@/components/nav/Breadcrumbs';
import type { CompetitionStatus } from '@/core/competitions';
import { COMPETITIONS_CRUMB } from '../../[id]/_components/crumbs';

/*
 * The three global status lists — fish app/(app)/competitions/{notStarted,started,completed}/index.tsx
 * (parity competitions-list.viitoare / .live / .incheiate). One config per URL segment; the pages,
 * the client screen and the e2e spec all read it. No 'use client': the server pages use it too.
 */

export type StatusListKey = 'viitoare' | 'live' | 'incheiate';

export type StatusListConfig = {
  key: StatusListKey;
  status: Extract<CompetitionStatus, 'notStarted' | 'started' | 'completed'>;
  /** fish CompetitionsFullList `title` — the page's h1. */
  title: string;
  /** The tab label in the header's status row (the lake page's Live · Viitoare · Trecute). */
  tab: string;
  /** «1 concurs viitor» / «N concursuri viitoare» / «25 de concursuri viitoare» (index.c11's agreement, with «de» from 20). */
  count: (n: number) => string;
  description: string;
};

export const STATUS_LISTS: Record<StatusListKey, StatusListConfig> = {
  viitoare: {
    key: 'viitoare',
    status: 'notStarted',
    title: 'Concursuri viitoare',
    tab: 'Viitoare',
    count: n => plural(n, 'concurs viitor', 'concursuri viitoare'),
    description:
      'Toate concursurile de pescuit sportiv care urmează în România: date, bălți, locuri și tip de clasament. Înscrie-te pe Bluvi.',
  },
  live: {
    key: 'live',
    status: 'started',
    title: 'Concursuri live',
    tab: 'Live',
    count: n => plural(n, 'concurs în desfășurare', 'concursuri în desfășurare'),
    description: 'Concursurile de pescuit sportiv în desfășurare acum, cu clasament live și cântăriri în timp real, pe Bluvi.',
  },
  incheiate: {
    key: 'incheiate',
    status: 'completed',
    // One word on the web for this list: «trecute» (fish's h1, the lake page's tab); the URL keeps
    // its /incheiate segment (already linked and indexed).
    title: 'Concursuri trecute',
    tab: 'Trecute',
    count: n => plural(n, 'concurs trecut', 'concursuri trecute'),
    description: 'Rezultatele concursurilor de pescuit sportiv încheiate: clasamente finale, bălți și participanți, pe Bluvi.',
  },
};

/** The header's status row, in the lake page's order (Live · Viitoare · Trecute). */
export const STATUS_TAB_ORDER: readonly StatusListKey[] = ['live', 'viitoare', 'incheiate'];

/**
 * fish asks for 5 a page (two columns on a phone). WEB: 20 — the grid auto-fills up to six columns
 * on a wide screen, where 5 would be under one row a page and the footer would fetch page after page
 * as soon as it shows (parity viitoare.c2 / live.c2 / incheiate.c2, WEB note).
 */
export const STATUS_LIST_PAGINATION = { pageSize: 20 } as const;

/** The footer's noun for «20 din {total} …»: «de concursuri» from 20 (plural's agreement), «concurs» for one. */
export const footerNoun = (total: number | undefined) =>
  total === undefined ? 'concursuri' : plural(total, 'concurs', 'concursuri').replace(/^\S+ /, '');

/**
 * The breadcrumb band's trail — «Competiții / {title}»: the competition page's parent crumb and the
 * page's h1 — also its BreadcrumbList (BreadcrumbBand jsonLd) and the error boundary's band.
 */
export function statusListTrail(list: StatusListKey): Crumb[] {
  return [COMPETITIONS_CRUMB, { label: STATUS_LISTS[list].title }];
}
