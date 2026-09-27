'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { getQueryClient } from '@/lib/client/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(() =>
    getQueryClient(() => {
      // Session died: forget everything user-scoped and let server components re-render signed out.
      queryClient.clear();
      router.refresh();
    })
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
