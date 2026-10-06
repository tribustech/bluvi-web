import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/routes';

/** Indexable only on the launch deployment (SITE_INDEXABLE=1, see next.config.ts); staging and previews block all. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_INDEXABLE !== '1') return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
