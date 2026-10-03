'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** fish showSuccessToast/showErrorToast: one short message, gone after 3 s. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { message, show };
}

/** Announced politely; sits above the mobile tab bar and action bar, bottom-centre on desktop. */
export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(170px+env(safe-area-inset-bottom))] z-40 flex justify-center md:bottom-8"
    >
      {message ? (
        <p className="max-w-[420px] rounded-card bg-navy px-4 py-3 text-center t-body text-lavender shadow-e2">{message}</p>
      ) : null}
    </div>
  );
}
