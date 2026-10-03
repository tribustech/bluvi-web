import { createBrowserTransport } from '@/lib/client/transport';

/**
 * The page's browser transport, through the same-origin proxy for every call. A direct public GET
 * to the CMS sends `x-app-platform` / `x-app-version`, which makes the browser preflight, and the
 * CMS's default `strapi::cors` does not allow those headers (blocked locally, 2026-10-03). Switch
 * back to the default (`direct`) once the CMS allows them.
 */
export const pageTransport = () => createBrowserTransport({ direct: false });
