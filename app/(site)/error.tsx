'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/surfaces/StateCard';
import { Button } from '@/components/ui/Button';
import { captureException } from '@/lib/observability/report';

/** Unexpected failure of a page under the shell; the navigation stays usable. */
export default function SiteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    captureException(error, { tags: { boundary: 'site', ...(error.digest ? { digest: error.digest } : {}) } });
  }, [error]);

  return (
    <div className="px-5 py-6 md:px-6 xl:px-8 xl:py-8">
      <ErrorState
        title="Pagina nu s-a putut încărca."
        description={
          error.digest ? `Verifică conexiunea și încearcă din nou. Cod: ${error.digest}` : 'Verifică conexiunea și încearcă din nou.'
        }
        action={
          <Button size="compact" variant="secondary" onClick={() => retry()}>
            Reîncearcă
          </Button>
        }
      />
    </div>
  );
}
