'use client';

import { useEffect, useRef } from 'react';
import { isApiError } from '@/core/transport';

/*
 * The Bălți pages' read failures: the copy that matches the cause, and where focus goes after a
 * retry that worked (the lake page's RetryFocus pattern, local: WCAG 2.4.3).
 */

/** A 4xx: the connection is fine and retrying the same read will not help. */
export function isClientError(error: unknown): boolean {
  return isApiError(error) && error.status >= 400 && error.status < 500;
}

/** The error card's description: the connection line only when the network or the server failed. */
export function readErrorDescription(error: unknown): string {
  return isClientError(error) ? 'Bălțile nu sunt disponibile acum.' : 'Verifică conexiunea și încearcă din nou.';
}

/**
 * Arm it from «Încearcă din nou»; when `ready` turns true (the data arrived, the error card — and
 * its focused button — unmounted) focus moves to `target()`, but only if it was lost to <body>.
 */
export function useFocusAfterRetry(ready: boolean, target: () => HTMLElement | null) {
  const armed = useRef(false);
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });
  useEffect(() => {
    if (!ready || !armed.current) return;
    armed.current = false;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const el = targetRef.current();
    if (!el) return;
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: false });
  }, [ready]);
  return () => {
    armed.current = true;
  };
}
