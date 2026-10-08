'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ExclamationCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';
import { formatText } from '@/core/organizer';
import { createBrowserTransport } from '@/lib/client/transport';
import { T4Spinner } from '@/components/templates/T4';
import { ActionChip } from './ActionChip';

/*
 * organizer.rich-text-editor c5 — «Formatează cu AI» (fish rich-text-editor.tsx:160-181 +
 * services/api/ai.ts). Empty text: nothing happens. Otherwise «Se formatează...» (disabled, the
 * editor read-only meanwhile), the content is replaced with the CMS's formatted HTML, and the chip
 * reads «Formatat» or «Eroare» for 2 s before going back to idle. The status is announced politely.
 */

export type FormatStatus = 'idle' | 'loading' | 'done' | 'error';

export const FORMAT_FEEDBACK_MS = 2000;

const LABEL: Record<FormatStatus, string> = {
  idle: 'Formatează cu AI',
  loading: 'Se formatează...',
  done: 'Formatat',
  error: 'Eroare',
};

type Props = {
  /** The editor's plain text (fish editor.getText()); null while the editor is not ready. */
  getText: () => string | null;
  onFormatted: (html: string) => void;
  onStatusChange?: (status: FormatStatus) => void;
  disabled?: boolean;
};

export function AiFormatButton({ getText, onFormatted, onStatusChange, disabled = false }: Props) {
  const t = useMemo(() => createBrowserTransport(), []);
  const [status, setStatus] = useState<FormatStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const set = (next: FormatStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  const settle = (next: 'done' | 'error') => {
    set(next);
    timer.current = setTimeout(() => {
      if (mounted.current) set('idle');
    }, FORMAT_FEEDBACK_MS);
  };

  const run = async () => {
    if (status === 'loading') return;
    const text = getText();
    if (!text?.trim()) return;
    if (timer.current) clearTimeout(timer.current);
    set('loading');
    try {
      const formatted = await formatText(t, text);
      if (!mounted.current) return;
      onFormatted(formatted);
      settle('done');
    } catch {
      if (mounted.current) settle('error');
    }
  };

  const icon =
    status === 'loading' ? <T4Spinner />
    : status === 'done' ? <CheckCircleIcon aria-hidden className="text-success" />
    : status === 'error' ? <ExclamationCircleIcon aria-hidden className="text-status-danger-fg" />
    : <SparklesIcon aria-hidden />;

  return (
    <>
      <ActionChip
        icon={icon}
        onClick={() => void run()}
        disabled={disabled || status === 'loading'}
        aria-busy={status === 'loading' || undefined}
        data-testid="rte-ai"
        data-status={status}
      >
        {LABEL[status]}
      </ActionChip>
      <span role="status" className="sr-only">
        {status === 'idle' ? '' : status === 'done' ? 'Text formatat' : status === 'error' ? 'Formatarea a eșuat' : 'Se formatează textul'}
      </span>
    </>
  );
}
