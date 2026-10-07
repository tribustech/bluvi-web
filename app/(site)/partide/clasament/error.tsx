'use client';

import { useEffect, useTransition } from 'react';
import { ListError, ListPage } from '@/components/templates/T1';
import { VenueHeader } from '@/app/(site)/ape-publice/_components/venue/bits';
import { routes } from '@/lib/routes';

/**
 * A render error inside Clasamente — a failed stats read is NOT this (the screen shows its own error
 * card, c8). The header stays (back to Partide), the T1 error card with «Încearcă din nou», which
 * re-renders the segment.
 */
export default function RankingError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [pending, start] = useTransition();
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ListPage header={<VenueHeader title="Clasamente" backHref={routes.partide()} refresh={false} />}>
      <ListError
        title="Clasamentele nu au putut fi afișate."
        description="A apărut o eroare neașteptată. Încearcă din nou; dacă persistă, scrie-ne."
        onRetry={() => {
          if (!pending) start(() => retry());
        }}
        retrying={pending}
        focusOnMount
      />
    </ListPage>
  );
}
