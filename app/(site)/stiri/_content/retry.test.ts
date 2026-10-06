import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/core/transport';
import { isRetryable, withRetry } from './retry';

const err = (status: number, code: ConstructorParameters<typeof ApiError>[0]['code'] = 'HTTP') => new ApiError({ message: 'x', status, code });
const noSleep = () => Promise.resolve();

describe('home.stire.s2 home.sponsor.s2 — the main read retries a CMS blip before the error page', () => {
  it('a first-read 503 followed by a 200 resolves (one retry)', async () => {
    const read = vi.fn().mockRejectedValueOnce(err(503)).mockResolvedValueOnce('ok');
    await expect(withRetry(read, noSleep)).resolves.toBe('ok');
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('a dropped connection is retried; three failures in a row reach error.tsx', async () => {
    const read = vi.fn().mockRejectedValue(err(0, 'NETWORK'));
    await expect(withRetry(read, noSleep)).rejects.toMatchObject({ status: 0 });
    expect(read).toHaveBeenCalledTimes(3);
  });

  it('a 404 / 400 is never retried (it is «missing», notFound())', async () => {
    for (const status of [404, 400]) {
      const read = vi.fn().mockRejectedValue(err(status, 'HTTP'));
      await expect(withRetry(read, noSleep)).rejects.toMatchObject({ status });
      expect(read).toHaveBeenCalledTimes(1);
    }
    expect(isRetryable(new Error('render'))).toBe(false);
  });
});
