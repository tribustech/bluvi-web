/*
 * Noutăți's page size (and its query key; the server's first page and the browser's next ones share
 * it). fish loads 5 (`useNews({ pageSize: 5 })`) into one column; the web's auto-fill grid has 1–5
 * columns, so a page of 12 (divisible by 2, 3 and 4) fills its rows at every common width.
 */
export const NEWS_PAGE_SIZE = 12;
