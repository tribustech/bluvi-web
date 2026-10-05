'use client';

/*
 * Loads maplibre-gl in the browser with its worker wired through the bundler.
 *
 * MapLibre creates its workers with `new Worker(getWorkerUrl(), { type: 'module' })`. We give it a
 * marker URL and, for that URL only, hand back a BufferedWorker around the worker Turbopack builds
 * from maplibre-worker.ts (the `new Worker(new URL(…, import.meta.url))` form is what the bundler
 * recognises). Every other `new Worker` call goes to the browser's constructor unchanged.
 */
const WORKER_MARKER = '/__bluvi/maplibre-worker.mjs';

let loading: Promise<typeof import('maplibre-gl')> | null = null;

/**
 * The worker as MapLibre's Actor uses it (postMessage, message/error listeners, terminate), holding
 * messages back until the worker says its handlers are installed.
 */
class BufferedWorker extends EventTarget {
  private readonly worker: Worker;
  private queue: Array<[unknown, Transferable[] | undefined]> | null = [];
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  constructor() {
    super();
    // Classic, not module: Turbopack's worker bootstrap loads its chunks with importScripts().
    this.worker = new Worker(new URL('./maplibre-worker.ts', import.meta.url));
    this.worker.addEventListener('message', (e: MessageEvent) => {
      if ((e.data as { __bluviMaplibreReady?: boolean } | null)?.__bluviMaplibreReady) {
        const queued = this.queue ?? [];
        this.queue = null;
        for (const [data, transfer] of queued) this.worker.postMessage(data, transfer ?? []);
        return;
      }
      const copy = new MessageEvent('message', { data: e.data });
      this.onmessage?.(copy);
      this.dispatchEvent(copy);
    });
    this.worker.addEventListener('error', (e: ErrorEvent) => {
      this.onerror?.(e);
      this.dispatchEvent(new ErrorEvent('error', { message: e.message }));
    });
  }

  postMessage(data: unknown, transfer?: Transferable[] | StructuredSerializeOptions) {
    const list = Array.isArray(transfer) ? transfer : transfer?.transfer;
    if (this.queue) this.queue.push([data, list]);
    else this.worker.postMessage(data, list ?? []);
  }

  terminate() {
    this.worker.terminate();
  }
}

function installWorkerHook() {
  const Native = window.Worker;
  const marker = new URL(WORKER_MARKER, window.location.href).href;
  const Hooked = function (url: string | URL, options?: WorkerOptions) {
    if (new URL(String(url), window.location.href).href === marker) return new BufferedWorker();
    return new Native(url, options);
  } as unknown as typeof Worker;
  Hooked.prototype = Native.prototype;
  window.Worker = Hooked;
}

export function loadMaplibre(): Promise<typeof import('maplibre-gl')> {
  loading ??= import('maplibre-gl').then(
    (lib) => {
      installWorkerHook();
      lib.setWorkerUrl(WORKER_MARKER);
      return lib;
    },
    (error: unknown) => {
      // A failed chunk load must not stick: the next map (a retry, a remount) imports again.
      loading = null;
      throw error;
    },
  );
  return loading;
}
