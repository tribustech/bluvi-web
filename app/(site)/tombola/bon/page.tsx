import type { Metadata } from 'next';
import { Suspense } from 'react';
import { param, type SearchParams } from '@/lib/search-params';
import { requireViewer } from '@/lib/server/require-viewer';
import { routes } from '@/lib/routes';
import { receiptDialogTitle } from '../_shared/copy';
import { receiptModeFromParam } from './_components/mode';
import { UploadReceiptScreen, UploadReceiptSkeleton } from './_components/UploadReceiptScreen';

/*
 * /tombola/bon?mod=adauga|inlocuieste — «Încarcă bonul fiscal» (parity participant.raffle-upload-receipt, T6).
 * fish: app/(app)/raffle/upload-receipt.tsx — an orphan there (c1: the confirmation and the status
 * open the upload sheet instead). The web keeps it as the deep-linkable page form of the same
 * dialog (_shared/ReceiptUploadDialog); nothing links here until the owner decides.
 *
 * Signed in only: no cookie → proxy.ts answers a 307 to /intra?next=/tombola/bon; a dead cookie →
 * requireViewer's redirect (with the mode kept) inside the Suspense boundary. Everything on the
 * page is per viewer, read in the browser through /api/cms. Not indexed.
 */

type Props = { searchParams: Promise<SearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const mode = receiptModeFromParam(param(await searchParams, 'mod'));
  return { title: receiptDialogTitle(mode), robots: { index: false, follow: false } };
}

export default function RaffleUploadReceiptPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<UploadReceiptSkeleton />}>
      <Gated searchParams={searchParams} />
    </Suspense>
  );
}

async function Gated({ searchParams }: Props) {
  const mod = param(await searchParams, 'mod');
  const mode = receiptModeFromParam(mod);
  await requireViewer(routes.raffleReceipt(mode === 'add' ? 'adauga' : mode === 'replace' ? 'inlocuieste' : undefined));
  return <UploadReceiptScreen mode={mode} />;
}
