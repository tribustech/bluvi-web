'use client';

import type { ReactNode } from 'react';
import { ChevronRightIcon, ShareIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { fmtKg, type LocalEvent, type LocalSession } from '@/core/partide';

/*
 * The own partidă's summary (the brief's right column; fish's InfoScene + CoopCard, read-only on
 * web — owner 2026-10-08, ROADMAP §4b rule 21): Revolut-clean cards —
 *  - the three numbers (Durată, Capturi, Cea mai mare), the unit apart from the number (rule 10);
 *  - «Pescari {n}»: the roster (avatar or initials, name or «Pescar», «Gazdă» on the host, «(tu)»);
 *  - the join code (a teammate joins with it in the app);
 *  - «Distribuie partida» (public partidă, c3) from 1280 — below it the header carries the share
 *    chip (PartidaHeader), so an action is never shown twice on one screen.
 * Finish, leave, kick, code rotation, anchor, feedback and delete are the app's (fish member screen).
 */

export type SummaryProps = {
  session: LocalSession;
  events: LocalEvent[];
  viewerUid: string | null;
  isEnded: boolean;
  /** Null until the server clock has been read in the browser (no stale static duration). */
  now: number | null;
  onShare?: () => void;
};

/** "4h 12m" — fish fmtDuration. */
const durationLabel = (ms: number) => {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(totalMin / 60)}h ${String(totalMin % 60).padStart(2, '0')}m`;
};

const CARD = 'bg-surface px-4 py-5 md:rounded-card md:px-5 md:shadow-e0 xl:p-6';

export function Summary(p: SummaryProps) {
  const { session, events, isEnded } = p;
  const captures = events.filter(e => e.outcome === 'capture');
  const weights = captures.map(e => e.weightKg).filter((w): w is number => w != null);
  const maxKg = weights.length ? Math.max(...weights) : null;
  const end = session.endedAt ?? p.now;
  const members = session.members ?? [];

  return (
    <>
      <section aria-label="Pe scurt" data-testid="partida-summary-stats" className="grid grid-cols-3 gap-2 px-4 pt-2 md:px-0 md:pt-0">
        <Figure label="Durată" value={end == null ? null : durationLabel(end - session.startedAt)} mask={!isEnded} />
        <Figure label="Capturi" value={String(captures.length)} />
        <Figure label="Cea mai mare" value={maxKg != null && maxKg > 0 ? fmtKg(maxKg) : '—'} unit={maxKg != null && maxKg > 0 ? 'kg' : undefined} />
      </section>

      {members.length ? (
        <section aria-labelledby="partida-pescari" data-testid="partida-roster" className={CARD}>
          <h2 id="partida-pescari" className="mb-2 t-title2">
            Pescari <span className="text-muted">{members.length}</span>
          </h2>
          <ul className="divide-y divide-hairline">
            {members.map(m => {
              const name = m.name ?? 'Pescar';
              const host = m.uid === session.hostUid;
              const self = m.uid === p.viewerUid;
              return (
                <li key={m.uid} data-testid="partida-roster-member" className="flex min-h-14 items-center gap-3 py-2">
                  <Avatar name={name} src={m.avatar} size={40} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate t-body-strong">
                      {name}
                      {self ? <span className="text-muted"> (tu)</span> : null}
                    </span>
                    {host ? <span className="t-caption text-muted">Gazdă</span> : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {session.joinCode && !isEnded ? (
        <section aria-labelledby="partida-cod" data-testid="partida-join-code" className={cn(CARD, 'flex flex-col gap-0.5')}>
          <h2 id="partida-cod" className="t-caption text-muted">
            Cod de acces
          </h2>
          <p className="t-stat tracking-widest text-ink tabular-nums">{session.joinCode}</p>
          <p className="t-caption text-muted">Prietenii intră în partidă cu acest cod, din aplicația Bluvi.</p>
        </section>
      ) : null}

      {p.onShare ? (
        <section aria-label="Acțiuni" data-testid="partida-actions" className={cn(CARD, 'py-3 max-xl:hidden xl:py-4')}>
          <ul className="flex flex-col">
            <Row icon={<ShareIcon />} label="Distribuie partida" onClick={p.onShare} />
          </ul>
        </section>
      ) : null}
    </>
  );
}

function Figure({ label, value, unit, mask }: { label: string; value: string | null; unit?: string; mask?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col justify-between gap-1 rounded-card bg-surface px-3 py-3 shadow-e0 xl:px-3.5 xl:py-4">
      <span className="t-caption text-muted">{label}</span>
      <span className="flex items-baseline gap-1 whitespace-nowrap" data-visual-mask={mask || undefined}>
        {value == null ? (
          <span aria-hidden className="block h-5 w-14 animate-shimmer rounded-full" />
        ) : (
          <>
            <span className="t-stat text-ink tabular-nums">{value}</span>
            {unit ? <span className="t-caption text-muted">{unit}</span> : null}
          </>
        )}
      </span>
    </div>
  );
}

function Row({ icon, label, hint, onClick, className }: { icon: ReactNode; label: string; hint?: string; onClick: () => void; className?: string }) {
  return (
    <li className={className}>
      <button
        type="button"
        onClick={onClick}
        className="-mx-2 flex w-[calc(100%+--spacing(4))] min-h-12 cursor-pointer items-center gap-3 rounded-control px-2 py-2 text-left hover:bg-page focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-accent [&>svg]:size-4.5">
          {icon}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="t-body-strong text-ink">{label}</span>
          {hint ? <span className="truncate t-caption text-muted">{hint}</span> : null}
        </span>
        <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-faint" />
      </button>
    </li>
  );
}
