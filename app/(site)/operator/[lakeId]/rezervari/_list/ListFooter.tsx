'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * c8 / c11 — under the last row (fish ListFooterComponent + onEndReached):
 *  - more pages: the next one loads as the footer nears the viewport (fish onEndReachedThreshold),
 *    with «Mai multe» as the explicit control (keyboard, or a tall screen);
 *  - loading: a spinner;
 *  - the next page failed: the loaded rows stay, «Nu am putut încărca mai multe.» + «Încearcă din
 *    nou» refetches it — and the auto-load stops until then (it would hammer a dead CMS);
 *  - the last page: nothing.
 */
export function ListFooter({
  hasMore,
  loadingMore,
  error,
  onLoadMore,
}: {
  hasMore: boolean;
  loadingMore: boolean;
  error: boolean;
  onLoadMore: () => void;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const load = useRef(onLoadMore);
  useEffect(() => {
    load.current = onLoadMore;
  });
  useEffect(() => {
    const el = sentinel.current;
    if (!hasMore || loadingMore || error || !el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) load.current();
    }, { rootMargin: '400px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, error]);

  if (!hasMore && !error) return null;
  const failed = error && !loadingMore;
  // One button through every state, so a keyboard user keeps focus while a page loads or fails.
  return (
    <div ref={sentinel} data-testid="inbox-footer" className="flex flex-col items-center gap-2 py-5">
      {failed ? (
        <p role="alert" className="t-caption text-status-danger-fg">
          Nu am putut încărca mai multe.
        </p>
      ) : null}
      <Button
        variant="secondary"
        aria-disabled={loadingMore || undefined}
        aria-busy={loadingMore || undefined}
        onClick={() => {
          if (!loadingMore) onLoadMore();
        }}
      >
        {loadingMore ? (
          <span
            aria-hidden
            data-testid="inbox-footer-spinner"
            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
        ) : null}
        {loadingMore ? 'Se încarcă…' : failed ? 'Încearcă din nou' : 'Mai multe'}
      </Button>
    </div>
  );
}
