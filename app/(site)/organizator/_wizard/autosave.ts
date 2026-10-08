/**
 * fish helpers/createAutoSaveScheduler.ts — the wizard's debounced auto-save (500 ms): `schedule`
 * restarts the timer, `flush` runs the save now (cancelling a pending one), `cancel` drops it,
 * `setSave` swaps the save function (the provider re-binds it on every render). The web version
 * returns the save's promise from `flush`, so a caller can wait for it (fish fired and forgot).
 */
export type AutoSaveScheduler = {
  schedule: () => void;
  flush: () => Promise<void>;
  cancel: () => void;
  setSave: (save: () => Promise<void>) => void;
  /** A save is waiting for its timer. */
  pending: () => boolean;
};

/** fish CreateCompetitionContext: `createAutoSaveScheduler({ delayMs: 500 })`. */
export const AUTO_SAVE_DEBOUNCE_MS = 500;
/** fish autoSaveDraft: one retry, 5 s after a failed save (only while online). */
export const AUTO_SAVE_RETRY_MS = 5_000;

export function createAutoSaveScheduler(options: { save: () => Promise<void>; delayMs: number }): AutoSaveScheduler {
  let saveRef = options.save;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const run = () => saveRef().catch(() => {});

  return {
    schedule() {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        void run();
      }, options.delayMs);
    },
    flush() {
      cancel();
      return run();
    },
    cancel,
    setSave(save) {
      saveRef = save;
    },
    pending: () => timer !== null,
  };
}
