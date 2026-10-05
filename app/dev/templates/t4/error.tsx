'use client';

import { useEffect } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { T4Frame, T4Gate, T4Header } from '@/components/templates/T4';
import { Button } from '@/components/ui/Button';
import { routes } from '@/lib/routes';
import { GATE_TITLE } from './BookingDemo';

/**
 * The route's error boundary: a render error (an availability shape the model helpers did not
 * expect, a throw outside the page's guarded reads), not a failed request. It renders inside the
 * layout's chrome (top bar), with the same frame and the same danger gate as the flow's own load
 * error — one error look wherever the failure happened. «Reîncearcă» re-renders the segment
 * (Next `retry`). No reserved progress band: the route error is not a step about to appear.
 */
export default function T4Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="continut" tabIndex={-1} className="scroll-mt-14 outline-none md:scroll-mt-16">
      <T4Frame
        header={
          <T4Header eyebrow="Rezervare" title={GATE_TITLE} back={{ label: 'Înapoi la bălți', href: routes.lakes() }} />
        }
      >
        <T4Gate
          tone="danger"
          role="alert"
          align="start"
          indent
          icon={<ExclamationCircleIcon />}
          title="Pagina nu a putut fi afișată"
          description="A apărut o eroare neașteptată. Reîncearcă; dacă persistă, scrie-ne."
          actions={<Button onClick={retry}>Reîncearcă</Button>}
        />
      </T4Frame>
    </main>
  );
}
