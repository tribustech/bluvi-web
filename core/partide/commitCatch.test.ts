import { describe, expect, it, vi } from 'vitest';
import { ApiError, type Transport, type TransportRequest } from '../transport';
import { commitCatchWithPhoto } from './commitCatch';
import { buildLogCaptureEvent } from './domain/captureEdits';

// Adapted from fish `domain/__tests__/commitCatch.test.ts` (REST-only: documentId passed in).

const eventDTO = {
  id: 1, documentId: 'ev1', clientId: 'e1', clientUpdatedAt: null, outcome: 'capture', rodIndex: null, rodLabel: null,
  rodColor: null, bait: null, baitType: null, baitSize: null, baitFlavor: null, lane: null, distance: null, lat: null,
  lng: null, weightKg: 3, weightEstimated: false, species: 'Crap', speciesId: null, photoUrl: null, photoThumbUrl: null,
  notes: null, occurredAt: '2026-09-27T00:00:00.000Z', photoTagUids: [],
};

type Handler = (req: TransportRequest) => unknown;

function fakeTransport(handlers: { upsert?: Handler; upload?: Handler; patch?: Handler } = {}) {
  const calls: TransportRequest[] = [];
  const transport: Transport = {
    async request<T>(req: TransportRequest) {
      calls.push(req);
      let data: unknown = null;
      if (req.method === 'POST' && req.path.endsWith('/events')) data = handlers.upsert ? handlers.upsert(req) : { data: eventDTO };
      else if (req.path === '/feed/sessions/photo') data = handlers.upload ? handlers.upload(req) : { fileId: 42, url: 'u', thumbUrl: null };
      else if (req.method === 'PATCH') data = handlers.patch ? handlers.patch(req) : null;
      return { data: data as T, status: 200, headers: new Headers() };
    },
  };
  return { transport, calls };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const noSleep = { sleep: async () => {} };
const event = (photo = false) =>
  buildLogCaptureEvent('s-client', { weightKg: 3, weightEstimated: false, species: 'Crap', photoLocalUri: photo ? 'blob:x' : null }, 'e1', 1);

describe('commitCatchWithPhoto', () => {
  it('a capture WITHOUT a photo writes the catch exactly once and never uploads or patches', async () => {
    const { transport, calls } = fakeTransport();
    await commitCatchWithPhoto(transport, 'S', event(), { isNew: true });
    await flush();
    expect(calls.map(c => [c.method, c.path])).toEqual([['POST', '/feed/sessions/S/events']]);
    expect((calls[0].body as { data: { photo?: null } }).data.photo).toBeNull(); // explicit detach/no-op
  });

  it('writes the catch, then uploads and PATCHes ONLY the photo field onto the event documentId', async () => {
    const { transport, calls } = fakeTransport();
    const onPhotoAttached = vi.fn();
    await commitCatchWithPhoto(transport, 'S', event(true), { isNew: true, photoFile: new Blob(['x']), onPhotoAttached });
    await flush();
    await flush();
    expect(calls.map(c => [c.method, c.path])).toEqual([
      ['POST', '/feed/sessions/S/events'],
      ['POST', '/feed/sessions/photo'],
      ['PATCH', '/feed/sessions/S/events/ev1'],
    ]);
    expect(calls[2].body).toEqual({ data: { photo: 42 } });
    expect(onPhotoAttached).toHaveBeenCalledOnce();
  });

  it('resolves when the catch write lands, without waiting for the photo upload', async () => {
    let releaseUpload!: () => void;
    const gate = new Promise<void>(r => (releaseUpload = r));
    const calls: string[] = [];
    const transport: Transport = {
      async request<T>(req: TransportRequest) {
        calls.push(req.path);
        if (req.path === '/feed/sessions/photo') await gate;
        const data = req.path.endsWith('/events') ? { data: eventDTO } : { fileId: 1, url: 'u' };
        return { data: data as T, status: 200, headers: new Headers() };
      },
    };
    await commitCatchWithPhoto(transport, 'S', event(true), { isNew: true, photoFile: new Blob(['x']) });
    expect(calls).toContain('/feed/sessions/S/events');
    releaseUpload();
  });

  it('reports an upload failure through onBackgroundError, skips the PATCH, and does not throw', async () => {
    const { transport, calls } = fakeTransport({ upload: () => { throw new Error('upload down'); } });
    const onBackgroundError = vi.fn();
    await expect(commitCatchWithPhoto(transport, 'S', event(true), { isNew: true, photoFile: new Blob(['x']), onBackgroundError })).resolves.toBeUndefined();
    await flush();
    await flush();
    expect(onBackgroundError).toHaveBeenCalledOnce();
    expect(calls.some(c => c.method === 'PATCH')).toBe(false);
  });

  it('surfaces a write rejection exactly once — through the promise, never onBackgroundError', async () => {
    const { transport } = fakeTransport({ upsert: () => { throw new ApiError({ message: 'x', status: 400, code: 'HTTP' }); } });
    const onBackgroundError = vi.fn();
    await expect(
      commitCatchWithPhoto(transport, 'S', event(true), { isNew: true, photoFile: new Blob(['x']), photoTagUidsPatch: ['a'], onBackgroundError, retry: noSleep })
    ).rejects.toMatchObject({ status: 400 });
    await flush();
    expect(onBackgroundError).not.toHaveBeenCalled();
  });

  it('PATCHes tags independently — a tags-only edit never touches the photo endpoint', async () => {
    const { transport, calls } = fakeTransport();
    await commitCatchWithPhoto(transport, 'S', event(), { isNew: false, photoTagUidsPatch: ['u1', 'u2'] });
    await flush();
    await flush();
    expect(calls.map(c => [c.method, c.path])).toEqual([
      ['POST', '/feed/sessions/S/events'],
      ['PATCH', '/feed/sessions/S/events/ev1'],
    ]);
    expect(calls[1].body).toEqual({ data: { photoTagUids: ['u1', 'u2'] } });
  });

  it('retries a transient catch write but not a 4xx', async () => {
    let n = 0;
    const flaky = fakeTransport({
      upsert: () => {
        n += 1;
        if (n === 1) throw new ApiError({ message: 'x', status: 0, code: 'NETWORK' });
        return { data: eventDTO };
      },
    });
    await commitCatchWithPhoto(flaky.transport, 'S', event(), { isNew: true, retry: noSleep });
    expect(n).toBe(2);

    let m = 0;
    const bad = fakeTransport({ upsert: () => { m += 1; throw new ApiError({ message: 'x', status: 422, code: 'HTTP' }); } });
    await expect(commitCatchWithPhoto(bad.transport, 'S', event(), { isNew: true, retry: noSleep })).rejects.toMatchObject({ status: 422 });
    expect(m).toBe(1);
  });
});
