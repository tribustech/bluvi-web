'use client';

import type { ReactNode } from 'react';
import { ListError } from '@/components/templates/T1';
import { cn } from '@/components/ui/cn';
import { FocusAfterRetry, markRetry } from '../_components/RetryFocus';

/*
 * The pieces every lake subpage shares around its list (galerie, capturi, clasament, standuri,
 * concursuri): the h1's id, the first read's error card and where focus goes after its retry.
 */

/** Every subpage's h1 (ListHeader `titleId`): focus lands here after a page / list retry. */
export const SUB_TITLE_ID = 'balta-sub-titlu';

const LIST_RETRY = 'sub-list';

type ReadState = { data: unknown; isError: boolean; isFetching: boolean; errorUpdateCount: number };

/**
 * The first read failed and nothing is on screen — INCLUDING while its retry runs. TanStack puts a
 * query with no data back to `pending` when it refetches, which would swap the error card (and the
 * focused «Încearcă din nou») for the skeleton: focus fell to <body>, the button's busy state was
 * never seen and a failed retry came back with focus lost. Branch on this before `isPending`.
 */
export function firstReadFailed(q: ReadState, hasData = q.data !== undefined): boolean {
  return !hasData && (q.isError || (q.isFetching && q.errorUpdateCount > 0));
}

/**
 * The kit ListError for a subpage's first read: the retry keeps its card (and focus) while it
 * runs, and on success the content takes focus on `focusTarget` (WCAG 2.4.3) — see RetryFocus.
 */
export function SubListError({
  title,
  onRetry,
  retrying,
  attempt,
  testId,
  retryKey = LIST_RETRY,
}: {
  title: string;
  onRetry: () => void;
  retrying: boolean;
  attempt: number;
  testId?: string;
  /**
   * What the retry marks for FocusAfterRetry: the list's (SubRetryFocus) by default; a block that
   * is not the page's list (the reviews' scores, the map's stands) names its own and renders
   * <FocusAfterRetry retry={retryKey} target=…/> with its content.
   */
  retryKey?: string;
}) {
  return (
    <div data-testid={testId}>
      <ListError
        title={title}
        onRetry={() => {
          markRetry(retryKey);
          onRetry();
        }}
        retrying={retrying}
        attempt={attempt}
      />
    </div>
  );
}

/**
 * Rendered with a subpage's content: after a successful list retry focus goes to `target` (the
 * section heading, else the h1), after a page retry (SubError) to the h1 — once.
 */
export function SubRetryFocus({ target = SUB_TITLE_ID }: { target?: string }) {
  return (
    <>
      <FocusAfterRetry retry={LIST_RETRY} target={target} />
      <FocusAfterRetry retry="page" target={SUB_TITLE_ID} />
    </>
  );
}

/**
 * A row of ChoiceChips that sits on the PAGE ground (galerie's filters, the rankings' period / sort
 * chips on a phone): on a surface strip, so the unselected soft-fill chips have a boundary — on the
 * page ground (#f4f5fa) soft-fill vanishes and «Foto baltă», «Luna» read as loose text. The strip
 * hugs its chips and scrolls sideways when they do not fit (`scroll`).
 * TODO(kit): a ChoiceChips `ground="page"` (outside this task) — then this strip goes.
 */
export function ChipStrip({
  children,
  scroll = false,
  fill = false,
  className,
  testId,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Run the content's full width instead of hugging the chips. */
  fill?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        'max-w-full rounded-card bg-surface p-1.5 shadow-e0',
        fill ? 'w-full' : 'w-fit',
        scroll && 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>div]:flex-nowrap',
        className,
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
