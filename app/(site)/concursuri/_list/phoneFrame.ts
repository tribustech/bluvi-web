/**
 * The phone frame's class lists, shared by the client screen (./CompetitionsScreen) and the server
 * fallbacks (./CompetitionsRoute). In a plain module, not the 'use client' screen: a server
 * component importing a constant from a client module gets a client reference, not the string
 * (it rendered as «function(){throw Error(…)}» inside the phone title's class).
 */
export const PHONE_PAGE = 'max-md:pt-0 max-md:[&>div>aside]:hidden';
export const PHONE_TITLE = 'max-md:t-title1 max-md:tracking-normal';
export const PHONE_BELOW = 'max-md:mt-0';
