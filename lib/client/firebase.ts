'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { createRealtimeContext, type GetCustomToken, type RealtimeContext } from '@/core/realtime';

/**
 * The web's Firebase app — same project as the mobile app. Browser only, created lazily on the
 * first realtime need (chat, live partidă), so pages that never open a live surface never load it.
 * NEXT_PUBLIC_FIREBASE_ENV picks the chat database (see core/realtime/firebase.ts); an unset or
 * unknown value resolves to `local`, never to production.
 */
function firebaseApp(): FirebaseApp {
  if (getApps().length) return getApp();
  return initializeApp({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  });
}

let context: RealtimeContext | undefined;

export function getRealtimeContext(): RealtimeContext {
  context ??= createRealtimeContext(firebaseApp(), process.env.NEXT_PUBLIC_FIREBASE_ENV);
  return context;
}

/** Custom token for the signed-in user, minted by the CMS through /api/firebase-token. */
export const getCustomToken: GetCustomToken = async () => {
  const res = await fetch('/api/firebase-token', { credentials: 'same-origin', cache: 'no-store' });
  if (!res.ok) return null;
  const body = (await res.json()) as { firebaseToken?: string | null };
  return body.firebaseToken ?? null;
};
