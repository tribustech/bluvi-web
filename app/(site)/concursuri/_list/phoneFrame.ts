/**
 * The phone frame's class lists, shared by the client screen (./CompetitionsScreen) and the server
 * fallbacks (./CompetitionsRoute). In a plain module, not the 'use client' screen: a server
 * component importing a constant from a client module gets a client reference, not the string
 * (it rendered as «function(){throw Error(…)}» inside the phone title's class).
 */
export const PHONE_PAGE = 'max-md:pt-0 max-md:[&>div>aside]:hidden';
/**
 * The h1 «Concursuri»: fish's title1 on the phone; from 768 visually hidden (owner 2026-10-13: «de ce
 * duplicăm titlul?» — the top bar's active «Competiții» names the page; the h1 stays for assistive
 * tech and SEO).
 */
export const PHONE_TITLE = 'max-md:t-title1 max-md:tracking-normal md:sr-only';
export const PHONE_BELOW = 'max-md:mt-0';
