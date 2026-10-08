/**
 * fish `features/partide/helpers/deepLinks.ts`.
 *
 * Universal link that opens the read-only community spectator screen for a partidă, so a friend
 * can watch the session (live or finished). The https app-link (not the `bluvi://` scheme) opens
 * the app from messages and browsers; keyed by the Strapi `documentId`, not the local clientId.
 * The web answers the same path (parity partide.b.deep-link-spectate: /partide/comunitate/[id] →
 * /partide/[id]), so the link works wherever it is opened.
 *
 * iOS: the AASA file's `paths` decide which paths open the app — `/partide/*` must be listed there
 * (server-side, bluvi-redirect-stores) for this link to open the app on iOS.
 */
export const partidaSpectateDeepLink = (documentId: string): string =>
  `https://bluvi-app.wearetribus.com/partide/comunitate/${documentId}`;

/**
 * Whether a partidă may be shared as a spectator link.
 *
 * `visibleOnProfile: false` removes it from every public surface, so the spectator route answers
 * "Partida nu a fost găsită" — the recipient gets a dead link and the sender never finds out.
 * Absent/undefined means the default, which is visible.
 */
export const shareVisible = (session: { visibleOnProfile?: boolean | null } | null | undefined): boolean =>
  !!session && session.visibleOnProfile !== false;

/** fish `[id].tsx` onShare: the message the share sheet carries. */
export const partidaShareMessage = (documentId: string): string => `Vezi partida mea pe Bluvi 🎣 ${partidaSpectateDeepLink(documentId)}`;

/**
 * fish `components/CoopCard.tsx#partidaJoinDeepLink` — the universal link that opens the auto-join
 * screen for a co-op code (the web answers it at /partide/join/[cod] → /partide/intra/[cod]).
 */
export const partidaJoinDeepLink = (joinCode: string): string => `https://bluvi-app.wearetribus.com/partide/join/${joinCode}`;

/** fish CoopCard onInvite: the message the «Invită» share sheet carries. */
export const partidaInviteMessage = (joinCode: string): string =>
  `Hai în partida mea pe Bluvi! Folosește codul ${joinCode} sau deschide linkul: ${partidaJoinDeepLink(joinCode)}`;
