// Ported from fish `features/partide/domain/rodCycle.ts` (pure).
/**
 * Pure rod-cycle state machine (the timer's reduceTimer precedent):
 * idle → fishing → firing → (resolve) → ready → fishing…
 * Invariants live HERE, not in the UI: a fired rod exits via an outcome or via a
 * plain recast (`cast` from `firing` — restart with nothing logged);
 * `requestStop` on a fishing/firing rod is rejected with 'outcome-required',
 * while `forceStop` deliberately parks it at idle WITHOUT recording an outcome
 * (the Cronometre stop button, gated behind a confirm sheet).
 */
import type { AlarmSound, Outcome } from './types';
import type { LocalRod, RodRuntime } from './types';
import { effectivePhase } from './rodPhase';

export type RodAction =
  | { type: 'cast' }
  | { type: 'fired' }
  | { type: 'resolve'; outcome: Outcome; andStop?: boolean }
  | { type: 'requestStop' }
  | { type: 'forceStop' };

export type RodEffect =
  | { type: 'scheduleAlarm'; whenMs: number; sound: AlarmSound; rodIndex: number; label: string }
  | { type: 'cancelAlarm'; rodIndex: number }
  | { type: 'emitEvent'; outcome: Outcome; occurredAt: number };

export type RodCycleResult = { runtime: RodRuntime; effects: RodEffect[]; rejected?: 'outcome-required' };

const noop = (runtime: RodRuntime): RodCycleResult => ({ runtime, effects: [] });

export function reduceRodCycle(rod: LocalRod, runtime: RodRuntime, action: RodAction, now: number): RodCycleResult {
  // fishing/firing are decided against `now`, not the phase a snapshot stamped
  // with an older clock (rodPhase.ts) — except `fired`, which IS that transition.
  const phase = effectivePhase(runtime, now);
  switch (action.type) {
    case 'cast': {
      // `firing` recasts: an expired rod may be restarted straight from the card
      // WITHOUT recording an outcome (the alarm rang, nothing was there). Only a
      // rod still counting down refuses a cast.
      if (phase === 'fishing') return noop(runtime);
      // Timer-free rod: nothing to start. The UI hides «Pornește», but guard
      // here too so the invariant lives in the state machine, not the UI.
      if (rod.durationMs == null || rod.alarmSound == null) return noop(runtime);
      const whenMs = now + rod.durationMs;
      return {
        runtime: { phase: 'fishing', endEpoch: whenMs },
        effects: [{ type: 'scheduleAlarm', whenMs, sound: rod.alarmSound, rodIndex: rod.index, label: rod.label }],
      };
    }
    case 'fired':
      if (runtime.phase !== 'fishing') return noop(runtime);
      // endEpoch is CARRIED into firing (it is now in the past): the card counts
      // up from it — «Expirat −02:13» — instead of a bare "A expirat".
      return { runtime: { phase: 'firing', endEpoch: runtime.endEpoch }, effects: [] };
    case 'resolve': {
      if (phase !== 'fishing' && phase !== 'firing') return noop(runtime);
      return {
        runtime: { phase: action.andStop ? 'idle' : 'ready', endEpoch: null },
        effects: [
          { type: 'cancelAlarm', rodIndex: rod.index },
          { type: 'emitEvent', outcome: action.outcome, occurredAt: now },
        ],
      };
    }
    case 'requestStop':
      if (phase === 'fishing' || phase === 'firing') {
        return { runtime, effects: [], rejected: 'outcome-required' };
      }
      return { runtime: { phase: 'idle', endEpoch: null }, effects: [] };
    case 'forceStop':
      // Explicit "stop the rod without recording an action": cancel the OS alarm
      // and park at idle. No emitEvent — nothing is written to the journal.
      if (phase !== 'fishing' && phase !== 'firing') return noop(runtime);
      return {
        runtime: { phase: 'idle', endEpoch: null },
        effects: [{ type: 'cancelAlarm', rodIndex: rod.index }],
      };
  }
}
