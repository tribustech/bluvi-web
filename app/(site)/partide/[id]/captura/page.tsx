import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { param, type SearchParams } from '@/lib/search-params';
import { requireViewer } from '@/lib/server/require-viewer';
import { CaptureScreen } from './_form/CaptureScreen';
import { CaptureSkeleton } from './_form/states';

/*
 * /partide/[id]/captura — «Captură nouă» / «Editează captura» (parity partide.captura, T6; fish
 * app/(app)/partide/captura.tsx). [id] = the partidă's documentId.
 *  - `?lanseta=n`: a capture off rod n (preselected; its cast pin is the default position);
 *  - `?editare=<eventClientId>`: edit that capture in place.
 * Signed in only: the gate awaits the session inside the Suspense boundary (Cache Components) and
 * sends a guest to /intra with this path — the query included — to come back to. The partidă itself
 * is per-user and live (the viewer's own active partidă, the realtime projection), so everything
 * past the gate renders in the browser (./_form). Not indexed.
 */

type Props = { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> };

export const metadata: Metadata = {
  title: 'Captură',
  robots: { index: false, follow: false },
};

export default function CapturePage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<CaptureSkeleton />}>
      <Gated params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** `?lanseta=` as a rod index (≥ 1), or null. */
function rodIndexOf(raw: string | undefined): number | null {
  if (!raw || !/^\d{1,2}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 ? n : null;
}

async function Gated({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const rodParam = rodIndexOf(param(sp, 'lanseta'));
  const editParam = param(sp, 'editare') ?? null;
  await requireViewer(routes.partidaCapture(id, { lanseta: rodParam ?? undefined, editare: editParam ?? undefined }));
  return <CaptureScreen documentId={id} rodParam={rodParam} editParam={editParam} />;
}
