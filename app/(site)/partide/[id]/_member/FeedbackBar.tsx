'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ChevronRightIcon, InformationCircleIcon, LightBulbIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/components/ui/cn';
import { NUDGE_HINT_MS, NUDGE_STORAGE_KEY, nudgeThresholdMet, parseNudgedSessions, rememberNudged, wasNudged } from '@/core/partide';

/*
 * The partidă asking, once, whether anything is worth fixing (parity partide.partida.c21; fish
 * components/PartidaFeedbackBar.tsx + hooks/useFeedbackNudge.ts): a row that unrolls under the tab
 * strip, above whichever tab is open, for a LIVE partidă with ≥3 captures or ≥4 h elapsed, once per
 * partidă (the asked list in this browser's storage).
 *
 * It covers no control, so it waits to be answered instead of timing out. «Answered» means
 * touched: the X («Ascunde», a no) or a report that reached the server (a yes, `answer()` from the
 * dialog's onSent). Opening the form and backing out is not an answer — the bar stays. After the X
 * the hint «Bine. O găsești oricând în Info › Raportează o problemă.» shows for 3.5 s (fish's copy:
 * the web's entry is the summary's «Raportează o problemă»).
 */

/* The asked list lives in this browser's storage; read it as an external store. */
const UNREAD = '\u0000';
const storageListeners = new Set<() => void>();
function subscribeAsked(onChange: () => void) {
  storageListeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    storageListeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}
function readAskedRaw(): string | null {
  try {
    return window.localStorage.getItem(NUDGE_STORAGE_KEY);
  } catch {
    return null;
  }
}
function writeAsked(ids: string[]) {
  try {
    window.localStorage.setItem(NUDGE_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Not persisted: at worst the ask comes back once on the next visit.
  }
  for (const l of storageListeners) l();
}

/**
 * fish useFeedbackNudge: once per partidă, only once the trip is far enough along, until answered.
 * Hidden while the stored list is unread (rule 4).
 */
export function useFeedbackNudge({ sessionClientId, captures, elapsedMs, enabled }: { sessionClientId: string; captures: number; elapsedMs: number; enabled: boolean }) {
  const raw = useSyncExternalStore(subscribeAsked, readAskedRaw, () => UNREAD);
  const [answeredFor, setAnsweredFor] = useState<string | null>(null);
  const asked = raw === UNREAD || wasNudged(parseNudgedSessions(raw), sessionClientId);
  const visible = enabled && !asked && answeredFor !== sessionClientId && nudgeThresholdMet({ captures, elapsedMs });
  const answer = useCallback(() => {
    setAnsweredFor(sessionClientId);
    const list = parseNudgedSessions(readAskedRaw());
    if (!wasNudged(list, sessionClientId)) writeAsked(rememberNudged(list, sessionClientId));
  }, [sessionClientId]);
  return { visible, answer };
}

export function FeedbackBar({ visible, onOpen, onDismiss }: { visible: boolean; onOpen: () => void; onDismiss: () => void }) {
  const [hint, setHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const dismiss = () => {
    onDismiss();
    setHint(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHint(false), NUDGE_HINT_MS);
  };
  const open = () => {
    setHint(false);
    if (timer.current) clearTimeout(timer.current);
    onOpen();
  };
  return (
    <>
      <Collapsible open={visible && !hint}>
        <div data-testid="partida-feedback-nudge" className="flex items-center gap-1 border-b border-accent-tint-2 bg-accent-tint pr-2 md:rounded-card md:border-0 md:shadow-e0">
          <button
            type="button"
            onClick={open}
            aria-label="Trimite feedback despre partidă"
            className="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 py-2.5 pl-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent md:rounded-card"
          >
            <LightBulbIcon aria-hidden className="size-4.5 shrink-0 text-accent" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate t-label text-ink">Ceva de îmbunătățit?</span>
              <span className="truncate t-micro text-ink-2">Spune-ne ce nu merge sau ce ți-ar plăcea să existe.</span>
            </span>
            <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-accent" />
          </button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Ascunde"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-accent hover:bg-accent-tint-2 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-accent-tint-2">
              <XMarkIcon aria-hidden className="size-3.5 stroke-[2.6]" />
            </span>
          </button>
        </div>
      </Collapsible>
      <Collapsible open={hint}>
        <p role="status" data-testid="partida-feedback-hint" className="flex items-center gap-2 border-b border-hairline bg-soft-fill px-4 py-2.5 t-micro text-muted md:rounded-card md:border-0">
          <InformationCircleIcon aria-hidden className="size-3.5 shrink-0" />
          Bine. O găsești oricând în Info › Raportează o problemă.
        </p>
      </Collapsible>
    </>
  );
}

/** Unrolls from the edge it belongs to (height + opacity), not across the page (fish Collapsible). */
function Collapsible({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      className={cn(
        'grid transition-[grid-template-rows,opacity,visibility] ease-fast motion-reduce:transition-none',
        open ? 'visible grid-rows-[1fr] opacity-100 duration-240' : 'invisible grid-rows-[0fr] opacity-0 duration-180',
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}
