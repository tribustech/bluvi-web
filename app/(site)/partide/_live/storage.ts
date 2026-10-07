'use client';

import type { KeyValueStorage } from '@/core/realtime';

/*
 * The live layer's persistence (fish AsyncStorage): localStorage, JSON strings only — it holds the
 * active-session pointer (two ids) and nothing of the session's data. Every access is guarded: a
 * private window, blocked site data or a full quota degrade to «nothing stored», never to a crash.
 */
export const localKeyValueStorage: KeyValueStorage = {
  async get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      // Not persisted: the probe (GET /feed/sessions/active) restores it on the next load.
    }
  },
  async remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to remove.
    }
  },
};
