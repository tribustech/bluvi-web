import { beforeEach, describe, expect, it } from 'vitest';
import { canGoBackInApp, installInAppHistory, resetInAppHistoryForTests } from './in-app-history';

/** A tab: a session history the fake History walks, plus sessionStorage that outlives documents. */
function tab() {
  const entries: { url: string; state: unknown }[] = [];
  let index = -1;
  const storage = new Map<string, string>();
  let listeners: Record<string, ((e: { state?: unknown }) => void)[]> = {};

  const makeWindow = (referrer: string) => {
    listeners = {};
    const history = {
      get length() {
        return entries.length;
      },
      get state() {
        return entries[index]?.state ?? null;
      },
      pushState(state: unknown, _u: string, url?: string | null) {
        entries.splice(index + 1, Infinity, { url: url ?? entries[index].url, state: structuredClone(state) });
        index += 1;
      },
      replaceState(state: unknown, _u: string, url?: string | null) {
        entries[index] = { url: url ?? entries[index].url, state: structuredClone(state) };
      },
    };
    return {
      history,
      location: { origin: 'https://bluvi.ro' },
      document: { referrer },
      sessionStorage: {
        getItem: (k: string) => storage.get(k) ?? null,
        setItem: (k: string, v: string) => void storage.set(k, v),
      },
      addEventListener: (type: string, fn: (e: { state?: unknown }) => void) => {
        (listeners[type] ??= []).push(fn);
      },
    } as unknown as Window;
  };

  let win: Window;
  return {
    /** A hard navigation (new document in a new entry), optionally with the Next state the router writes. */
    load(url: string, referrer = '') {
      listeners.pagehide?.forEach((fn) => fn({}));
      entries.splice(index + 1, Infinity, { url, state: null });
      index += 1;
      resetInAppHistoryForTests();
      win = makeWindow(referrer);
      // Another site's document runs none of our code.
      if (!url.startsWith('/')) return win;
      win.history.replaceState({ __NA: true }, '');
      installInAppHistory(win);
      return win;
    },
    /** A soft navigation the app router makes (fresh state object, its own marker). */
    soft(url: string, replace = false) {
      if (replace) win.history.replaceState({ __NA: true }, '', url);
      else win.history.pushState({ __NA: true }, '', url);
    },
    back() {
      index -= 1;
      listeners.popstate?.forEach((fn) => fn({ state: entries[index].state }));
    },
    get win() {
      return win;
    },
    get url() {
      return entries[index].url;
    },
  };
}

beforeEach(() => resetInAppHistoryForTests());

describe('canGoBackInApp without the Navigation API', () => {
  it('landing from Google, then a soft navigation: Back stays in the app (the referrer is external)', () => {
    const t = tab();
    t.load('/stiri', 'https://www.google.com/');
    expect(canGoBackInApp(t.win)).toBe(false);
    t.soft('/intra');
    expect(canGoBackInApp(t.win)).toBe(true);
    // Next's own state wins nothing over ours: still stamped after a router replaceState.
    t.win.history.replaceState({ __NA: true, tree: 1 }, '');
    expect(canGoBackInApp(t.win)).toBe(true);
  });

  it('a replace keeps the index: the session-expired redirect from the landing page has no in-app Back', () => {
    const t = tab();
    t.load('/notificari', 'https://www.facebook.com/');
    t.soft('/intra?next=%2Fnotificari', true);
    expect(canGoBackInApp(t.win)).toBe(false);
  });

  it('Back restores the entry index from history.state', () => {
    const t = tab();
    t.load('/', '');
    t.soft('/stiri');
    t.soft('/intra');
    t.back();
    expect(t.url).toBe('/stiri');
    expect(canGoBackInApp(t.win)).toBe(true);
    t.back();
    expect(canGoBackInApp(t.win)).toBe(false);
  });

  it('a hard load right after a page of ours links up (typed URL, no referrer); one after a foreign page does not', () => {
    const t = tab();
    t.load('/stiri');
    t.load('/intra');
    expect(canGoBackInApp(t.win)).toBe(true);

    const u = tab();
    u.load('/stiri');
    u.load('about:blank');
    u.load('/intra');
    expect(canGoBackInApp(u.win)).toBe(false);
  });

  it('a fresh tab has nothing to go back to; a full-page link of ours does', () => {
    expect(canGoBackInApp(tab().load('/intra'))).toBe(false);
    const t = tab();
    t.load('https://www.google.com/');
    expect(canGoBackInApp(t.load('/intra', 'https://bluvi.ro/stiri'))).toBe(true);
  });

  it('the Navigation API answers when present', () => {
    const t = tab();
    const win = t.load('/stiri');
    Object.assign(win, { navigation: { canGoBack: true } });
    expect(canGoBackInApp(win)).toBe(true);
  });
});
