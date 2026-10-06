import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import type { CommunityLakeSectionDTO } from '@/core/partide';
import { routes } from '@/lib/routes';
import { LakeScreen as RouteLakeScreen } from '../../../(site)/balti/[id]/_components/LakeScreen';
import type { LakeSections, Settled } from '../../../(site)/balti/[id]/_components/load';
import type { PriceFrom } from '../../../(site)/balti/[id]/_components/priceFrom';
import type { LakeScreenData } from './data';
import { LONG_TITLE, type DemoState } from './states';

/*
 * The lake screen of the T3 demo IS the route's: /balti/[id]'s own LakeScreen (and so its
 * sections, copy, summary card, quick actions, phone bar) on the QA lake Chita — the owner reviews
 * here exactly what ships. The demo states only reshape the real read: the lake (photos, booking
 * state, coordinates, operator, an empty lake, a long title) and the settled section reads (a
 * failed section, an empty one). The session states are the shell's (page.tsx: SiteShell forced).
 *
 * The demo route owns its breadcrumb band (SiteHeader OWN_BAND_ROUTES), so it draws it here; the
 * route's own <SetBreadcrumb> is a no-op on this path.
 */

const ok = <T,>(value: T): Promise<Settled<T>> => Promise.resolve({ ok: true, value });
const failed = Promise.resolve({ ok: false } as const);

const NO_ACTIVITY: CommunityLakeSectionDTO = {
  stats: { activeNow: 0, catchesThisMonth: 0, recordKg: null },
  activeSessions: [],
  monthlyActivity: [],
} as unknown as CommunityLakeSectionDTO;

/** The demo states reshape the real read; everything else is the CMS's answer. */
function shape({ lake, sections }: LakeScreenData, state: DemoState): LakeScreenData {
  switch (state) {
    case 'empty':
      return {
        lake: {
          ...lake,
          images: [],
          description: null,
          facility: [],
          fishSpecies: [],
          price: [],
          contact: [],
          address: null,
          website: null,
          coordinates: null,
          surface: null,
          depth: null,
          numberOfSeats: null,
          regime: null,
          fishingType: null,
          fishingSpotTypes: null,
          reviewsMeta: null,
          ownerName: null,
          ownerDocumentId: null,
          hasOwner: false,
          bookingEnabled: false,
          acceptsReservations: false,
          isVerified: false,
        },
        sections: {
          community: ok(NO_ACTIVITY),
          catches: ok({ total: 0, photos: [] }),
          competitions: Promise.resolve({ live: { ok: true, value: [] }, upcoming: { ok: true, value: [] } }),
          reviews: ok([]),
        } satisfies LakeSections,
      };
    case 'section-error':
      return {
        lake,
        sections: { community: failed, catches: failed, reviews: failed, competitions: Promise.resolve({ live: { ok: false }, upcoming: { ok: false } }) },
      };
    case 'no-photo':
      return { lake: { ...lake, images: [] }, sections };
    case 'photos-2':
    case 'photos-3':
    case 'photos-4':
    case 'gallery': {
      // The lake's own photos, then the bundled ones (repeated as needed) up to the count asked for.
      const want = state === 'gallery' ? Math.max(6, lake.images.length) : Number(state.slice(-1));
      const bundled = ['/images/lake.jpeg', '/images/placeholder-lake.jpg', '/images/competition-placeholder.jpg'];
      const extra = Array.from({ length: Math.max(0, want - lake.images.length) }, (_, i) => ({
        url: bundled[i % bundled.length],
        mediumUrl: null,
        smallUrl: null,
        blurhash: null,
      }));
      return { lake: { ...lake, images: [...lake.images, ...extra].slice(0, want) }, sections };
    }
    case 'long-title':
      return { lake: { ...lake, name: LONG_TITLE }, sections };
    case 'booking-phone':
      // fish bookingState 'legacy_phone': the call is the booking.
      return { lake: { ...lake, bookingEnabled: false, acceptsReservations: true }, sections };
    case 'no-coords':
      // No map pin: no Direcții / Hartă, no mini map; the address and phones stay.
      return { lake: { ...lake, coordinates: null }, sections };
    case 'no-booking':
      // fish bookingState 'none': «Sună» leads, «Vreau să rezerv online» is the demand signal.
      return { lake: { ...lake, bookingEnabled: false, acceptsReservations: false }, sections };
    case 'no-operator':
      return { lake: { ...lake, ownerName: null, ownerDocumentId: null, hasOwner: false }, sections };
    case 'owner-no-id':
      // The operator has no public profile id: the card is shown, not linked (lakes.detail.c29).
      return { lake: { ...lake, ownerName: lake.ownerName ?? 'Administratorul bălții', ownerDocumentId: null, hasOwner: true }, sections };
    default:
      return { lake, sections };
  }
}

/** The demo's «de la»: its legacy price rows (the route asks the booking quote first, priceFrom.ts). */
function demoPriceFrom(lake: LakeScreenData['lake']): PriceFrom | null {
  let best: PriceFrom | null = null;
  for (const p of lake.price) if (p.price != null && (!best || p.price < best.price)) best = { price: p.price, note: p.header || null };
  return best;
}

export function LakeScreen({ data, state }: { data: LakeScreenData; state: DemoState }) {
  const { lake, sections } = shape(data, state);
  return (
    <>
      <BreadcrumbBand trail={[{ label: 'Bălți', href: routes.lakes() }, { label: lake.name }]} />
      <RouteLakeScreen lake={lake} sections={sections} priceFrom={Promise.resolve(demoPriceFrom(lake))} />
    </>
  );
}
