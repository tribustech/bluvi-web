/**
 * fish `features/partide/helpers/deepLinks.ts`.
 *
 * The link that opens a partidă for a friend (live or finished): the web's partidă page on
 * bluvi.ro, which opens the app's spectator screen where the app is installed (owner 2026-10-14:
 * bluvi.ro replaces bluvi-app.wearetribus.com). Keyed by the Strapi `documentId`, not the local
 * clientId.
 *
 * iOS: the AASA's `paths` decide which paths open the app — `/partide/*` is listed
 * (lib/app-site-association.ts); fish app/+native-intent.tsx maps /partide/{id} to its screen.
 */
export const partidaSpectateDeepLink = (documentId: string): string => `https://bluvi.ro/partide/${documentId}`;

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
 * screen for a co-op code (without the app, the web sends /partide/join/[cod] to the Partide hub).
 */
export const partidaJoinDeepLink = (joinCode: string): string => `https://bluvi.ro/partide/join/${joinCode}`;

/** fish CoopCard onInvite: the message the «Invită» share sheet carries. */
export const partidaInviteMessage = (joinCode: string): string =>
  `Hai în partida mea pe Bluvi! Folosește codul ${joinCode} sau deschide linkul: ${partidaJoinDeepLink(joinCode)}`;
