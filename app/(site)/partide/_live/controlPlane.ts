'use client';

import {
  createSession,
  deleteEventByClientId,
  eventToUpsertBody,
  extendSession,
  finishSession,
  joinSession,
  kickSessionMember,
  leaveSession,
  patchRods,
  patchSession,
  rotateSessionJoinCode,
  sessionToUpsertBody,
  upsertEvent,
} from '@/core/partide';
import { partide } from '@/core/realtime';
import type { Transport } from '@/core/transport';
import { localKeyValueStorage } from './storage';
import { liveClock } from './serverClock';

/*
 * The live session's control plane (fish services/api/partide via core/realtime/partide
 * createPartideSessionRepo): every write of a live partidă is an HTTP call to the CMS
 * /feed/sessions/* through the /api/cms proxy (the httpOnly session cookie). Postgres is the truth;
 * the CMS rebuilds the Firestore projection the listener reads. Nothing here writes to Firestore.
 */
export function controlPlane(t: Transport): partide.PartideControlPlane {
  return {
    createSession: session => createSession(t, sessionToUpsertBody(session)),
    joinSession: code => joinSession(t, code),
    finishSession: documentId => finishSession(t, documentId),
    extendSession: documentId => extendSession(t, documentId),
    leaveSession: <T,>(documentId: string) => leaveSession(t, documentId) as Promise<T>,
    kickSessionMember: <T,>(documentId: string, target: string) => kickSessionMember(t, documentId, target) as Promise<T>,
    rotateSessionJoinCode: <T,>(documentId: string) => rotateSessionJoinCode(t, documentId) as Promise<T>,
    upsertEvent: (documentId, event) => upsertEvent(t, documentId, eventToUpsertBody(event)),
    deleteEventByClientId: (documentId, clientId) => deleteEventByClientId(t, documentId, clientId),
    patchSession: (documentId, meta) => patchSession(t, documentId, meta),
    patchRods: (documentId, rods) => patchRods(t, documentId, rods),
  };
}

/** The repo bound to the browser's pointer storage, the CMS and the server clock. */
export function createLiveRepo(t: Transport): partide.PartideSessionRepo {
  return partide.createPartideSessionRepo({
    storage: localKeyValueStorage,
    api: controlPlane(t),
    noteServerNow: iso => liveClock.noteServerNow(iso),
  });
}
