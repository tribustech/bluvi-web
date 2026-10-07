'use client';

import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { onSessionExpired } from '@/lib/client/session-expired';

/**
 * One toast host for every (site) page (fish showSuccessToast / showErrorToast): one short message,
 * 3 s (an error 8 s: a failed action needs time to be read), paused while hovered or while focus is
 * inside it (WCAG 2.2.1). An error also has a 40px «Închide» button. Top-centre just below the
 * sticky bar (56 / 64), so it never sits on a page's bottom action bar. Errors are role=alert on
 * the danger surface; the rest are polite.
 *
 * TODO(kit): move to components/surfaces/Toast.tsx with a /dev/kit entry, and switch
 * concursuri/[id]/_components/Toast.tsx to useSiteToast() so the site has a single host.
 */
export type ToastTone = 'neutral' | 'success' | 'danger';

type Message = { id: number; text: string; tone: ToastTone };
type Show = (text: string, tone?: ToastTone) => void;

export const TOAST_MS = 3000;
export const TOAST_DANGER_MS = 8000;

const ToastContext = createContext<Show | null>(null);

/** show(text, tone): replaces the current message. Must be used under <ToastProvider>. */
export function useSiteToast(): Show {
  const show = use(ToastContext);
  if (!show) throw new Error('useSiteToast must be used inside <ToastProvider>');
  return show;
}

const TONE: Record<ToastTone, string> = {
  neutral: 'bg-navy text-lavender',
  // The status pair's bg is translucent in dark: layered over raised so the page never shows through.
  success: 'bg-raised bg-linear-to-r from-status-success-bg to-status-success-bg text-status-success-fg',
  danger: 'bg-raised bg-linear-to-r from-status-danger-bg to-status-danger-bg text-status-danger-fg',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);
  const tone = useRef<ToastTone>('neutral');

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback(() => {
    stop();
    timer.current = setTimeout(() => setMessage(null), tone.current === 'danger' ? TOAST_DANGER_MS : TOAST_MS);
  }, [stop]);
  const dismiss = useCallback(() => {
    stop();
    setMessage(null);
  }, [stop]);

  const show = useCallback<Show>(
    (text, t = 'neutral') => {
      seq.current += 1;
      tone.current = t;
      setMessage({ id: seq.current, text, tone: t });
      start();
    },
    [start],
  );
  useEffect(() => stop, [stop]);
  // global.b.session-expired: the root providers announce a dead session here (one per burst).
  useEffect(() => onSessionExpired((text) => show(text, 'danger')), [show]);

  const isAlert = message?.tone === 'danger';

  const toast = message ? (
    <div
      key={message.id}
      onPointerEnter={stop}
      onPointerLeave={start}
      onFocus={stop}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) start();
      }}
      className={cn(
        't-body pointer-events-auto flex max-w-md items-start gap-2 rounded-card py-3 pl-4 shadow-e2',
        isAlert ? 'pr-1.5' : 'pr-4',
        'opacity-100 transition-[opacity,translate] duration-(--duration-fast) ease-fast starting:-translate-y-1 starting:opacity-0',
        TONE[message.tone],
      )}
    >
      {message.tone === 'danger' ? <ExclamationCircleIcon className="size-6 shrink-0" aria-hidden /> : null}
      {message.tone === 'success' ? <CheckCircleIcon className="size-6 shrink-0" aria-hidden /> : null}
      <p className="min-w-0 flex-1">{message.text}</p>
      {isAlert ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Închide mesajul"
          // 40px target centred on the first line (24px line, -my-2 keeps the toast's 12px padding).
          className="-my-2 flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-control transition-[background-color,opacity] duration-(--duration-fast) ease-fast hover:bg-status-danger-line active:opacity-80"
        >
          <XMarkIcon className="size-6" aria-hidden />
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <ToastContext value={show}>
      {children}
      {/* Both live regions exist before any message, so the insertion is announced. */}
      <div className="pointer-events-none fixed inset-x-4 top-16 z-toast flex flex-col items-center md:top-18">
        <div role="alert" className="flex flex-col items-center">
          {isAlert ? toast : null}
        </div>
        <div role="status" aria-live="polite" className="flex flex-col items-center">
          {isAlert ? null : toast}
        </div>
      </div>
    </ToastContext>
  );
}
