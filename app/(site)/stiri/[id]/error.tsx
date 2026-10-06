'use client';

import { useEffect } from 'react';
import { DetailBackButton } from '@/components/templates/T3';
import { routes } from '@/lib/routes';
import { ArticleError } from '../_content/ArticleError';
import { NEWS_CRUMB } from '../_content/crumbs';

/**
 * The article could not be read (network, 5xx, timeout) or failed to render — fish ErrorScreen with
 * retry and back: the T3 page error, «Încearcă din nou» re-renders the segment (a new server read).
 */
export default function NewsItemError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <ArticleError
      heading="Știrea nu a putut fi încărcată"
      digest={error.digest}
      retry={retry}
      trail={[NEWS_CRUMB]}
      back={<DetailBackButton fallbackHref={routes.news()} ground="page" />}
    />
  );
}
