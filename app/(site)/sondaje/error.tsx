'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useEffect, useTransition } from 'react';
import { T4Gate } from '@/components/templates/T4';
import { FlowHeader, FlowLayout } from '@/components/templates/T6';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';

/**
 * The page itself failed to render (not the poll read — PollScreen has its own error gate): the
 * flow's header and the T6 danger gate with «Încearcă din nou» (model: partide/intra/error.tsx).
 */
export default function PollError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [retrying, startRetry] = useTransition();
  useEffect(() => {
    console.warn('[sondaje]', error);
  }, [error]);
  return (
    <FlowLayout header={<FlowHeader title="Sondaj" backHref={routes.home()} />} variant="bare" narrow>
      <T4Gate
        tone="danger"
        role="alert"
        icon={<ExclamationTriangleIcon />}
        title="Serverul nu răspunde"
        description="Lucrăm la asta. Încearcă din nou în câteva minute."
        actions={
          <Button onClick={() => startRetry(() => retry())} disabled={retrying} aria-busy={retrying || undefined}>
            Încearcă din nou
          </Button>
        }
      />
    </FlowLayout>
  );
}
