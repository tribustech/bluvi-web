import { networkError, type Transport, type TransportRequest } from '@/core/transport';

/**
 * A transport whose every request gives up after `ms`: the fetch is aborted when the transport
 * forwards the signal, and the request rejects with a network ApiError either way (the server's
 * cached public GETs take no signal). A CMS that accepts the connection and never answers then
 * becomes an error with a retry instead of a skeleton or a «Calculăm prețul…» that never ends.
 * TODO(core/transport): a `timeoutMs` on the transports themselves — this task may only touch T4.
 */
export function withTimeout(t: Transport, ms: number): Transport {
  return {
    request<T>(req: TransportRequest) {
      const deadline = AbortSignal.timeout(ms);
      const signal = req.signal ? AbortSignal.any([req.signal, deadline]) : deadline;
      const expired = new Promise<never>((_, reject) => {
        const fail = () => reject(networkError(req.path, new Error(`no answer within ${ms} ms`)));
        if (deadline.aborted) fail();
        else deadline.addEventListener('abort', fail, { once: true });
      });
      return Promise.race([t.request<T>({ ...req, signal }), expired]);
    },
  };
}
