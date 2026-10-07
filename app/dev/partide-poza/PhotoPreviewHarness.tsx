'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { PhotoPreviewDialog, type PhotoPreviewResult } from '@/app/(site)/partide/[id]/captura/_photo/PhotoPreviewDialog';
import { fakeLive } from '@/app/(site)/partide/_live/source';
import type { SessionMember } from '@/core/partide/domain/types';

type Shown = { bytes: number; type: string; width: number; height: number; tags: string[] | null; changed: boolean };

export function PhotoPreviewHarness() {
  const params = useSearchParams();
  const sessionId = params.get('sesiune') ?? '';
  const initialTags = params.get('etichete')?.split(',').filter(Boolean) ?? null;
  // Read after hydration: the fake lives in the browser only.
  const [members, setMembers] = useState<SessionMember[] | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of a browser-only global after mount
    setMembers((fakeLive()?.docs[sessionId]?.members as SessionMember[] | null | undefined) ?? []);
  }, [sessionId]);
  const [source, setSource] = useState<Blob | null>(null);
  const [result, setResult] = useState<Shown | null>(null);
  const [cancelled, setCancelled] = useState(0);
  // Every onDone call, counted synchronously — the «Gata» latch is proven by this staying at 1.
  const [doneCount, setDoneCount] = useState(0);

  const done = async ({ blob, tags, changed }: PhotoPreviewResult) => {
    setDoneCount(c => c + 1);
    setSource(null);
    const bitmap = await createImageBitmap(blob);
    setResult({ bytes: blob.size, type: blob.type, width: bitmap.width, height: bitmap.height, tags, changed });
    bitmap.close();
  };

  return (
    <main className="mx-auto max-w-[720px] space-y-4 px-5 py-8">
      <h1 className="t-page-title">Previzualizare poză (harness)</h1>
      <label className="block t-body">
        Alege poza
        <input
          type="file"
          accept="image/*"
          data-testid="harness-file"
          onChange={e => {
            const f = e.currentTarget.files?.[0] ?? null;
            e.currentTarget.value = '';
            setResult(null);
            setSource(f);
          }}
        />
      </label>
      <p data-testid="harness-members" data-ready={members ? '' : undefined}>
        {members?.length ?? ''}
      </p>
      <p data-testid="harness-cancelled">{cancelled}</p>
      <p data-testid="harness-done-count">{doneCount}</p>
      {result ? <pre data-testid="harness-result">{JSON.stringify(result)}</pre> : null}
      <PhotoPreviewDialog
        open={source != null}
        source={source}
        members={members ?? []}
        initialTags={initialTags}
        onDone={done}
        onCancel={() => {
          setSource(null);
          setCancelled(c => c + 1);
        }}
      />
    </main>
  );
}
