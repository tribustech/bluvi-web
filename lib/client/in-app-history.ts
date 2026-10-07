/*
 * fish router.canGoBack() for browsers without the Navigation API (older Safari and Firefox):
 * "is the entry before this one a page of ours, in this tab?".
 *
 * document.referrer cannot answer it: it is set once at the hard load and never follows a soft
 * navigation, so a visitor who landed from Google and soft-navigated to /intra looked "external".
 * Instead every entry carries its own position, stamped into history.state on each push/replace
 * (the app router's soft navigations included) and read back on Back/Forward, reload and bfcache:
 *   i — how many entries of ours precede it, contiguously (Back stays in the app when i > 0);
 *   a — its absolute position in the tab's history.
 * A hard load into an unstamped entry links up with the last page of ours this tab showed
 * (sessionStorage, written on install, pageshow and pagehide) only when that page sat right before
 * it; otherwise the
 * referrer decides (a full-page link of ours).
 *
 * Next's history patch passes any state carrying its own `__NA` marker straight through, and its
 * popstate handler ignores keys it does not know, so the extra key is invisible to the router.
 */

const KEY = '__bluviNav';
const LAST = 'bluvi:last-entry';

type Pos = { i: number; a: number };

let pos: Pos = { i: 0, a: 0 };
let installed = false;

const isIndex = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
const posOf = (value: unknown): Pos | null => {
  const p = value as Partial<Pos> | null | undefined;
  return p && isIndex(p.i) && isIndex(p.a) ? { i: p.i, a: p.a } : null;
};
const stateOf = (state: unknown): Pos | null => posOf((state as Record<string, unknown> | null)?.[KEY]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype;

/** The state with `p` stamped in (a non-object state is not ours to wrap and is left alone). */
const stamp = (data: unknown, p: Pos): unknown => (data == null ? { [KEY]: p } : isPlainObject(data) ? { ...data, [KEY]: p } : data);

function readLast(win: Window): Pos | null {
  try {
    return posOf(JSON.parse(win.sessionStorage.getItem(LAST) ?? 'null'));
  } catch {
    return null;
  }
}

function writeLast(win: Window): void {
  try {
    win.sessionStorage.setItem(LAST, JSON.stringify(pos));
  } catch {
    // Storage blocked: hard loads fall back to the referrer.
  }
}

/** Installs the tracker once per document (the root providers, before any navigation). */
export function installInAppHistory(win: Window = window): void {
  if (installed) return;
  installed = true;
  const { history } = win;
  const restored = stateOf(history.state);
  if (restored) {
    pos = restored;
  } else {
    // A hard load into a new entry: it is the last one of the tab.
    const a = Math.max(0, history.length - 1);
    const last = readLast(win);
    const fromUs = (last !== null && last.a === a - 1) || (a > 0 && win.document.referrer.startsWith(win.location.origin));
    pos = { i: fromUs ? (last && last.a === a - 1 ? last.i + 1 : 1) : 0, a };
  }

  const push = history.pushState;
  const replace = history.replaceState;
  history.pushState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    pos = { i: pos.i + 1, a: pos.a + 1 };
    return push.call(this, stamp(data, pos), unused, url);
  };
  history.replaceState = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
    return replace.call(this, stamp(data, stateOf(data) ?? pos), unused, url);
  };
  win.addEventListener('popstate', (e) => {
    pos = stateOf(e.state) ?? { i: 0, a: pos.a };
  });
  win.addEventListener('pageshow', () => {
    pos = stateOf(history.state) ?? pos;
    writeLast(win);
  });
  win.addEventListener('pagehide', () => writeLast(win));
  if (!restored) history.replaceState(history.state, '');
  // This document is now the tab's last page of ours (a page left before it hydrated cannot say
  // so: the record then points one entry further back, and a hard load right after it may take a
  // foreign entry for ours — Back then leaves the site instead of going home).
  writeLast(win);
}

/** fish router.canGoBack(): Back stays inside this site, in this tab. */
export function canGoBackInApp(win: Window = window): boolean {
  const nav = (win as unknown as { navigation?: { canGoBack?: boolean } }).navigation;
  if (nav && typeof nav.canGoBack === 'boolean') return nav.canGoBack;
  if (installed) return pos.i > 0;
  return win.history.length > 1 && win.document.referrer.startsWith(win.location.origin);
}

/** Tests only. */
export function resetInAppHistoryForTests(): void {
  installed = false;
  pos = { i: 0, a: 0 };
}
