/*
 * MapLibre's web worker as a bundled entry. MapLibre 6 locates its worker next to its own module
 * file (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`), which does not exist once the
 * bundler has split it into chunks, so maplibre.ts starts this entry instead.
 *
 * maplibre-gl marks its dist files side-effect free, so a bare `import '…worker.mjs'` is dropped:
 * the class is imported and, unless the module's own bootstrap already ran, started here.
 *
 * Turbopack's worker bootstrap loads the chunks asynchronously: a message the map posts before
 * MapLibre's handlers exist would be lost. The page side buffers until this «ready» arrives.
 */
import MaplibreWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs';

const scope = self as unknown as { worker?: unknown; postMessage: (message: unknown) => void };
scope.worker ??= new MaplibreWorker(self);
scope.postMessage({ __bluviMaplibreReady: true });
