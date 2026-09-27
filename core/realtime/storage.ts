/**
 * Async key-value persistence the app injects (fish used AsyncStorage / SQLite). Values are
 * structured data: a web implementation backed by IndexedDB can store Blobs too; one backed by
 * localStorage must JSON-encode (and then cannot hold Blobs).
 */
export interface KeyValueStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}
