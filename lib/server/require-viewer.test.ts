import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewerState } from '@/app/(site)/_shell/session';
import type { Viewer } from './viewer';

const getViewerState = vi.fn<() => Promise<ViewerState>>();
const redirect = vi.fn((url: string) => {
  // next/navigation's redirect throws NEXT_REDIRECT and never returns.
  throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${url};307;` });
});

vi.mock('@/app/(site)/_shell/session', () => ({ getViewerState: () => getViewerState() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

const { requireViewer, SessionUnknownError } = await import('./require-viewer');

const VIEWER: Viewer = {
  id: 513,
  documentId: 'abc',
  username: 'Sim QA',
  avatarUrl: null,
  role: 'Authenticated',
  isOrganizer: false,
  ownedLakes: [],
};

describe('requireViewer (account.b.signed-out-gate)', () => {
  beforeEach(() => {
    getViewerState.mockReset();
    redirect.mockClear();
  });

  it('returns the signed-in viewer (narrowed to Viewer) and never redirects', async () => {
    getViewerState.mockResolvedValue({ ...VIEWER, ownedLakesFailed: true });
    await expect(requireViewer('/setari/profil')).resolves.toEqual(VIEWER);
    expect(redirect).not.toHaveBeenCalled();
  });

  it('CMS down or slow (session unknown): throws to the error boundary, never sends to /intra', async () => {
    getViewerState.mockResolvedValue({ status: 'unknown' });
    const gate = requireViewer('/setari/profil');
    await expect(gate).rejects.toBeInstanceOf(SessionUnknownError);
    await expect(gate).rejects.not.toThrow('NEXT_REDIRECT');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to /intra with the page as `next`', async () => {
    getViewerState.mockResolvedValue(null);
    await expect(requireViewer('/setari/profil')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/intra?next=%2Fsetari%2Fprofil');
  });

  it('keeps the query of `next`', async () => {
    getViewerState.mockResolvedValue(null);
    await expect(requireViewer('/notificari?tab=necitite')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/intra?next=%2Fnotificari%3Ftab%3Dnecitite');
  });
});
