import { kg } from '../../_weighing/model';
import type { WeighingRevision } from '@/core/organizer';

/*
 * «Istoric modificări» — the view model of a weighing's change log (parity organizer.scale-revisions;
 * fish app/(app)/scale/[competitionId]/revisions.tsx + components/scale/RevisionCard.tsx). Pure.
 *
 * - One session per close/reopen round (core groupRevisionsBySession), in the session order fish
 *   lists them (Object.entries over integer keys: ascending), its entries in the CMS order
 *   (createdAt ascending: the reopen, then the close).
 * - The title: «Modificarea {sesiune} [de {utilizator}]» (fish: the session's first author). A log
 *   without an author (a deleted account) drops the «[de …]» part rather than inventing a name.
 * - A reopen entry: «Motiv: …» (only when a reason was written) and «Redeschis la {dată și oră}».
 * - A close entry: «Închis la …», then the catches added («Adăugat:») and removed («Șters:») as
 *   «specie X kg» — the unit spaced from the number (owner rule 10), written as the weighing screen
 *   writes the same catch one tap away (its kg(): three fixed decimals, comma — «Crap 9,900 kg»), so a
 *   removed catch can be matched against the catch list at a glance.
 *   The unmodified catches are not listed (fish does not either).
 */

export type RevisionCatchLine = { key: string; text: string };

export type RevisionEntry =
  | { kind: 'reopen'; key: string; at: string; reason: string | null }
  | { kind: 'closed'; key: string; at: string; added: RevisionCatchLine[]; removed: RevisionCatchLine[] };

export type RevisionSession = {
  sessionId: number;
  /** «Modificarea 2 [de Andrew]». */
  title: string;
  entries: RevisionEntry[];
};

type RevisionCatch = { type: string; weight: number; catchId: string };

/** «Crap Oglindă 7,775 kg», «Crap 9,900 kg» — the weighing screen's catch list format. */
export const catchText = (c: Pick<RevisionCatch, 'type' | 'weight'>) => `${c.type} ${kg(c.weight)} kg`;

const lines = (catches: RevisionCatch[] | undefined): RevisionCatchLine[] =>
  (catches ?? []).map((c, i) => ({ key: `${c.catchId}-${i}`, text: catchText(c) }));

export function sessionTitle(sessionId: number, author: string | null | undefined): string {
  const name = author?.trim();
  return name ? `Modificarea ${sessionId} [de ${name}]` : `Modificarea ${sessionId}`;
}

export function revisionSessions(grouped: Record<number, WeighingRevision[]> | undefined): RevisionSession[] {
  if (!grouped) return [];
  return Object.entries(grouped)
    .filter(([, revisions]) => revisions.length > 0)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([sessionId, revisions]) => ({
      sessionId: Number(sessionId),
      title: sessionTitle(Number(sessionId), revisions[0].author?.username),
      entries: revisions.map((r): RevisionEntry => {
        const key = r.documentId || String(r.id);
        if (r.action === 'reopen') {
          const reason = r.state.reason?.trim();
          return { kind: 'reopen', key, at: r.createdAt, reason: reason ? reason : null };
        }
        return { kind: 'closed', key, at: r.createdAt, added: lines(r.state.added), removed: lines(r.state.removed) };
      }),
    }));
}

/** What the log adds up to (the ≥1280 summary): sessions, catches added and removed. */
export function revisionTotals(sessions: RevisionSession[]): { sessions: number; added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const s of sessions) {
    for (const e of s.entries) {
      if (e.kind !== 'closed') continue;
      added += e.added.length;
      removed += e.removed.length;
    }
  }
  return { sessions: sessions.length, added, removed };
}

/**
 * fish `new Date(createdAt).toLocaleString()` on a Romanian phone: «27.03.2026, 11:43» — in Bucharest
 * time whatever the browser's zone (the scale is used on the lake), 24 h, no seconds.
 */
export function revisionDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Bucharest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
}
