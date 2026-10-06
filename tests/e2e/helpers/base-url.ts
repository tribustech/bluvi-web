/*
 * The one base URL every e2e spec runs against: playwright.config.ts `use.baseURL`. Point a run at
 * another dev server with BASE_URL=http://localhost:3101; specs never hard-code a port. Specs that
 * need the absolute URL outside a relative `page.goto` (the session cookie's domain, an absolute
 * request) import it from here, so the two can never disagree.
 */
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
