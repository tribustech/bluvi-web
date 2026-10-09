import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';
import { OperatorFrame, OperatorTitleSkeleton, operatorTrail } from '../../../_shared/OperatorFrame';
import { BLOCKS_TITLE } from './model';

/**
 * The month cards' layout (c4): one column on the phone and tablet, then explicit columns that fill
 * the width — two from 1024px, three from 1700px (106.25rem: a px value would sort before lg's 64rem and lose) — never more columns than cards, so two months at
 * 1920 are two wide cards (no empty tracks). Each card is as tall as its rows (never stretched).
 */
export function sectionsGrid(count: number): string {
  return cn('grid items-start gap-x-6 gap-y-5', count >= 2 && 'lg:grid-cols-2', count >= 3 && 'min-[106.25rem]:grid-cols-3');
}
/** A month card (fish CARD_RADIUS + CARD_SHADOW, white rows with hairlines). */
export const SECTION_CARD = 'overflow-hidden rounded-card bg-surface shadow-e1';
/** The uppercase month caption over a card (fish caption, muted, letter-spacing .6). */
export const SECTION_CAPTION = 't-label px-1 pb-2 uppercase tracking-[0.05em] text-muted';

/**
 * c2 — the first load: two month cards of rows in the shape of the real ones (fish LoadingScreen is
 * a spinner; a skeleton keeps the page from jumping when the list lands).
 */
export function BlocksSkeleton() {
  return (
    <div role="status" data-testid="blocks-loading" className={sectionsGrid(2)}>
      <span className="sr-only">Se încarcă blocajele…</span>
      {[3, 2].map((n, s) => (
        <div key={s} aria-hidden>
          <span className="mx-1 mb-3 block h-3 w-28 rounded-full bg-soft-fill" />
          <div className={SECTION_CARD}>
            {Array.from({ length: n }, (_, i) => (
              <div key={i} className={cn('flex items-center gap-3 px-3.5 py-3', i > 0 && 'border-t border-hairline')}>
                <span className="size-9 shrink-0 animate-shimmer rounded-xl" />
                <span className="flex flex-1 flex-col gap-2">
                  <span className="h-3.5 w-[55%] rounded-full bg-soft-fill" />
                  <span className="h-3 w-[40%] rounded-full bg-soft-fill" />
                </span>
                <span className="size-6 shrink-0 rounded-full bg-soft-fill" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The route's first paint (the gate's Suspense fallback and loading.tsx): the real title over the
 * lake caption's bone and the list skeleton. The lake is not known on the server: Back goes to the
 * picker, which replaces itself with the single lake's panel.
 */
export function BlocksFallback() {
  return (
    <OperatorFrame
      title={BLOCKS_TITLE}
      caption={<OperatorTitleSkeleton className="h-3 w-28" />}
      back={{ fallbackHref: routes.operator() }}
      trail={operatorTrail({ label: 'Blocaje' })}
    >
      <BlocksSkeleton />
    </OperatorFrame>
  );
}
