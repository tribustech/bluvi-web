'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useId, useMemo } from 'react';
import { ListEmpty, ListError, ListFooter } from '@/components/templates/T1';
import { anglerSearchInfiniteQuery, dedupeByKey } from '@/core/social';
import { formatCount } from '@/core/realtime/chat/format';
import type { Transport } from '@/core/transport';
import { AnglerListSkeleton, AnglerRow, anglerList } from './AnglerRow';
import { SECTION_TITLE } from './BrowseSections';

const anglers = (n: number) => formatCount(n, 'pescar', 'pescari');

/**
 * Search mode (a settled term of 2+ characters) — partide.pescari c4, fish pescari.tsx:47-51,161,
 * 165, data from core anglerSearchInfiniteQuery (GET /feed/anglers/search?q=&page=&pageSize=20,
 * keyed by the trimmed term: one request per settled term, the cache answers a term seen before).
 *  - the heading «Rezultate {total}» (fish's words; the figure a separate muted element, owner
 *    rule 10), just «Rezultate» while the first page is on its way; the polite region says the
 *    count in words with the right plural («1 pescar găsit», «24 de pescari găsiți»);
 *  - rows deduplicated by documentId (the first kept), the next page as the footer nears the
 *    viewport («Mai mulți pescari» for the keyboard), «20 din 48 de pescari» over it;
 *  - nothing found: fish's «Niciun pescar găsit.»; a failed search: an error card with a retry.
 */
export function ResultsList({ t, term, viewerId }: { t: Transport; term: string; viewerId: string }) {
  const q = useInfiniteQuery(anglerSearchInfiniteQuery(t, term));
  const titleId = useId();

  const items = useMemo(
    () =>
      dedupeByKey(
        (q.data?.pages ?? []).flatMap((p) => p.data),
        (a) => a.documentId,
      ),
    [q.data],
  );
  const total = q.data?.pages[0]?.meta.pagination.total;

  let body;
  if (q.isPending) {
    body = <AnglerListSkeleton label="Se caută pescari…" />;
  } else if (q.isError && !q.data) {
    body = (
      <ListError
        title="Nu am putut căuta pescarii."
        onRetry={() => void q.refetch()}
        retrying={q.isFetching}
        attempt={q.errorUpdateCount}
      />
    );
  } else if (items.length === 0) {
    body = <ListEmpty title="Niciun pescar găsit." />;
  } else {
    body = (
      <>
        <ul aria-labelledby={titleId} className={anglerList('separate')} data-testid="search-results">
          {items.map((a) => (
            <AnglerRow key={a.documentId} item={a} isSelf={a.documentId === viewerId} look="separate" />
          ))}
        </ul>
        <ListFooter
          hasMore={!!q.hasNextPage}
          loadingMore={q.isFetchingNextPage}
          onLoadMore={() => void q.fetchNextPage()}
          error={q.isFetchNextPageError}
          errorLabel="Nu am putut încărca mai mulți pescari."
          moreLabel="Mai mulți pescari"
          shown={items.length}
          total={total}
          formatTotal={anglers}
          spinner
        />
      </>
    );
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3" data-testid="results-section">
      <h2 id={titleId} className={SECTION_TITLE}>
        Rezultate
        {total !== undefined && !q.isPending ? (
          <>
            {' '}
            <span className="ml-1 text-muted tabular-nums" data-testid="results-total">
              {total}
            </span>
          </>
        ) : null}
      </h2>
      <p aria-live="polite" className="sr-only">
        {q.isPending || total === undefined ? '' : total === 1 ? '1 pescar găsit' : `${anglers(total)} găsiți`}
      </p>
      {body}
    </section>
  );
}
