'use client';

import { useId } from 'react';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { buildRichTextSummary } from '@/core/organizer';
import { cn } from '@/components/ui/cn';

/*
 * organizer.step-basics c4–c6 — fish RichTextPreviewCard (step-basics.tsx:27-92): the label with
 * «Editează», a helper line, then a card with the plain-text preview (≤ 3 lines, list items as
 * bullets) or «Adaugă conținut», and «Vezi mai mult» past 140 characters. The card and «Editează»
 * both open the editor for that field (the frame's ?editor=…).
 */

type Props = {
  label: string;
  required?: boolean;
  helper: string;
  value: string | undefined;
  onOpen: () => void;
  disabled?: boolean;
  testId: string;
};

export function RichTextCard({ label, required = false, helper, value, onOpen, disabled = false, testId }: Props) {
  const { preview, isExpandable, excerpt } = buildRichTextSummary(value);
  const helperId = useId();
  const excerptId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5 @4xl:row-span-3 @4xl:grid @4xl:grid-rows-subgrid" data-testid={testId} data-state={!preview ? 'empty' : isExpandable ? 'long' : 'short'}>
      <div className="flex min-h-6 items-center justify-between gap-3">
        <p className="t-label text-ink-2">
          {label}
          {required ? ' *' : ''}
        </p>
        <button
          type="button"
          onClick={onOpen}
          disabled={disabled}
          aria-label={`Editează ${label.toLowerCase()}`}
          className={cn(
            '-my-2 -mr-2 inline-flex h-10 cursor-pointer items-center gap-1 rounded-control px-2 t-label text-accent-ink',
            'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-accent-tint active:opacity-70',
            'focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50',
          )}
        >
          <PencilSquareIcon aria-hidden className="size-4" />
          Editează
        </button>
      </div>
      <p id={helperId} className="t-caption text-muted">
        {helper}
      </p>
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        // Named by the label and the state only: the clamp hides the rest of the preview from the eye,
        // not from a screen reader, so the full text (a regulation runs to pages) is never the name.
        // The description is the helper and a short excerpt.
        aria-label={`${label}${required ? ' *' : ''}: ${preview ? 'editează conținutul' : 'adaugă conținut'}`}
        aria-describedby={excerpt ? `${helperId} ${excerptId}` : helperId}
        className={cn(
          'mt-1 flex min-h-22 w-full cursor-pointer flex-col gap-2.5 rounded-card bg-surface p-3.5 text-left outline-1 -outline-offset-1 outline-hairline',
          'transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-soft-fill active:opacity-90',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60',
          !preview && 'outline-dashed outline-faint',
        )}
      >
        <span
          aria-hidden
          className={cn('t-body-strong whitespace-pre-line', preview ? 'line-clamp-3 text-ink-2' : 'text-muted')}
          data-testid={`${testId}-preview`}
        >
          {preview || 'Adaugă conținut'}
        </span>
        {preview && isExpandable ? (
          <span aria-hidden className="self-end t-label text-accent-ink">
            Vezi mai mult
          </span>
        ) : null}
        {excerpt ? (
          <span id={excerptId} hidden>
            {excerpt}
          </span>
        ) : null}
      </button>
    </div>
  );
}
