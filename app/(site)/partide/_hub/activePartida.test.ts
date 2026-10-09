// @vitest-environment jsdom
import { act, createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * The M8 follow-up «/partide hydration mismatch» (React #418), as a deterministic regression guard.
 * On a production repeat visit the shell's «Începe» pill starts the live probe, and when it has
 * answered before a streamed Partide boundary hydrates, a hook that read the probe's answer rendered
 * the hero over the server's skeleton. usePartideViewer reads the probe as `pending` while its caller
 * hydrates. The e2e (tests/e2e/partide-hub-hydration.spec.ts) cannot force this on `next dev`: there
 * the live layer's context update reaches a late boundary first, and React client-renders it instead
 * of hydrating it. Here the exact state is built: the server HTML from a cache without the probe,
 * then hydrateRoot over it with the probe already answered — no recoverable error, then the answer.
 */

const UID = 'qa-viewer';
const USER = { id: 1, documentId: UID, username: 'qa', avatarUrl: null, role: null, isOrganizer: false, ownedLakes: [], ownedLakesFailed: false };

vi.mock('../../_shell/viewer-context', async () => {
  const state = await import('../../_shell/viewer-state');
  return { ...state, useViewerState: () => USER };
});
vi.mock('@/lib/client/transport', () => ({
  createBrowserTransport: () => ({
    request: () => Promise.reject(new Error('no network in this test')),
  }),
}));

const { activePartidaKey, usePartideViewer } = await import('./activePartida');

function Probe() {
  const v = usePartideViewer();
  const text = v.kind !== 'viewer' ? v.kind : `${v.uid}:${v.active === null ? 'none' : typeof v.active === 'string' ? v.active : 'live'}`;
  return createElement('span', { 'data-testid': 'viewer' }, text);
}

const tree = (qc: QueryClient) => createElement(QueryClientProvider, { client: qc }, createElement(Probe));

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('usePartideViewer hydration', () => {
  it('the probe answered before the boundary hydrates: hydrates the server value (pending), then shows the answer — no mismatch', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const html = renderToString(tree(client()));
    expect(html).toContain(`${UID}:pending`);

    const browser = client();
    browser.setQueryData(activePartidaKey(UID), null); // «no live partidă», already in the cache
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, tree(browser), { onRecoverableError: e => recoverable.push(e) });
    });
    expect(recoverable).toEqual([]);
    expect(container.textContent).toBe(`${UID}:none`);
  });

  it('kind and uid are the session read’s, the same on both sides (no gate needed)', async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const html = renderToString(tree(client()));
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const recoverable: unknown[] = [];
    await act(async () => {
      hydrateRoot(container, tree(client()), { onRecoverableError: e => recoverable.push(e) });
    });
    expect(recoverable).toEqual([]);
    expect(container.textContent?.startsWith(`${UID}:`)).toBe(true);
  });
});
