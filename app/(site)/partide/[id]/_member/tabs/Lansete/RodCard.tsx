'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { PlayIcon, StopIcon, TrophyIcon } from '@heroicons/react/20/solid';
import { ClockIcon } from '@heroicons/react/16/solid';
import { FishIcon } from '@/components/icons/brand';
import { cn } from '@/components/ui/cn';
import { fmtCountdown, fmtDurationCompact, fmtKg, LANE_LABEL, type Lane, type LocalRod, type RodRuntime, type RodStats } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { inkOn, rodClockView } from './countdown';
import { FishHookIcon } from './FishHookIcon';
import { OutcomeButtons } from './OutcomeButtons';
import { FLASH_MS, OutcomeTakeover, pickJoke, reducedMotion, type FlashKind } from './OutcomeTakeover';

/*
 * One rod (fish features/partide/components/PartidaRodCard.tsx; parity partide.partida-lansete
 * c2–c4, c6, c9, c10): a white card with a left border in the rod's colour —
 *  - the «L{n}» badge on the rod colour, wearing an indigo ring + clock bubble when a timer is set;
 *  - the title «Stânga · 60 m» (the derived lane, or only the distance when none is honest) and,
 *    once the rod had bites, its captures, best weight (unit apart) and «{n} trăsături»;
 *  - idle: «Pornește {mm:ss}» under the title when a timer is set; running: «Timp rămas» /
 *    «Expirat» / «Se sincronizează» and the countdown, the progress bar in the rod colour, the set
 *    duration and the stop control (an expired rod gets the start pill instead: it restarts in one
 *    tap, nothing logged);
 *  - the bait line («Momeală necunoscută» when unset) and the three outcomes.
 * Rod configuration (fish: tapping the card, «Adaugă cronometru», the pencil, the gear) is the
 * mobile-only rod-config screen (partide.partida-lansete.c13, owner decision pending) — the web shows
 * no entry to it: no dead action (rule 4).
 *
 * Memoized: the board re-renders every second while a rod counts down.
 */

export type RodCardProps = {
  rod: LocalRod;
  lane: Lane | null;
  runtime: RodRuntime;
  now: number;
  provisional: boolean;
  stats: RodStats;
  /** Writes are possible (a live, followed partidă): the start / stop controls and the outcomes show. */
  actions: boolean;
  /** Offline: the controls dim; their handlers answer with the refusal toast. */
  offline: boolean;
  onCapture: () => void;
  /** true = the outcome was recorded (the takeover plays), false = refused (offline, cooldown). */
  onOutcome: (kind: FlashKind) => boolean;
  onStart: () => void;
  onStop: () => void;
};

/** «Stânga · 60 m», or «60 m» without an honest lane (fish laneCtx). */
export const rodTitle = (lane: Lane | null, distance: number) => (lane ? `${LANE_LABEL[lane]} · ${distance} m` : `${distance} m`);

