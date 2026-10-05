/** maplibre-gl ships no types for its worker module; its default export is the worker class. */
declare module 'maplibre-gl/dist/maplibre-gl-worker.mjs' {
  const MaplibreWorker: new (scope: unknown) => unknown;
  export default MaplibreWorker;
}
