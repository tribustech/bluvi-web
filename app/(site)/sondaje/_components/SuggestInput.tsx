'use client';

import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { pollSuggestMutation } from '@/core/competitions';
import { isApiError } from '@/core/transport';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { track } from '@/lib/analytics';
import { createBrowserTransport } from '@/lib/client/transport';
import { useSiteToast } from '../../_shell/Toast';
import { canSuggest, SUGGEST_MAX } from './model';
import { SuggestionSentDialog } from './SuggestionSentDialog';

type Props = {
  pollId: string;
  /** Guest: the field is off and «Trimite» goes to sign-in (c10). */
  signInHref?: string;
  /** ?focus=sugestie: focus the field once (c12). */
  autoFocus?: boolean;
  className?: string;
};

/**
 * fish components/PollSuggestInput.tsx (c10–c12). Below 1024 fish's option-shaped row under the
 * options: «Sugerează o opțiune», the multi-line field «Scrie ideea ta...» (max 200) and a compact
 * «Trimite» at the right. From 1024 the same form is the aside's first card: the field a kit control
 * shell (3 lines), the counter and a full-width «Trimite» under it.
 *
 * Enter sends, Shift+Enter breaks the line. Success clears the field and opens «Sugestie trimisă!»;
 * failure toasts the CMS's own message (a bluCode error) or «Nu am putut trimite sugestia.» — the
 * transport's generic message is not the user's business here.
 */
export function SuggestInput({ pollId, signInHref, autoFocus = false, className }: Props) {
  const t = useMemo(() => createBrowserTransport(), []);
  const suggest = useMutation(pollSuggestMutation(t));
  const toast = useSiteToast();
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const counterId = `${id}-count`;
  const guest = Boolean(signInHref);
  const sending = suggest.isPending;
  const enabled = canSuggest(text, sending);

  // c12: once, when the form first mounts with the poll loaded.
  useEffect(() => {
    if (!autoFocus || guest) return;
    const el = field.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'center' });
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!enabled) return;
    const trimmed = text.trim();
    try {
      await suggest.mutateAsync({ pollId, text: trimmed });
      // fish usePollSuggest onSuccess (c15).
      track('poll_suggest', { poll_document_id: pollId, text_length: trimmed.length });
      setText('');
      field.current?.blur();
      setSent(true);
    } catch (e) {
      toast(isApiError(e) && e.bluCode && e.message ? e.message : 'Nu am putut trimite sugestia.', 'danger');
    }
  };

  // Compact beside the field on a phone (fish SubmitPill); a full-width kit button in the aside.
  const action = 'lg:h-10 lg:w-full lg:t-body-strong';

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        data-poll-suggest
        className={cn(
          'flex items-center gap-3 rounded-control border border-hairline bg-surface p-3.5',
          'lg:flex-col lg:items-stretch lg:gap-3 lg:rounded-card lg:border-0 lg:p-5 lg:shadow-e0 xl:p-6',
          !guest && 'focus-within:border-accent',
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <label htmlFor={id} className="block t-heading text-ink">
            Sugerează o opțiune
          </label>
          <textarea
            ref={field}
            id={id}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Scrie ideea ta..."
            maxLength={SUGGEST_MAX}
            rows={1}
            disabled={guest || sending}
            aria-describedby={text ? counterId : undefined}
            className={cn(
              'mt-1 block w-full resize-none bg-transparent t-body text-ink outline-none [field-sizing:content] placeholder:text-muted disabled:cursor-not-allowed',
              'lg:mt-3 lg:min-h-24 lg:rounded-control lg:border-2 lg:border-transparent lg:bg-soft-fill lg:px-3 lg:py-2.5',
              'lg:focus:border-accent lg:focus:bg-surface lg:focus:shadow-[0_0_0_4px_var(--color-accent-tint-2)]',
            )}
          />
          {guest ? <p className="mt-1 t-caption text-muted">Intră în cont ca să trimiți ideea ta.</p> : null}
          <p id={counterId} className={cn('mt-1 t-caption text-muted tabular-nums lg:text-right', !text && 'sr-only')}>
            {text ? `${text.length}/${SUGGEST_MAX}` : ''}
          </p>
        </div>
        {guest ? (
          <Link href={signInHref!} className={buttonClass({ size: 'compact', className: action })}>
            Trimite<span className="sr-only">, intră în cont ca să sugerezi o opțiune</span>
          </Link>
        ) : (
          <button
            type="submit"
            disabled={!enabled}
            aria-busy={sending || undefined}
            className={buttonClass({ size: 'compact', disabled: !enabled, className: action })}
          >
            {sending ? 'Se trimite…' : 'Trimite'}
          </button>
        )}
      </form>
      <SuggestionSentDialog open={sent} onClose={() => setSent(false)} />
    </>
  );
}
