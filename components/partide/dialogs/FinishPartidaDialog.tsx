'use client';

import { ClockIcon, TrophyIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';
import { FishIcon } from '@/components/icons/brand';
import { fmtKg, pad2, type LocalEvent, type LocalSession } from '@/core/partide';
import { ConfirmSurface } from './shared';

/*
 * «Termină partida?» (parity partide.partida.c10; fish components/FinishPartidaSheet.tsx): the
 * venue · stand/anchor, a recap of three stats computed from the session (Durată «{h}h {mm}m»,
 * Capturi, «Cea mai mare» kg or «—»), fish's warning line, then «Termină partida» (red) and
 * «Continuă». No data side effects: the page owns the finish (c11).
 */

const venueLabel = (s: LocalSession) => s.lakeName ?? s.publicWaterName ?? s.manualVenueName ?? s.anchorName ?? 'Partidă';

/** "4h 12m" — fish fmtDuration. */
export const finishDurationLabel = (ms: number) => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(totalMin / 60)}h ${pad2(totalMin % 60)}m`;
};

export function finishRecap(session: LocalSession, events: LocalEvent[], now: number) {
  const captures = events.filter(e => e.outcome === 'capture');
  const weights = captures.map(e => e.weightKg).filter((w): w is number => w != null);
  const maxKg = weights.length ? Math.max(...weights) : 0;
  return {
    duration: finishDurationLabel((session.endedAt ?? now) - session.startedAt),
    captures: captures.length,
    record: maxKg > 0 ? fmtKg(maxKg) : null,
  };
}

export function FinishPartidaDialog({
  open,
  session,
  events,
  now,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  session: LocalSession;
  events: LocalEvent[];
  /** The server-corrected now (the live duration). */
  now: number;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const recap = finishRecap(session, events, now);
  const where = [venueLabel(session), session.standName ?? session.anchorName].filter(Boolean).join(' · ');
  return (
    <ConfirmSurface
      open={open}
      onClose={onClose}
      title="Termină partida?"
      pending={pending}
      confirmLabel="Termină partida"
      pendingLabel="Se termină…"
      dismissLabel="Continuă"
      onConfirm={onConfirm}
      testId="finish-dialog"
    >
      <p className="t-caption text-muted">{where}</p>
      <ul className="grid grid-cols-3 gap-2.5">
        <Stat icon={<ClockIcon className="size-4.5 text-accent" />} value={recap.duration} label="Durată" />
        <Stat icon={<FishIcon className="size-4.5 text-success" />} value={String(recap.captures)} label="Capturi" />
        <Stat
          icon={<TrophyIcon className="size-4.5 text-award" />}
          value={
            recap.record ? (
              <>
                {recap.record}
                <span className="ml-1 t-caption text-muted">kg</span>
              </>
            ) : (
              '—'
            )
          }
          label="Cea mai mare"
        />
      </ul>
      <p className="t-caption text-muted">Partida va fi arhivată în partidele tale. Cronometrele active se vor opri.</p>
    </ConfirmSurface>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <li className="flex flex-col items-center gap-1.5 rounded-card border border-hairline bg-page px-2.5 py-3.5 text-center">
      <span aria-hidden>{icon}</span>
      <span className="t-body-strong whitespace-nowrap text-ink tabular-nums">{value}</span>
      <span className="t-caption text-muted">{label}</span>
    </li>
  );
}
