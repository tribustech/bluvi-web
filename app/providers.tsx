'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { getQueryClient } from '@/lib/client/query-client';
import { announceSessionExpired, claimSessionDead } from '@/lib/client/session-expired';
import { routes } from '@/lib/routes';

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => {
    const client = getQueryClient(() => {
      // global.b.session-expired: one forced sign-out per burst (60 s, re-armed by a sign-in).
      if (!claimSessionDead()) return;
      // Forget everything user-scoped at once; the proxy already dropped the dead cookie, the
      // logout makes sure of it before the next page renders.
      client.clear();
      announceSessionExpired();
      const { pathname, search } = window.location;
      void fetch('/api/auth/logout', { method: 'POST' })
        .catch(() => undefined)
        .then(() => {
          // Already on /intra: stay (a next pointing at /intra would be refused anyway).
          // The shared layout (top bar) was rendered signed in: refresh it too.
          if (pathname !== '/intra' && !pathname.startsWith('/intra/')) router.replace(routes.signIn(pathname + search));
          router.refresh();
        });
    });
    return client;
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
