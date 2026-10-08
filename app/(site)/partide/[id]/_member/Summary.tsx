'use client';

import type { ReactNode } from 'react';
import { ChatBubbleLeftEllipsisIcon, ChevronRightIcon, MapPinIcon, ShareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { fmtKg, type LocalEvent, type LocalSession, type SessionMember } from '@/core/partide';
import { finishDurationLabel } from '@/components/partide/dialogs/FinishPartidaDialog';

/*
 * The member view's summary (the brief's right column; fish's InfoScene actions + CoopCard, which
 * the Setări tab will also carry): Revolut-clean cards —
 *  - the three numbers (Durată, Capturi, Cea mai mare), the unit apart from the number (rule 10);
 *  - «Pescari {n}»: the roster (avatar or initials, name or «Pescar», «Gazdă» on the host, «(tu)»);
 *    the owner of a live partidă can remove anyone but the host (c16);
 *  - the join code, and «Schimbă codul» for the owner of a live partidă (c17);
 *  - the actions: «Termină partida» (owner, live, synced — c2/c12), «Părăsește partida» (a member
 *    of a live partidă, c15), «Distribuie partida» (public partidă, c3), «Ajustează poziția» (live,
 *    c19), «Raportează o problemă» (always — fish: the moment something misbehaves is the moment
 *    it can still be described, c22) and, quieter, «Șterge partida» (owner, live or ended, c14).
 * Sticky beside the tabs from 1280; under the tab content below it. Below 1280 the header carries
 * «Termină» and the share chip (PartidaHeader), so the summary leaves both out there: an action is
 * never shown twice on one screen (Revolut-clean).
 */

export type SummaryProps = {
  session: LocalSession;
  events: LocalEvent[];
  viewerUid: string | null;
  isEnded: boolean;
  isOwner: boolean;
  /** The live, subscribed partidă (writes like the anchor go through its pointer). */
  isLive: boolean;
  canMutateMembership: boolean;
  canDelete: boolean;
  /** Null until the server clock has been read in the browser (no stale static duration). */
  now: number | null;
  onFinish?: () => void;
  onShare?: () => void;
  onLeave: () => void;
  onKick: (member: SessionMember) => void;
  onRotate: () => void;
  onAdjust: () => void;
  onReport: () => void;
  onDelete: () => void;
  /**
   * The numbers only: the Setări tab is open and already carries the roster, the code and every
   * action (an action is never shown twice on one screen).
   */
  statsOnly?: boolean;
};

const CARD = 'bg-surface px-4 py-5 md:rounded-card md:px-5 md:shadow-e0 xl:p-6';

export function Summary(p: SummaryProps) {
  const { session, events, isEnded, isOwner, isLive, canMutateMembership, canDelete } = p;
  const captures = events.filter(e => e.outcome === 'capture');
  const weights = captures.map(e => e.weightKg).filter((w): w is number => w != null);
  const maxKg = weights.length ? Math.max(...weights) : null;
  const end = session.endedAt ?? p.now;
  const members = session.members ?? [];
  const manageMembers = !isEnded && canMutateMembership && isOwner;
  const leaveAction = !isEnded && canMutateMembership && !isOwner;

  return (
    <>
      <section aria-label="Pe scurt" data-testid="partida-summary-stats" className="grid grid-cols-3 gap-2 px-4 pt-2 md:px-0 md:pt-0">
        <Figure label="Durată" value={end == null ? null : finishDurationLabel(end - session.startedAt)} mask={!isEnded} />
        <Figure label="Capturi" value={String(captures.length)} />
        <Figure label="Cea mai mare" value={maxKg != null && maxKg > 0 ? fmtKg(maxKg) : '—'} unit={maxKg != null && maxKg > 0 ? 'kg' : undefined} />
      </section>

      {p.statsOnly ? null : (
        <>
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
                      {manageMembers && !host ? (
                        <Button size="compact" variant="ghost" aria-label={`Elimină pe ${name}`} onClick={() => p.onKick(m)}>
                          Elimină
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {session.joinCode ? (
            <section aria-labelledby="partida-cod" data-testid="partida-join-code" className={cn(CARD, 'flex items-center gap-3')}>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <h2 id="partida-cod" className="t-caption text-muted">
                  Cod de acces
                </h2>
                <p className="t-stat tracking-widest text-ink tabular-nums">
                  {session.joinCode}
                </p>
              </div>
              {!isEnded && canMutateMembership && isOwner ? (
                <Button size="compact" variant="secondary" onClick={p.onRotate}>
                  Schimbă codul
                </Button>
              ) : null}
            </section>
          ) : null}

          <section aria-label="Acțiuni" data-testid="partida-actions" className={cn(CARD, 'flex flex-col gap-1 py-3 xl:py-4')}>
            <ul className="flex flex-col">
              {p.onShare ? <Row icon={<ShareIcon />} label="Distribuie partida" onClick={p.onShare} className="max-xl:hidden" /> : null}
              {isLive && !isEnded ? <Row icon={<MapPinIcon />} label="Ajustează poziția" hint={`${session.anchorLat.toFixed(5)}, ${session.anchorLng.toFixed(5)}`} onClick={p.onAdjust} /> : null}
              <Row icon={<ChatBubbleLeftEllipsisIcon />} label="Raportează o problemă" hint="Ceva nu merge sau ai o idee? Scrie-ne direct din partidă." onClick={p.onReport} />
            </ul>
            {p.onFinish || leaveAction ? (
              <div className={cn('flex flex-col gap-2 pt-2', !leaveAction && 'max-xl:hidden')}>
                {p.onFinish ? (
                  <Button variant="danger" block onClick={p.onFinish} className="max-xl:hidden">
                    Termină partida
                  </Button>
                ) : null}
                {leaveAction ? (
                  <Button variant="danger" block onClick={p.onLeave}>
                    Părăsește partida
                  </Button>
                ) : null}
              </div>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={p.onDelete}
                className="mt-1 inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-control t-body-strong text-status-danger-fg hover:bg-status-danger-bg focus-visible:outline-2 focus-visible:outline-accent"
              >
                <TrashIcon aria-hidden className="size-4.5" />
                Șterge partida
              </button>
            ) : null}
          </section>
        </>
      )}
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