export const RodCard = memo(function RodCard({ rod, lane, runtime, now, provisional, stats, actions, offline, onCapture, onOutcome, onStart, onStop }: RodCardProps) {
  const clock = rodClockView(rod, runtime, now, provisional);
  const hasTimer = rod.durationMs != null;
  const card = useRef<HTMLElement>(null);

  const [flash, setFlash] = useState<{ kind: FlashKind; joke: string; n: number } | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    [],
  );

  const fireOutcome = useCallback(
    (kind: FlashKind) => {
      // The takeover swallows the card's taps while it plays (c6) — the keyboard too.
      if (flash) return;
      if (!onOutcome(kind)) return;
      if (!reducedMotion() && card.current && typeof card.current.animate === 'function') {
        const dip = [{ transform: 'scale(1)' }, { transform: 'scale(0.985)', offset: 0.43 }, { transform: 'scale(1)' }];
        // Lost shakes the card on the beat of the fish thrash (fish cardShake).
        const shake = [0, -4, 4, -3, 3, 0].map(x => ({ transform: `translateX(${x}px)` }));
        card.current.animate(kind === 'lost' ? shake : dip, { duration: kind === 'lost' ? 525 : 230 });
      }
      if (flashTimer.current) clearTimeout(flashTimer.current);
      setFlash(f => ({ kind, joke: pickJoke(kind), n: (f?.n ?? 0) + 1 }));
      flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
    },
    [flash, onOutcome],
  );

  const title = rodTitle(lane, rod.distance);
  const badgeInk = inkOn(rod.color) === 'light' ? 'text-rank-on-dark' : 'text-rank-on-light';

  return (
    <article
      ref={card}
      data-testid="rod-card"
      data-rod={rod.index}
      data-phase={clock.phase}
      aria-label={`Lanseta L${rod.index}, ${title}`}
      className="relative flex flex-col gap-3 rounded-card border-l-[3px] bg-surface p-3.5 shadow-e1 md:p-4"
      style={{ borderLeftColor: rod.color }}
    >
      {/* header — «insignă cu inel»: the badge wears an indigo ring + clock bubble when a timer is set. */}
      <div className="flex items-center gap-2.5">
        <span data-testid="rod-badge" data-timer={hasTimer || undefined} className="relative flex size-[34px] shrink-0 items-center justify-center">
          <span className={cn('flex items-center justify-center rounded-full', hasTimer ? 'size-[34px] border-2 border-accent' : 'size-[26px]')}>
            <span className={cn('flex size-[26px] items-center justify-center rounded-full t-micro-strong', badgeInk)} style={{ backgroundColor: rod.color }}>
              L{rod.index}
            </span>
          </span>
          {hasTimer ? (
            <span aria-hidden className="absolute -right-0.5 -bottom-0.5 flex size-[15px] items-center justify-center rounded-full border-[1.5px] border-surface bg-accent text-on-accent">
              <ClockIcon className="size-2" />
            </span>
          ) : null}
        </span>

        <div className={cn('flex min-w-0 flex-1 flex-col', clock.running ? 'gap-0' : 'gap-2')}>
          <div className="flex items-center gap-1.5">
            <h3 data-testid="rod-title" className="min-w-0 shrink truncate t-body-strong">
              {title}
            </h3>
            <span className="flex-1" />
            {stats.bites > 0 ? (
              <p data-testid="rod-stats" className="flex shrink-0 items-center gap-2 t-caption text-ink-2">
                <span className="flex items-center gap-1">
                  <FishIcon size={14} className="text-accent" />
                  <span className="sr-only">Capturi: </span>
                  <span className="tabular-nums">{stats.captures}</span>
                </span>
                {stats.bestKg != null ? (
                  <span className="flex items-center gap-1">
                    <TrophyIcon aria-hidden className="size-[13px] text-medal-gold" />
                    <span className="sr-only">Cea mai mare: </span>
                    <span className="tabular-nums">{fmtKg(stats.bestKg)}</span>
                    <span className="text-muted">kg</span>
                  </span>
                ) : null}
                <span className="text-muted">{formatCount(stats.bites, 'trăsătură', 'trăsături')}</span>
              </p>
            ) : null}
          </div>

          {!clock.running && hasTimer && actions ? (
            <div className="flex items-center">
              <StartPill durationMs={rod.durationMs!} dimmed={offline} onPress={onStart} />
            </div>
          ) : null}
        </div>
      </div>

      {clock.running ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-end justify-between gap-3">
            <div data-testid="rod-countdown" data-tone={clock.tone} className="min-w-0">
              <p data-testid="rod-countdown-label" className="t-label uppercase tracking-wide text-muted">
                {clock.label}
              </p>
              <p
                data-testid="rod-countdown-value"
                data-visual-mask
                className={cn('t-display tabular-nums', clock.tone === 'danger' ? 'text-status-danger-fg' : clock.tone === 'muted' ? 'text-muted' : 'text-ink')}
              >
                {clock.value}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {hasTimer ? (
                clock.expired ? (
                  actions ? <StartPill durationMs={rod.durationMs!} dimmed={offline} onPress={onStart} /> : null
                ) : (
                  <span className="t-body tabular-nums text-ink-2">
                    <span className="sr-only">Durata cronometrului: </span>
                    {fmtCountdown(rod.durationMs!)}
                  </span>
                )
              ) : null}
              {/* Stop only while the countdown still runs: an expired rod exits by a recast or an outcome. */}
              {!clock.expired && actions ? (
                <button
                  type="button"
                  data-testid="rod-stop"
                  aria-label="Oprește cronometrul"
                  aria-disabled={offline || undefined}
                  onClick={onStop}
                  className={cn(
                    'flex size-9 cursor-pointer items-center justify-center rounded-control bg-status-danger-bg text-status-danger-fg transition-[filter,opacity] duration-(--duration-fast) hover:brightness-95 active:opacity-60',
                    offline && 'opacity-50',
                  )}
                >
                  <StopIcon aria-hidden className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-soft-fill">
            <div data-testid="rod-progress" className="h-full rounded-full" style={{ width: `${clock.progress * 100}%`, backgroundColor: rod.color }} />
          </div>
        </div>
      ) : null}

      <BaitLine bait={rod.bait} />

      {actions ? (
        // Pushed to the card's foot: side by side on desktop, the outcomes of a row line up.
        <div className="mt-auto">
          <OutcomeButtons dimmed={offline} onBlank={() => fireOutcome('blank')} onLost={() => fireOutcome('lost')} onCapture={onCapture} />
        </div>
      ) : null}

      {flash ? <OutcomeTakeover key={flash.n} kind={flash.kind} joke={flash.joke} /> : null}
    </article>
  );
});

/** «Pornește 30:00» — one pill, two homes: the idle card and the expired countdown row. */
function StartPill({ durationMs, dimmed, onPress }: { durationMs: number; dimmed: boolean; onPress: () => void }) {
  return (
    <button
      type="button"
      data-testid="rod-start"
      aria-disabled={dimmed || undefined}
      onClick={onPress}
      className={cn(
        'inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3.5 t-label text-on-accent transition-[filter,opacity] duration-(--duration-fast) hover:brightness-95 active:opacity-80',
        dimmed && 'opacity-50',
      )}
    >
      <PlayIcon aria-hidden className="size-3" />
      <span>
        Pornește <span className="sr-only">cronometrul </span>
        <span className="tabular-nums">{fmtDurationCompact(durationMs)}</span>
      </span>
    </button>
  );
}

/** The bait, emphasised with a hook; unset bait reads «Momeală necunoscută». */
function BaitLine({ bait }: { bait: string }) {
  const known = bait.trim().length > 0;
  return (
    <p data-testid="rod-bait" className="flex min-w-0 items-center gap-2">
      <FishHookIcon size={16} className="shrink-0 text-muted" />
      <span className="sr-only">Momeală: </span>
      <span className={cn('truncate', known ? 't-body-strong text-ink-2' : 't-body italic text-muted')}>{known ? bait : 'Momeală necunoscută'}</span>
    </p>
  );
}
