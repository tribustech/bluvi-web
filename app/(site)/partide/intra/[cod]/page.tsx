import type { Metadata } from 'next';
import { Suspense } from 'react';
import { routes } from '@/lib/routes';
import { requireViewer } from '@/lib/server/require-viewer';
import { JoinLoading } from './_confirm/JoinLoading';
import { JoinScreen } from './_confirm/JoinScreen';

/*
 * /partide/intra/[cod] — «Alătură-te unei partide» with the code from an invite (parity
 * partide.intra-cod, T6). fish: app/(app)/partide/join/[code].tsx. Reached from fish's invite link
 * https://bluvi-app.wearetribus.com/partide/join/{code} (next.config.ts redirects /partide/join/:code
 * here, partide.b.deep-link-join) and from PARTIDA_INVITE (lib/notification-href, partide.b.notif-invite).
 *
 * Signed in only: no cookie → proxy.ts answers a real 307 to /intra?next=/partide/intra/{cod}; a
 * dead cookie → requireViewer's redirect inside the Suspense boundary; either way sign-in returns
 * here. The join itself is per user (POST /feed/sessions/join through /api/cms). Never indexed.
 */

export const metadata: Metadata = {
  title: 'Alătură-te unei partide',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ cod: string }> };

export async function generateStaticParams() {
  // Codes are per partidă, unknowable at build: one placeholder for Cache Components' validation.
  return [{ cod: '_' }];
}

export default function PartidaJoinCodePage({ params }: Props) {
  return (
    <Suspense fallback={<JoinLoading />}>
      <Gated params={params} />
    </Suspense>
  );
}

/** The segment as Next hands it over is still percent-encoded («%20»); a malformed one is kept. */
function decodeSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function Gated({ params }: Props) {
  const cod = decodeSegment((await params).cod);
  await requireViewer(routes.partidaJoinCode(cod));
  return <JoinScreen cod={cod} />;
}
