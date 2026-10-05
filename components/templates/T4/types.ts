/**
 * T4 «Multi-step form» — shared shapes (ROADMAP §4: create competition, booking, registration,
 * walk-in, review).
 */

/**
 * Where a step stands. `done` = valid and left behind; `current` = on screen; `error` = visited
 * and failed its validation (the stepper says so before the user gets back to it); `upcoming` =
 * not reached yet.
 */
export type T4StepState = 'done' | 'current' | 'error' | 'upcoming';

export type T4Step = {
  /** Stable key (also the `?step=` value a screen may mirror in the URL). */
  id: string;
  /** Short title: «Interval și stand», «Extra», «Confirmă». The header repeats the current one. */
  title: string;
  /**
   * What was chosen there, once it is done: «Standul 7 · sâm. 11 oct., 18:00». The desktop step
   * list prints it under the title, so the left column doubles as a running summary.
   */
  summary?: string;
  state: T4StepState;
  /** The step can be jumped to (visited, or every step before it is valid). Default: done/error/current. */
  reachable?: boolean;
};

/**
 * The autosave line in the header (fish `formatAutoSaveLabel`): nothing yet, a save running, the
 * last save, a failed save (retry), or a draft kept only on this device.
 */
export type T4SaveState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; label: string }
  | { kind: 'error'; label?: string }
  | { kind: 'local'; label?: string };

/**
 * One field error, in form order: the error summary links to `#${id}` and focuses it. The summary
 * prints `message` alone when it already names the field («Alege ziua sosirii.» — a «Ziua sosirii:»
 * before it would say it twice), else «label: message» («Nume și prenume: Acest câmp este
 * obligatoriu»). `named` says which.
 */
export type T4FieldError = { id: string; label: string; message: string; named?: boolean };
