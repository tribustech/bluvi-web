'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { ListError } from '@/components/templates/T1';
import { NewsListFrame } from './_list/NewsList';

/**
 * Retries this boundary started, per page: a retry that throws again mounts a NEW error card,
 * so the count lives outside the component. An entry older than RETRY_WINDOW_MS belongs to a
 * retry that worked (a later, unrelated error starts at 1 again).
 */
const retried = new Map<string, { n: number; at: number }>();
const RETRY_WINDOW_MS = 30_000;

/**
 * A render error inside Noutăți (a failed request stays in the list's own slot): the page frame
 * with the T1 error card; «Încearcă din nou» re-renders the segment. Focus moves to the button.
 * The retry is never silent and never doubled: busy while it runs (ListError `retrying`), and a
 * retry that fails again says so with the attempt («Tot nu merge. Încercarea N.»).
 */
export default function NewsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const pathname = usePathname() ?? '/stiri';
  const [pending, start] = useTransition();
  const [attempt] = useState(() => {
    const last = retried.get(pathname);
    return last && Date.now() - last.at < RETRY_WINDOW_MS ? last.n + 1 : 1;
  });
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <NewsListFrame>
      <ListError
        title="Noutățile nu au putut fi afișate"
        description="A apărut o eroare neașteptată. Încearcă din nou; dacă persistă, scrie-ne."
        onRetry={() => {
          if (pending) return;
          retried.set(pathname, { n: attempt, at: Date.now() });
          start(() => retry());
        }}
        retrying={pending}
        attempt={attempt}
        focusOnMount
      />
    </NewsListFrame>
  );
}
