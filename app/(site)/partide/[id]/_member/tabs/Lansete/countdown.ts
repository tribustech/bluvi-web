import { effectivePhase, fmtCountdown, type LocalRod, type RodRuntime } from '@/core/partide';

/*
 * A rod card's countdown, as fish features/partide/components/PartidaRodCard.tsx draws it (parity
 * partide.partida-lansete.c3 / c10, domain invariant 18, b.server-clock). Pure: the tab hands in
 * `now` from the server-corrected clock (../../../../_live liveClock) and whether the reading is
 * provisional (the projection came from the offline cache, or the clock has no server sample yet).
 *
 *  - fishing / firing are decided against `now` on every read (core effectivePhase), never the
 *    phase a snapshot froze: a deadline that passed moves the card to «Expirat» on the next tick
 *    (c10) without any write — 'firing' is derived, never stored (fish buildRuntimeMetaPatch);
 *  - an expired rod keeps counting, past zero, on minus («-00:02:13»); a firing runtime with no
 *    deadline (a session stored before the epoch was kept) reads «A expirat»;
 *  - provisional: the label is «Se sincronizează» and the number is muted — never a red «Expirat»
 *    guessed from a cache and the device clock (2026-09-22).
 */

export type RodClockView = {
  phase: RodRuntime['phase'];
  /** fishing or firing: the countdown block, the progress bar and (fishing) the stop control show. */
  running: boolean;
  /** The deadline has passed (or a firing runtime has none). */
  expired: boolean;
  /** «Timp rămas» · «Expirat» · «Se sincronizează». */
  label: 'Timp rămas' | 'Expirat' | 'Se sincronizează';
  /** «00:12:30», «-00:02:13» or «A expirat». */
  value: string;
  tone: 'ink' | 'danger' | 'muted';
  /** 0..1 — the share of the timer used (fish: at least 0.02 while fishing, 1 once expired). */
  progress: number;
};

export function rodClockView(rod: Pick<LocalRod, 'durationMs'>, runtime: RodRuntime, now: number, provisional: boolean): RodClockView {
  const phase = effectivePhase(runtime, now);
  const fishing = phase === 'fishing';
  const running = fishing || phase === 'firing';
  const remaining = fishing && runtime.endEpoch != null ? Math.max(0, runtime.endEpoch - now) : 0;
  const expired = running && (!fishing || remaining <= 0);
  // Time SINCE expiry; null on a firing runtime with no epoch.
  const overdue = expired && runtime.endEpoch != null ? Math.max(0, now - runtime.endEpoch) : null;
  const progress = running
    ? fishing && runtime.endEpoch != null && rod.durationMs != null
      ? Math.min(1, Math.max(0.02, 1 - remaining / rod.durationMs))
      : 1
    : 0;
  const label = provisional ? 'Se sincronizează' : expired ? 'Expirat' : 'Timp rămas';
  const value = expired ? (overdue != null ? `-${fmtCountdown(overdue)}` : 'A expirat') : fmtCountdown(remaining);
  const tone = provisional ? 'muted' : expired ? 'danger' : 'ink';
  return { phase, running, expired, label, value, tone, progress };
}

/** Whether any rod needs the 1 s tick: a countdown runs (or counts past zero) only on a running rod. */
export function anyRunning(runtimes: RodRuntime[], now: number): boolean {
  return runtimes.some(r => {
    const p = effectivePhase(r, now);
    return p === 'fishing' || p === 'firing';
  });
}

/** Two runtimes the card would draw the same (the overlay vs the projection, see ./useRodRuntimes). */
export function sameRuntime(a: RodRuntime, b: RodRuntime): boolean {
  const runA = a.phase === 'fishing' || a.phase === 'firing';
  const runB = b.phase === 'fishing' || b.phase === 'firing';
  if (runA !== runB) return false;
  // idle and ready draw the same card (the CMS stop parks at idle, a resolve at ready).
  return runA ? a.endEpoch === b.endEpoch : true;
}

/** Black or white ink, whichever reads better on a rod's colour (the «L1» badge; rod colours are data). */
export function inkOn(hex: string | null | undefined): 'light' | 'dark' {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  if (!m) return 'light';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // Contrast against white vs against black.
  return (1.05 / (L + 0.05)) >= (L + 0.05) / 0.05 ? 'light' : 'dark';
}
