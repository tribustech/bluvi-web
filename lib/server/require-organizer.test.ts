import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ViewerState } from '@/app/(site)/_shell/session';
import type { Viewer } from './viewer';

const getViewerState = vi.fn<() => Promise<ViewerState>>();
const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;replace;${url};307;` });
});

vi.mock('@/app/(site)/_shell/session', () => ({ getViewerState: () => getViewerState() }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }));

const { requireOrganizer } = await import('./require-organizer');
const { SessionUnknownError } = await import('./require-viewer');

const ANGLER: Viewer = { id: 7, documentId: 'u7', username: 'Pescar', avatarUrl: null, role: 'Authenticated', isOrganizer: false, ownedLakes: [] };
const ORGANIZER: Viewer = { ...ANGLER, role: 'Organizer', isOrganizer: true };

describe('requireOrganizer (organizer.b.role-gate, organizer.b.signed-out-gate)', () => {
  beforeEach(() => {
    getViewerState.mockReset();
    redirect.mockClear();
  });

  it('lets an Organizer in', async () => {
    getViewerState.mockResolvedValue({ ...ORGANIZER, ownedLakesFailed: false });
    await expect(requireOrganizer('/organizator')).resolves.toEqual({ allowed: true, viewer: ORGANIZER });
  });

  it('answers «not allowed» for a signed-in viewer without the role — never a redirect or a throw', async () => {
    getViewerState.mockResolvedValue({ ...ANGLER, ownedLakesFailed: false });
    await expect(requireOrganizer('/organizator')).resolves.toEqual({ allowed: false, viewer: ANGLER });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to /intra with the page (and its query) as `next`', async () => {
    getViewerState.mockResolvedValue(null);
    await expect(requireOrganizer('/organizator/concursuri/nou/detalii?ciorna=d1')).rejects.toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/intra?next=%2Forganizator%2Fconcursuri%2Fnou%2Fdetalii%3Fciorna%3Dd1');
  });

  it('an unknown session goes to the error boundary', async () => {
    getViewerState.mockResolvedValue({ status: 'unknown' });
    await expect(requireOrganizer('/organizator')).rejects.toBeInstanceOf(SessionUnknownError);
  });
});
