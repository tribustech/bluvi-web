import { describe, it, expect, vi } from 'vitest';
import { atLeast, isRetryableWriteError, retryWrite } from '../retryWrite';

// Injected instead of real timers: the delays are 1.5s/4s and fake timers fight
// with promise microtasks. `sleep` records what WOULD have been waited.
const recorder = () => {
  const waited: number[] = [];
  return { waited, sleep: async (ms: number) => { waited.push(ms); } };
};

describe('isRetryableWriteError', () => {
  it('retries a network failure (no status — the interceptor omits it)', () => {
    expect(isRetryableWriteError({ message: 'A apărut o eroare necunoscută.' })).toBe(true);
  });

  it('retries 5xx', () => {
    expect(isRetryableWriteError({ message: 'boom', status: 502 })).toBe(true);
  });

  it('does NOT retry 4xx, including a bluCode rejection', () => {
    expect(isRetryableWriteError({ message: 'nope', status: 403 })).toBe(false);
    expect(isRetryableWriteError({ message: 'nope', status: 400, bluCode: 'PARTIDA:RODS_INVALID' })).toBe(false);
  });

  it('does NOT retry a client-side invariant (a real Error, e.g. sessionRepo has no documentId)', () => {
    expect(isRetryableWriteError(new Error('sessionRepo: no documentId for session x'))).toBe(false);
  });
});

describe('retryWrite', () => {
  it('returns the first success without waiting', async () => {
    const { waited, sleep } = recorder();
    const fn = vi.fn().mockResolvedValue('ok');
    await expect(retryWrite(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(waited).toEqual([]);
  });

  it('retries a 5xx twice with the 1.5s/4s backoff, then succeeds', async () => {
    const { waited, sleep } = recorder();
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue('ok');
    await expect(retryWrite(fn, { sleep })).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(waited).toEqual([1500, 4000]);
  });

  it('gives up after 3 attempts and rethrows the LAST error', async () => {
    const { waited, sleep } = recorder();
    const fn = vi.fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockRejectedValueOnce({ status: 502 })
      .mockRejectedValue({ status: 504 });
    await expect(retryWrite(fn, { sleep })).rejects.toEqual({ status: 504 });
    expect(fn).toHaveBeenCalledTimes(3);
    expect(waited).toEqual([1500, 4000]);
  });

  it('does not retry a non-retryable error at all', async () => {
    const { waited, sleep } = recorder();
    const fn = vi.fn().mockRejectedValue({ status: 403 });
    await expect(retryWrite(fn, { sleep })).rejects.toEqual({ status: 403 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(waited).toEqual([]);
  });
});

describe('atLeast', () => {
  it('pads a fast success up to the floor', async () => {
    const { waited, sleep } = recorder();
    await expect(atLeast(Promise.resolve('v'), 900, sleep)).resolves.toBe('v');
    expect(waited).toEqual([900]);
  });

  it('pads a fast REJECTION too, so the curtain never strobes on error', async () => {
    const { waited, sleep } = recorder();
    await expect(atLeast(Promise.reject({ status: 500 }), 900, sleep)).rejects.toEqual({ status: 500 });
    expect(waited).toEqual([900]);
  });
});
