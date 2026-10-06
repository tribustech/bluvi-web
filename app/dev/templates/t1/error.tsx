'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { ListError, ListHeader, ListPage, ListTabs, type ListTab } from '@/components/templates/T1';
import { DEMO_PATH } from './StateSwitcher';

type Place = 'notStarted' | 'started' | 'completed';

/** The public places, as links: every way back stays one click away, not only the browser's. */
const TABS: ListTab<Place>[] = [
  { key: 'notStarted', label: 'Viitoare', href: DEMO_PATH },
  { key: 'started', label: 'Live', href: `${DEMO_PATH}?status=started` },
  { key: 'completed', label: 'Rezultate', href: `${DEMO_PATH}?status=completed` },
];

/**
 * The route's error boundary (a render error, not a failed request — those stay in the list's own
 * slot). It renders inside the layout's <main>, so the top bar keeps the viewer and the state band
 * keeps its marker, and it keeps the PAGE's frame too: the header with the tabs (as links), the
 * filter column's place from 1280, and the error card in the centre column where the list's own
 * error sits — one error look, one place. Focus moves to «Încearcă din nou» (re-renders the segment,
 * Next `retry`), so a keyboard user does not tab through the top bar and the state band to reach it.
 * Shown by ?state=crash.
 */
export default function T1Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const status = useSearchParams().get('status');
  const active: Place = status === 'started' || status === 'completed' ? status : 'notStarted';

  return (
    <ListPage
      header={<ListHeader title="Competiții" below={<ListTabs label="Stare concursuri" tabs={TABS} active={active} />} />}
    >
      <ListError
        title="Pagina nu a putut fi afișată"
        description="A apărut o eroare neașteptată. Încearcă din nou; dacă persistă, scrie-ne."
        onRetry={retry}
        focusOnMount
      />
    </ListPage>
  );
}
