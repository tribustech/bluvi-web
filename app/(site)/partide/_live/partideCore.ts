/*
 * The framework-free half of core/realtime/partide that the live layer needs on every /partide
 * page — the pure modules only (live, pointer, types). Not `@/core/realtime`: its index pulls the
 * Firebase SDK (firebase/auth, firebase/firestore) into every page's bundle. The SDK loads only when
 * a live partidă is actually followed (./source.ts).
 */
export * from '@/core/realtime/partide/live';
export * from '@/core/realtime/partide/pointer';
export type * from '@/core/realtime/partide/types';
export type { AssembledSession, FirestoreCatchDoc, FirestoreMarkerDoc, FirestoreSessionMeta } from '@/core/realtime/partide/mappers';
export type { SnapshotMeta } from '@/core/realtime/partide/sessionRepo';
