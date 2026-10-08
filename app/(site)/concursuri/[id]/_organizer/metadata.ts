import type { Metadata } from 'next';

/**
 * Management pages (scale, penalties, sectors, allocation, wizard…) are per user and never indexed:
 * every page.tsx under them exports `managementMetadata('<title>')`.
 */
export function managementMetadata(title: string): Metadata {
  return { title, robots: { index: false, follow: false } };
}
