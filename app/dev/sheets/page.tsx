import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SheetsHarness } from './SheetsHarness';

export const metadata: Metadata = { title: 'Foi de telefon · harness', robots: { index: false } };

/**
 * Dev harness for the one phone sheet primitive (components/surfaces: Sheet, ResponsiveSurface,
 * ModalSurface) — a long page under every flavour, for tests/e2e/phone-sheets.spec.ts. Dev only:
 * 404 in production builds.
 */
export default function SheetsHarnessPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEV_KIT !== '1') notFound();
  return <SheetsHarness />;
}
