'use client';

import { useMemo } from 'react';
import * as partide from './partideCore';
import type { LocalEvent, LocalSession } from '@/core/partide';
import { useLivePartide } from './LivePartideProvider';

/*
 * Readings of the live state (fish features/partide/domain/hooks.ts useActivePartida +
 * the live branch of usePartidaDetail). Events are ascending by occurredAt.
 */

const eventsOf = (state: partide.LivePartideState, clientId: string): LocalEvent[] =>
  partide
    .recordValues(state.events)
    .filter(e => e.sessionClientId === clientId)
    .sort((a, b) => a.occurredAt - b.occurredAt);

/** fish useActivePartida: the running partidă (endedAt null) and its events, or null. */
export function useActivePartida(): { session: LocalSession | null; events: LocalEvent[] } {
  const { state } = useLivePartide();
  return useMemo(() => {
    const session = partide.activePartidaOf(state);
    return { session, events: session ? eventsOf(state, session.clientId) : [] };
  }, [state]);
}

/**
 * The subscribed session for a partidă page keyed by its Strapi documentId: the pointer's session
 * when the pointer names this documentId — live, or just finished by a teammate (its snapshot
 * stays authoritative). `pointer` is set as soon as the pointer is known, `session` once the first
 * snapshot landed (until then the page is «preparing», c6).
 */
export function useLiveSession(documentId: string): {
  pointer: partide.ActiveSession | null;
  session: LocalSession | null;
  events: LocalEvent[];
  reconnecting: boolean;
  fromCache: boolean;
} {
  const { state } = useLivePartide();
  return useMemo(() => {
    const pointer = state.active?.documentId === documentId ? state.active : null;
    const session = pointer ? (state.sessions[pointer.sessionId] ?? null) : null;
    return {
      pointer,
      session,
      events: session ? eventsOf(state, session.clientId) : [],
      reconnecting: state.reconnecting,
      fromCache: state.projectionFromCache,
    };
  }, [state, documentId]);
}
