'use client';

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { CONFIRM_MS, lastCaptureAgeMs, type CaptureBucket } from '@/core/partide';
import { useLivePartide } from '@/app/(site)/partide/_live';
import { routes } from '@/lib/routes';
import { CaptureSpamGuard } from './CaptureSpamGuard';
import { clearCaptureConfirmed, isCaptureConfirmed, rememberCaptureConfirmed } from './confirmToken';

/*
 * The single capture entry point for every surface (fish features/partide/scenes/useCaptureFlow.tsx:
 * the Lansete card, the Jurnal, the dock): `open(ctx)` goes to the capture page with the right
 * preselection, unless the same rod bucket logged a capture < 30 s ago — then it raises the
 * «Sigur adaugi altă captură?» confirm (`guard`, render it once in the screen) and goes only on
 * «Da, adaug» (parity partide.partida-lansete.c8). Editing an existing capture is never gated.
 * A link entry point (no JS hook in the way) is gated by the capture page itself (useSpamGate).
 */

export type CaptureOpenContext = { kind: 'rod'; rodIndex: number } | { kind: 'free' } | { kind: 'edit'; eventClientId: string };

export const bucketFor = (ctx: CaptureOpenContext): CaptureBucket | null => (ctx.kind === 'rod' ? ctx.rodIndex : ctx.kind === 'free' ? 'free' : null);

export function captureHref(documentId: string, ctx: CaptureOpenContext): string {
  return routes.partidaCapture(documentId, ctx.kind === 'rod' ? { lanseta: ctx.rodIndex } : ctx.kind === 'edit' ? { editare: ctx.eventClientId } : {});
}

/** Seconds since the last capture of `bucket` in this session when inside the 30 s window, else null. */
export function spamSecondsAgo(events: { sessionClientId: string; rodIndex: number | null; outcome: string; occurredAt: number }[], sessionClientId: string, bucket: CaptureBucket, now: number): number | null {
  const own = events.filter(e => e.sessionClientId === sessionClientId) as Parameters<typeof lastCaptureAgeMs>[0];
  const age = lastCaptureAgeMs(own, bucket, now);
  return age != null && age < CONFIRM_MS ? Math.floor(Math.max(0, age) / 1000) : null;
}

export function useCaptureFlow(documentId: string): { open: (ctx: CaptureOpenContext) => void; guard: ReactNode } {
  const router = useRouter();
  const live = useLivePartide();
  const [pending, setPending] = useState<{ ctx: CaptureOpenContext; secondsAgo: number } | null>(null);

  const open = useCallback(
    (ctx: CaptureOpenContext) => {
      const bucket = bucketFor(ctx);
      const state = live.read();
      const sessionClientId = state.active?.documentId === documentId ? state.active.sessionId : null;
      if (bucket != null && sessionClientId) {
        const secondsAgo = spamSecondsAgo(Object.values(state.events), sessionClientId, bucket, Date.now());
        if (secondsAgo != null) {
          setPending({ ctx, secondsAgo });
          return;
        }
      }
      router.push(captureHref(documentId, ctx));
    },
    [documentId, live, router],
  );

  const guard = useMemo(
    () => (
      <CaptureSpamGuard
        secondsAgo={pending?.secondsAgo ?? null}
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (!pending) return;
          const bucket = bucketFor(pending.ctx);
          if (bucket != null) rememberCaptureConfirmed(documentId, bucket);
          setPending(null);
          router.push(captureHref(documentId, pending.ctx));
        }}
      />
    ),
    [documentId, pending, router],
  );

  return { open, guard };
}

export { clearCaptureConfirmed, isCaptureConfirmed };
