/*
 * Class lists shared by the rows and the skeleton, in a module with no 'use client' so the server
 * skeleton (loading.tsx, the gate's Suspense fallback) gets the strings themselves.
 */

/** The row's card (fish NotificationItem: a white card, 10 apart). */
export const ROW_CARD = 'flex items-start gap-3 rounded-card bg-surface p-3 shadow-e0 md:gap-4 md:p-4';

/** The rows' list: cards 10 apart (fish gap 10). */
export const ROWS = 'flex flex-col gap-2.5';
