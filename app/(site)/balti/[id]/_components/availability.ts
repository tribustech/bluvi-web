import { ON_WEB } from '@/lib/routes';

/*
 * Which of the lake page's targets the web already has (fish app/(app)/lakes/[lakeId]/* and the
 * partidă screens). A target the web does not have yet is never a dead link: the T3 «unavailable»
 * treatment instead — a section header action is left out, the booking CTA opens «Rezervă din
 * aplicația Bluvi», a quick tile drops into the «Curând pe web: …» line, the photos / the mini map /
 * a live partidă row / the operator card / a review's author stop being links. Flip an entry to
 * `true` in the batch that ships its route.
 * The site-wide pages (angler, partidă, start a partidă) read lib/routes.ts ON_WEB, the one switch
 * for every area.
 */
export const LAKE_ON_WEB: Record<
  'gallery' | 'catches' | 'ranking' | 'stands' | 'partide' | 'stats' | 'competitions' | 'map' | 'reviews' | 'reviewForm' | 'booking' | 'partida' | 'angler' | 'startPartida',
  boolean
> = {
  /** /balti/[id]/galerie — the hero photos and the photo pill. */
  gallery: true,
  /** /balti/[id]/capturi — every catch photo (opened from the Partide page, ?foto=). */
  catches: true,
  /** /balti/[id]/clasament — the anglers' ranking (opened from Statistici, ?perioada=). */
  ranking: true,
  /** /balti/[id]/standuri — the stand ranking (opened from Statistici, ?perioada=&sortare=). */
  stands: true,
  /** /balti/[id]/partide — the Partide tile, «Vezi tot», «Vezi toate partidele». */
  partide: true,
  /** /balti/[id]/statistici — the Statistici tile. */
  stats: true,
  /** /balti/[id]/concursuri — the Concursuri tile and «Vezi tot». */
  competitions: true,
  /** /balti/[id]/harta — the Hartă tile and the mini map. */
  map: true,
  /** /balti/[id]/recenzii — «Scrie prima recenzie» / «Vezi recenzia» / «Vezi toate …». */
  reviews: true,
  /** /balti/[id]/recenzie — add / edit the viewer's review (lakes.review-form, M3): «Adaugă o recenzie», «Editează». */
  reviewForm: true,
  /** /balti/[id]/rezerva — the booking flow (a signed-in angler on a booking-enabled lake). */
  booking: false,
  /** /partide/[id] — a live partidă row (c22: own vs spectator still to resolve there). */
  partida: ON_WEB.partida,
  /** /pescari/[id] — the operator card and a review's author (lakes.detail.c27, c29). */
  angler: ON_WEB.angler,
  /** /partide/incepe?balta= — start a partidă here (M4): the Partide page's empty state. */
  startPartida: ON_WEB.startPartida,
};

export type LakeTarget = keyof typeof LAKE_ON_WEB;

/** `href` when the web has the target, otherwise undefined (render the unavailable treatment). */
export function lakeHref(target: LakeTarget, href: string): string | undefined {
  return LAKE_ON_WEB[target] ? href : undefined;
}
