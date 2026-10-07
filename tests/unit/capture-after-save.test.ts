import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { partideKeys } from '@/core/partide';
import { anglersKeys } from '@/core/social';
import { invalidateAfterCaptureSaved } from '@/components/partide/capture/captureWrites';

// partide.captura.c12 (fish captura.tsx finishSave → invalidateGalleries + invalidateSessionDetail).
describe('invalidateAfterCaptureSaved', () => {
  it('stales every angler gallery and exactly this partidă’s detail', async () => {
    const qc = new QueryClient();
    const keys = [anglersKeys.catches('u-1'), anglersKeys.catches('u-2'), anglersKeys.profile('u-1'), partideKeys.detail('doc-1'), partideKeys.detail('doc-2'), partideKeys.mine];
    for (const k of keys) qc.setQueryData(k, { ok: true });
    invalidateAfterCaptureSaved(qc, 'doc-1');
    const stale = (k: readonly unknown[]) => qc.getQueryState(k)?.isInvalidated;
    expect(stale(anglersKeys.catches('u-1'))).toBe(true);
    expect(stale(anglersKeys.catches('u-2'))).toBe(true);
    expect(stale(anglersKeys.profile('u-1'))).toBe(true);
    expect(stale(partideKeys.detail('doc-1'))).toBe(true);
    expect(stale(partideKeys.detail('doc-2'))).toBe(false);
  });
});
