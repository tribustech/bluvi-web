'use client';

import { useEffect } from 'react';
import { DetailBackButton } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { ArticleError } from '../../stiri/_content/ArticleError';
import { HOME_CRUMB } from '../../stiri/_content/crumbs';

/** fish ErrorScreen with retry and back: the sponsor could not be read or failed to render. */
export default function SponsorError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ArticleError
      heading="Sponsorul nu a putut fi încărcat"
      digest={error.digest}
      retry={retry}
      trail={[HOME_CRUMB]}
      back={<DetailBackButton fallbackHref={routes.home()} ground="page" />}
    />
  );
}
