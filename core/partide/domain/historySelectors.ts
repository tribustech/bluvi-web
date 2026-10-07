/**
 * The derived state of fish `usePartideHistory` and the history branch of `usePartidaDetail`
 * (`features/partide/domain/hooks.ts`), as pure functions over the query data.
 */
import type { SessionDetailDTO, SessionListItemDTO } from '../schemas';
import { dtoToLocalEvent, dtoToLocalSession, listItemToSummaryLocalSession } from './historyMappers';
import type { LocalEvent, LocalSession } from './types';

export type MySessionsData = { data: SessionListItemDTO[]; total: number };

/**
 * `allSessions` — COUNT list: everything the server returned, live session included (the stat
 * strip must read this one; excluding the live row froze "Ale mele"'s numbers for the whole
 * partidă). `sessions` — RENDER list: the live active session excluded, because the dock and the
 * ÎN DESFĂȘURARE card already show it.
 */
export function selectPartideHistory(
  data: MySessionsData | undefined,
  activeClientId: string | null
): { sessions: LocalSession[]; allSessions: LocalSession[] } {
  const allSessions = (data?.data ?? []).map(listItemToSummaryLocalSession).sort((a, b) => b.startedAt - a.startedAt);
  const sessions = activeClientId ? allSessions.filter(s => s.clientId !== activeClientId) : allSessions;
  return { sessions, allSessions };
}

/** The route carries only the clientId; the detail pull needs the documentId from the cached `mine` list. */
export function findMineListItem(mine: MySessionsData | undefined, clientId: string): SessionListItemDTO | null {
  return mine?.data.find(d => d.clientId === clientId) ?? null;
}

/** The web's routes carry the documentId: the viewer's own list row for it, or null (not theirs). */
export function findMineDocument(mine: MySessionsData | undefined, documentId: string): SessionListItemDTO | null {
  return mine?.data.find(d => d.documentId === documentId) ?? null;
}

/**
 * fish `useOpenPartida`'s resolution: which of MY partide (by clientId) a community documentId
 * is — the live pointer first, then the cached `mine` list. `null` → open the spectator view.
 */
export function resolveOwnPartidaClientId(
  documentId: string,
  active: { documentId: string; sessionId: string } | null,
  mine: MySessionsData | undefined
): string | null {
  if (active?.documentId === documentId) return active.sessionId;
  return mine?.data.find(d => d.documentId === documentId)?.clientId ?? null;
}

/**
 * History branch of `usePartidaDetail`: the full detail when loaded, else the lean summary row
 * while it loads. Events are mapped with the same response's roster so `photoTagUids` collapses
 * exactly like the live path.
 */
export function historyDetailView(
  clientId: string,
  listItem: SessionListItemDTO | null,
  detailData: SessionDetailDTO | undefined
): { session: LocalSession | null; events: LocalEvent[]; needsDetail: boolean } {
  const session = detailData ? dtoToLocalSession(detailData) : listItem ? listItemToSummaryLocalSession(listItem) : null;
  const roster = detailData ? detailData.members.map(m => m.uid) : [];
  const events = detailData
    ? [...detailData.events].map(e => dtoToLocalEvent(e, clientId, roster)).sort((a, b) => a.occurredAt - b.occurredAt)
    : [];
  return { session, events, needsDetail: !!listItem?.documentId && !detailData };
}
