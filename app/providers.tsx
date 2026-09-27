'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { getQueryClient } from '@/lib/client/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() => {
    const client = getQueryClient(() => {
      // Session died: forget everything user-scoped and let server components re-render signed out.
      client.clear();
      router.refresh();
    });
    return client;
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
