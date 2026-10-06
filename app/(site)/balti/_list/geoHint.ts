/*
 * «This browser had location granted last time» — a per-browser hint, so the server-rendered nearby
 * slot reserves the right box before the permission is read (lakes.home.s6, no layout shift): the
 * nearby ROW for a visitor who allowed location, the placeholder card's box otherwise. The server
 * cannot know it; a tiny inline script (GEO_HINT_SCRIPT, run while the HTML parses, before the slot
 * paints) adds a marker element to <head> when the hint is set, and the slot skeleton picks its
 * variant from `:root:has(#GEO_HINT_ID)` (HomeRow NearbySlotSkeleton). React 19 skips foreign nodes
 * in <head> on hydration. No 'use client': the server page imports the script string.
 */

export const GEO_HINT_KEY = 'bluvi:lakes-geo-granted';
export const GEO_HINT_ID = 'balti-geo-granted';

export const GEO_HINT_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(GEO_HINT_KEY)})==='1'&&!document.getElementById(${JSON.stringify(GEO_HINT_ID)})){var m=document.createElement('meta');m.id=${JSON.stringify(GEO_HINT_ID)};document.head.appendChild(m)}}catch(e){}`;

/** Keeps the hint in step with the last known permission (storage may be unavailable: ignored). */
export function writeGeoHint(granted: boolean) {
  try {
    if (granted) window.localStorage.setItem(GEO_HINT_KEY, '1');
    else window.localStorage.removeItem(GEO_HINT_KEY);
  } catch {
    // Private mode / blocked storage: the slot falls back to the placeholder's box.
  }
}
