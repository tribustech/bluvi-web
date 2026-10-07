import { describe, expect, it } from 'vitest';
import { ApiError } from '@/core/transport';
import { within } from '@/lib/server/og/images';

/* parity global.b.seo-og-images — the image cache tells «no data» from «the read failed» (images.ts). */

describe('within (an OG read, bounded)', () => {
  it('a read that answered null (a lake with no price, rule 4) is an answer, cached as the entity', async () => {
    expect(await within(Promise.resolve(null), 50)).toEqual({ ok: true, value: null });
  });

  it('a slow read is a transient failure (kept minutes, read again)', async () => {
    expect(await within(new Promise(() => {}), 10)).toEqual({ ok: false, transient: true });
  });

  it('a network / 5xx error is transient; a 4xx or a shape this build cannot parse is settled', async () => {
    const err = (status: number, code: 'NETWORK' | 'INVALID_RESPONSE' | 'HTTP') => Promise.reject(new ApiError({ message: 'x', status, code }));
    expect(await within(err(0, 'NETWORK'), 50)).toEqual({ ok: false, transient: true });
    expect(await within(err(502, 'HTTP'), 50)).toEqual({ ok: false, transient: true });
    expect(await within(err(200, 'INVALID_RESPONSE'), 50)).toEqual({ ok: false, transient: false });
    expect(await within(err(404, 'HTTP'), 50)).toEqual({ ok: false, transient: false });
  });
});
