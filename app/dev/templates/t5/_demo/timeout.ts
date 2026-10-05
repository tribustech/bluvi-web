import type { Transport, TransportRequest } from '@/core/transport';

/** A CMS that hangs must land in an error state, not keep a skeleton or a spinner up forever. */
export const CMS_TIMEOUT_MS = 8000;

/**
 * Every request of `t` aborts at `deadline`: a number = that many ms per request (client refetches);
 * an AbortSignal = one shared deadline (a server render's reads, so serial reads share the 8 s
 * instead of 8 s each). A caller's own signal still applies (whichever fires first).
 *
 * TODO(core): move to core/transport (or lib/client) so every browser transport gets a deadline;
 * this task may only touch T5.
 */
export function withTimeout(t: Transport, deadline: number | AbortSignal): Transport {
  return {
    request: <T,>(req: TransportRequest) => {
      const timeout = typeof deadline === 'number' ? AbortSignal.timeout(deadline) : deadline;
      return t.request<T>({ ...req, signal: req.signal ? AbortSignal.any([req.signal, timeout]) : timeout });
    },
  };
}
