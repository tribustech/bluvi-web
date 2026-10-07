import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense, type ReactNode } from 'react';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { ChartBarIcon, HomeModernIcon, PaperAirplaneIcon, PhoneIcon, PhotoIcon, Squares2X2Icon, TrophyIcon, UsersIcon } from '@heroicons/react/24/outline';
import { ErrorState } from '@/components/surfaces/StateCard';
import {
  DetailPhotoFillTile,
  DetailPhotoHero,
  DetailBackButton,
  DetailBand,
  DetailBody,
  DetailFacts,
  DetailHeader,
  DetailHeroTopControls,
  DetailPage,
  DetailSection,
  DetailSectionNav,
  DetailSectionsProvider,
  DetailSummaryCard,
  H3_CLASS,
  PHOTO_PILL,
  photoHeroHeight,
  PRESENCE_ICON,
  richTextToPlain,
  SHOW_ALL_CLASS,
  SURFACE_PILL,
  type DetailSectionItem,
} from '@/components/templates/T3';
import { buttonClass } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatInt } from '@/components/cards/format';
import { FishOutlineIcon } from '@/components/nav/brand';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  buildLakeSectionChips,
  lakeBookingState,
  lakeCompetitionsVisible,
  lakeHasContact,
  parseLakeCoordinates,
  VENUE_SECTION_LABELS,
  type LakeDetail,
} from '@/core/lakes';
import { communityVenueSectionQuery, hasPartideActivity, type CommunityLakeSectionDTO } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { HydrateQueries } from '@/lib/client/hydration';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeHref } from './availability';
import { hasBookingControl } from './bookingReach';
import { BookingCta, DialogTrigger, LakeActionsProvider, PhoneLink, ShareTrigger, type LakeInfo } from './LakeActions';
import { dynamicOnFailure, LATEST_REVIEWS, type LakeCatchPhotos, type LakeCompetitions, type LakeSections, type Settled } from './load';
import { lakeLocationLine } from './location';
import { bookableStandsLabel } from './standCount';
import type { PriceFrom as PriceFromValue } from './priceFrom';
import { PriceFrom } from '../../_list/PriceFrom';
import { MiniMap } from './MiniMap';
import { DescriptionPreview } from './DescriptionPreview';
import { PartideActiveBadge, PartideSection } from './PartideSection';
import { PhoneBar } from './PhoneBar';
import {
  CompetitionsBlock,
  ContactRows,
  FacilitiesList,
  FishList,
  lakeFacts,
  OwnerCard,
  PricesList,
  RatingLink,
  RatingMeta,
  ReviewsMoreAction,
  ReviewsSummary,
  VerifiedBadge,
} from './parts';
import { QuickActionBadge, QuickActions } from './QuickActions';
import { ReviewCard } from './ReviewCard';
import { FocusAfterRetry, SectionRetry } from './RetryFocus';
import { SectionAction } from './SectionLink';

/*
 * Baltă — fish app/(app)/lakes/[lakeId].tsx on T3 (parity lakes.detail), one long scroll:
 *  - phone: photo hero (back, share, «Rezervă acum», photo pill) → title block (name + rating,
 *    location) → sticky chips (with the pinned mini title row) → white sections on the grey page:
 *    Prezentare (description, quick actions, characteristics), Facilități, Pești, Partide, Prețuri,
 *    Concursuri, Recenzii, Locație & contact (+ Administrator);
 *  - from 768 (owner rule 1, ROADMAP §4b — Airbnb): the title row first (name, ★ rating, location,
 *    share), then the photo grid (one large + four small, «Vezi toate fotografiile» opens the
 *    lightbox), the chips stuck under the bar at every width;
 *  - from 1024: two columns — the sections left, the sticky summary card right (price, «Rezervă
 *    acum», contact, key facts); the «Acțiuni rapide» tiles and «Caracteristici» go there (the card
 *    carries the same actions);
 *  - phone: a bottom action bar (Airbnb's) keeps the price and the main action on screen once the
 *    hero's «Rezervă acum» has scrolled away;
 *  - no photo of its own (owner rule 4 — never a screen-third of nothing): with coordinates the map
 *    is the hero (phone and the ≥768 grid alike, the same height as one photo, so the skeleton
 *    holds); without, no hero at all — back / share in the title row, the main action under it.
 *
 * Streaming (c32): the page renders as soon as the LAKE is read. Partide, Concursuri, Recenzii and
 * the photo count each wait for their own read behind their own Suspense; the section nav starts
 * from what the lake read knows (Concursuri shown until its counts say 0 + 0, Partide once its
 * read says there is activity) and takes the final list when the reads land (c10).
 */

/** fish buildLakeSectionChips, with the counts the ≥1280 index shows beside a label. */
function sectionsFor(lake: LakeDetail, partide: boolean, competitions: LakeCompetitions | null): DetailSectionItem[] {
  const counts =
    competitions?.live.ok && competitions.upcoming.ok ? { live: competitions.live.value.length, upcoming: competitions.upcoming.value.length } : null;
  const ids = buildLakeSectionChips({
    hasFacilities: lake.facility.length > 0,
    hasFish: lake.fishSpecies.length > 0,
    // Always in the order: whether it shows is the section's own polled read (useRegisterSection in
    // PartideSection, c10); the server read only gives the first answer (`visible`).
    hasPartide: true,
    hasPrices: lake.price.length > 0,
    // fish: shown until the counts are known (and whenever they cannot be: an error), hidden at 0 + 0.
    hasCompetitions: lakeCompetitionsVisible(counts),
    hasContact: lakeHasContact(lake),
  });
  const hint: Partial<Record<string, number | undefined>> = {
    facilitati: lake.facility.length,
    pesti: lake.fishSpecies.length,
    concursuri: counts ? counts.live + counts.upcoming : undefined,
    recenzii: lake.reviewsMeta?.count || undefined,
  };
  // Without a description, Prezentare is the tiles + characteristics only — both in the summary
  // card from 1024, so the section (and its chip) leaves there instead of an empty card.
  const bare = !hasDescription(lake);
  return ids.map(id => ({
    id,
    label: VENUE_SECTION_LABELS[id],
    hint: hint[id],
    hideFromLg: id === 'prezentare' && bare ? true : undefined,
    visible: id === 'partide' ? partide : undefined,
  }));
}

const partideVisible = (c: Settled<CommunityLakeSectionDTO>) => c.ok && hasPartideActivity(c.value);

/**
 * Whether the lake has a description to show: some text, not just blocks — the CMS stores a cleared
 * editor as one empty paragraph (Balta Palat Căciulați), which would be a titled empty card.
 */
const hasDescription = (lake: LakeDetail) => richTextToPlain(lake.description).trim().length > 0;

/** Longer than this (plain text), the description is previewed with a fade + «Vezi mai mult» —
 * decided here so both are in the first paint (c13). ~5 phone lines. */
const DESCRIPTION_PREVIEW_CHARS = 200;

/** The latest reviews (and their bones): one column, from 768 an auto-fill grid of ≥288px cards. */
const REVIEWS_GRID = 'grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(--spacing(72),1fr))]';

/** Focus clearance under the pinned rows (bar + chips at every width), for every focusable in the page. */
const FOCUS_CLEARANCE =
  '[&_:is(a,button,input,textarea,select,[tabindex])]:scroll-mt-43 md:[&_:is(a,button,input,textarea,select,[tabindex])]:scroll-mt-34';

export function LakeScreen({ lake, sections, priceFrom }: { lake: LakeDetail; sections: LakeSections; priceFrom: Promise<PriceFromValue | null> }) {
  const id = lake.documentId;
  const initial = sectionsFor(lake, false, null);
  const refined = Promise.all([sections.community, sections.competitions]).then(([community, competitions]) =>
    sectionsFor(lake, partideVisible(community), competitions),
  );
  const location = lakeLocationLine(lake);
  const facts = lakeFacts(lake);
  const coords = parseLakeCoordinates(lake.coordinates);
  const contact = lakeHasContact(lake);
  const reviewCount = lake.reviewsMeta?.count ?? 0;
  const described = hasDescription(lake);
  // fish LakeHero: medium → small → original; the web takes the original for the 1280 mosaic
  // (next/image's `sizes` brings it down on the phone).
  const photos = lake.images.map(img => ({ src: img.url || img.mediumUrl || img.smallUrl || '' })).filter(p => p.src);
  const hasPhoto = photos.length > 0;
  const info: LakeInfo = {
    documentId: id,
    name: lake.name,
    coordinates: lake.coordinates,
    bookingState: lakeBookingState(lake),
    description: lake.description,
    phone: lakePhone(lake),
    website: lake.website,
  };
  // A main control at all (bookingReach.ts): a phone-booking lake with no phone and no website has none.
  const mainControl = hasBookingControl(info);
  // No photo of its own: the map is the hero where there are coordinates; else no hero (c4, s4).
  const mapHero = !hasPhoto && !!coords;
  const noHero = !hasPhoto && !coords;
  // The booking control's look, the same at every width (BookingCta): secondary where the call is
  // the lake's main action (no online booking + a phone — the summary card and the phone bar).
  const ctaVariant = info.bookingState === 'none' && lakePhone(lake) ? 'secondary' : 'primary';

  return (
    <LakeActionsProvider lake={info}>
      <SetBreadcrumb trail={[{ label: 'Bălți', href: routes.lakes() }, { label: lake.name }]} />
      <DetailSectionsProvider sections={initial} refined={refined}>
        {/* WCAG 2.4.11: a focused control never lands under the pinned rows (the site bar + the
            pinned title and chip rows; at ≥1280 the bar) — the same offsets as the section anchors.
            TODO(kit): a scroll-padding-top on the page while a T3 section nav is pinned. */}
        <DetailPage phoneGround="page" className={FOCUS_CLEARANCE}>
          <FocusAfterRetry retry="page" target="balta-titlu" />
          <DetailBand hairline={false}>
            {/* Phone: back + share over the hero, first in the DOM as on screen. The header comes
                next in the DOM (from 768 it is the first row: title → actions → photos, WCAG 1.3.2 /
                2.4.3); on the phone the hero is lifted above it with `max-md:-order-1`. */}
            {noHero ? null : (
              <DetailHeroTopControls
                start={<DetailBackButton fallbackHref={routes.lakes()} ground={hasPhoto ? 'photo' : 'page'} />}
                end={hasPhoto ? <ShareTrigger onPhoto /> : <ShareTrigger ground="page" />}
              />
            )}
            <DetailHeader
              title={lake.name}
              titleId="balta-titlu"
              eyebrow={lake.countyRef?.name ? `Baltă · ${lake.countyRef.name}` : 'Baltă'}
              titleAside={<RatingLink meta={lake.reviewsMeta} />}
              meta={[
                location ? (
                  <span key="loc" className="inline-flex items-center gap-1 t-label text-muted" data-testid="lake-location">
                    <MapPinIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'shrink-0 text-accent')} />
                    {location}
                  </span>
                ) : null,
              ]}
              badges={
                lake.isVerified || lake.regime ? (
                  <>
                    {lake.isVerified ? <VerifiedBadge>Verificată</VerifiedBadge> : null}
                    {lake.regime ? <Badge color="indigo">{lake.regime}</Badge> : null}
                  </>
                ) : undefined
              }
              // No hero (no photo, no coordinates): back and share in the title row on the phone.
              phoneStart={noHero ? <DetailBackButton fallbackHref={routes.lakes()} ground="page" /> : undefined}
              phoneEnd={noHero ? <ShareTrigger ground="page" /> : undefined}
              actions={
                <>
                  {/* No hero to carry it: the gallery (the community catches) from the title row (c7). */}
                  {noHero ? (
                    <Suspense fallback={null}>
                      <GalleryAction lake={lake} catches={sections.catches} />
                    </Suspense>
                  ) : null}
                  <ShareTrigger look="button" />
                  {/* From 1024 the booking lives in the summary card. */}
                  <BookingCta source="hero_cta" variant={ctaVariant} className="min-[1024px]:hidden" />
                </>
              }
              className="md:pt-5"
            />
            {/* No hero: the main action and the gallery pill under the title, phone only (from 768 the
                header's actions carry both). The phone bar watches `data-phone-cta`. */}
            {noHero ? (
              <div className="flex items-center justify-between gap-3 px-4 md:hidden [&:has(a,button)]:pb-4">
                {mainControl ? (
                  <div data-phone-cta>
                    <BookingCta source="hero_cta" variant={ctaVariant} />
                  </div>
                ) : null}
                <div className="ml-auto">
                  <Suspense fallback={null}>
                    <PhotoPill lake={lake} catches={sections.catches} onPhoto={false} hasCoordinates={false} md={false} />
                  </Suspense>
                </div>
              </div>
            ) : null}
            {/*
              fish LakeHero on the T3 photo hero (c4 – c7). On the phone a tap on a photo opens the
              gallery (fish onPressPhoto); from 768 the tiles open the lightbox (owner rule 1). Without
              a photo, the map (MapHero) or nothing — never a grey placeholder.
            */}
            {mapHero && coords ? (
              <MapHero
                lake={lake}
                coords={coords}
                cta={mainControl ? <BookingCta source="hero_cta" variant={ctaVariant} /> : null}
                pill={
                  <Suspense fallback={null}>
                    <PhotoPill lake={lake} catches={sections.catches} onPhoto={false} hasCoordinates />
                  </Suspense>
                }
              />
            ) : null}
            {hasPhoto ? (
              <DetailPhotoHero
                className="max-md:-order-1"
                viewer
                // «Vezi toate fotografiile (N)» is the gallery link in PhotoPill (photos + catches).
                showAll={false}
                phoneHref={routes.lakeGallery(id)}
                fill={
                  photos.length > 0 && photos.length < HERO_TILES ? (
                    <Suspense
                      fallback={
                        <li aria-hidden className="max-md:hidden">
                          <span className={cn(BONE, 'h-full')} />
                        </li>
                      }
                    >
                      <HeroFill lake={lake} catches={sections.catches} coords={coords} />
                    </Suspense>
                  ) : undefined
                }
                photos={photos}
                label={`Fotografii ${lake.name}`}
                bottomStart={
                  mainControl ? (
                    <div className="md:hidden" data-phone-cta>
                      <BookingCta source="hero_cta" variant={ctaVariant} />
                    </div>
                  ) : undefined
                }
                bottomEnd={
                  <Suspense fallback={null}>
                    <PhotoPill lake={lake} catches={sections.catches} onPhoto hasCoordinates={!!coords} />
                  </Suspense>
                }
              />
            ) : null}
          </DetailBand>

          <DetailSectionNav
            label="Secțiunile bălții"
            pinnedTitle={lake.name}
            // fish VenuePinnedNav leftAccessory (c12): the way back once the hero and the bar are gone.
            pinnedStart={<DetailBackButton fallbackHref={routes.lakes()} ground="surface" size="size-11" />}
            pinnedMeta={<RatingMeta meta={lake.reviewsMeta} />}
            pinnedEnd={<ShareTrigger size="size-11" />}
            hideFromXl={false}
          />

          <DetailBody layout="summary" aside={
              <Suspense fallback={<SummaryCard lake={lake} hasCoordinates={!!coords} from="loading" />}>
                <PricedSummaryCard
                  lake={lake}
                  hasCoordinates={!!coords}
                  priceFrom={priceFrom}
                  community={sections.community}
                  competitions={sections.competitions}
                />
              </Suspense>
            } asideLabel="Pe scurt" asideBelowXl="hidden" asideSticky>
            {/* With a description the kit's own title names the region (fish «Descriere»). Without
                one the section is the quick actions + characteristics only: a visually hidden h2.
                TODO(kit): a DetailSection `titleHidden` option, then this sr-only h2 goes. */}
            <DetailSection
              id="prezentare"
              title={described ? 'Descriere' : undefined}
              className={described ? undefined : 'min-[1024px]:hidden'}
            >
              <div className="flex flex-col gap-5.5">
                {described ? (
                  <DescriptionPreview blocks={lake.description ?? []} long={richTextToPlain(lake.description).length > DESCRIPTION_PREVIEW_CHARS} />
                ) : (
                  <h2 className="sr-only">Prezentare</h2>
                )}
                {/* From 1024 the summary card (booking, call, directions) and the sections' own links carry these. */}
                <QuickActions
                  lakeId={id}
                  hasPrices={lake.price.length > 0}
                  hasCoordinates={!!coords}
                  badges={{
                    partide: (
                      <Suspense fallback={null}>
                        <PartideBadge lakeId={id} community={sections.community} />
                      </Suspense>
                    ),
                    concursuri: (
                      <Suspense fallback={null}>
                        <LiveCompetitionsBadge competitions={sections.competitions} />
                      </Suspense>
                    ),
                  }}
                  className="min-[1024px]:hidden"
                />
                {/* From 1024 the characteristics are in the summary card. */}
                {facts.length ? (
                  <div className="flex flex-col gap-3 min-[1024px]:hidden">
                    <h3 className={H3_CLASS}>Caracteristici</h3>
                    <DetailFacts facts={facts} />
                  </div>
                ) : null}
              </div>
            </DetailSection>

            {lake.facility.length > 0 ? (
              <DetailSection id="facilitati" title="Facilități">
                <FacilitiesList facilities={lake.facility} />
              </DetailSection>
            ) : null}

            {lake.fishSpecies.length > 0 ? (
              <DetailSection id="pesti" title="Pești în această zonă">
                <FishList species={lake.fishSpecies} />
              </DetailSection>
            ) : null}

            {/* No placeholder (fish VenuePartideSection): most lakes have no partide — it pops in once,
                and keeps polling either way (c21). */}
            <Suspense fallback={null}>
              <Partide lakeId={id} community={sections.community} />
            </Suspense>

            {lake.price.length > 0 ? (
              <DetailSection id="preturi" title="Prețuri">
                <PricesList prices={lake.price} />
              </DetailSection>
            ) : null}

            <Suspense fallback={<CompetitionBones />}>
              <Competitions lakeId={id} competitions={sections.competitions} />
            </Suspense>

            <DetailSection id="recenzii" title="Recenzii" action={<ReviewsMoreAction lakeId={id} count={reviewCount} />}>
              {/* From 768 the score summary in a fixed 288px column and the latest review(s) beside it
                  (an auto-fill grid: two side by side when there is room); where the row has no room
                  for both (the 1280 centre) the reviews wrap under the summary. */}
              <div className={cn('flex flex-col gap-4', reviewCount > 0 && 'md:flex-row md:flex-wrap md:gap-6')}>
                <ReviewsSummary meta={lake.reviewsMeta} className={reviewCount > 0 ? 'md:w-72 md:shrink-0' : undefined} />
                {reviewCount > 0 ? (
                  <div className="min-w-0 md:min-w-72 md:flex-1 md:basis-72">
                    <Suspense fallback={<ReviewBones count={Math.min(reviewCount, LATEST_REVIEWS)} />}>
                      <LatestReviews reviews={sections.reviews} />
                    </Suspense>
                  </div>
                ) : null}
              </div>
            </DetailSection>

            {contact ? (
              <DetailSection id="contact" title="Locație & contact">
                {coords && !mapHero ? (
                  <Suspense fallback={<ContactBody lake={lake} coords={coords} mapFromMd />}>
                    <StreamedContactBody lake={lake} catches={sections.catches} coords={coords} />
                  </Suspense>
                ) : (
                  // The map is the hero (or there are no coordinates): the rows alone.
                  <ContactBody lake={lake} coords={coords} mapOnPhone={false} mapFromMd={false} />
                )}
              </DetailSection>
            ) : null}
          </DetailBody>
          <Suspense fallback={<PhoneActionBar lake={lake} from="loading" />}>
            <PricedPhoneActionBar lake={lake} priceFrom={priceFrom} />
          </Suspense>
        </DetailPage>
      </DetailSectionsProvider>
    </LakeActionsProvider>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Streamed parts
 * ---------------------------------------------------------------------------------------------- */

/**
 * fish photo pill: the lake's photos + the community catches; hidden at 0 (c7). It opens the
 * gallery once that page is on the web; until then it is the count alone. Phone only: from 768 the
 * one control on the grid is «Vezi toate fotografiile (N)» — the same gallery, the same count
 * (owner rule 1; never a pill beside a button that lead to different places); on the map hero (no
 * photo of its own) «Vezi fotografiile (N)», so the catches stay reachable at every width.
 */
async function PhotoPill({
  lake,
  catches: read,
  onPhoto,
  hasCoordinates,
  md = true,
}: {
  lake: LakeDetail;
  catches: Promise<Settled<LakeCatchPhotos>>;
  onPhoto: boolean;
  hasCoordinates: boolean;
  /** From 768 the gallery link too (false: the page puts it elsewhere — GalleryAction). */
  md?: boolean;
}) {
  const catches = await dynamicOnFailure(read);
  const count = lake.images.length + (catches.ok ? catches.value.total : 0);
  // The grid's bottom-right tile is the map's: the link moves to the large photo's bottom-left.
  const mapTile = heroFillPlan(lake.images.length, catches, hasCoordinates).map;
  if (count <= 0) return null;
  const pill = onPhoto ? PHOTO_PILL : SURFACE_PILL;
  const href = lakeHref('gallery', routes.lakeGallery(lake.documentId));
  const label = formatCount(count, 'fotografie', 'fotografii');
  return href ? (
    <>
      <Link href={href} className={cn(pill, 'hover:brightness-110 md:hidden')} aria-label={`Galerie: ${label}`}>
        <PhotoIcon aria-hidden />
        {count}
      </Link>
      {/* One photo: the link would only reopen the photo on screen. */}
      {onPhoto && count > 1 ? (
        <Link href={href} className={cn(SHOW_ALL_CLASS, mapTile && 'md:absolute md:bottom-0 md:left-0')}>
          <Squares2X2Icon aria-hidden />
          Vezi toate fotografiile ({count})
        </Link>
      ) : !onPhoto && md ? (
        // No photo of its own (the map is the hero): the catches are the gallery, from 768 too (c7).
        <Link href={href} className={SHOW_ALL_CLASS}>
          <PhotoIcon aria-hidden />
          Vezi fotografiile ({count})
        </Link>
      ) : null}
    </>
  ) : (
    <p className={pill} data-testid="lake-photo-count">
      <PhotoIcon aria-hidden />
      <span aria-hidden>{count}</span>
      <span className="sr-only">{label}</span>
    </p>
  );
}

/** The grid's tiles from 768: one large + four small (owner rule 1). */
const HERO_TILES = 5;

/**
 * What tops the photo grid up from 768 (owner rule 1: one large + four small): the first
 * photographed community catches up to five tiles in all; only when the lake's lone photo would
 * still be alone, its map (else a quiet tile) — one photo never spans the width.
 */
function heroFillPlan(lakePhotos: number, catches: Settled<LakeCatchPhotos>, hasCoordinates: boolean) {
  const photos = lakePhotos > 0 && catches.ok ? catches.value.photos.slice(0, Math.max(0, HERO_TILES - lakePhotos)) : [];
  const alone = lakePhotos === 1 && photos.length === 0;
  return { photos, map: alone && hasCoordinates, quiet: alone && !hasCoordinates };
}

/** The grid's extra tiles (DetailPhotoHero `fill`): each catch opens the gallery; the map, the map page. */
async function HeroFill({
  lake,
  catches: read,
  coords,
}: {
  lake: LakeDetail;
  catches: Promise<Settled<LakeCatchPhotos>>;
  coords: { lat: number; lng: number } | null;
}) {
  const plan = heroFillPlan(lake.images.length, await dynamicOnFailure(read), !!coords);
  const gallery = lakeHref('gallery', routes.lakeGallery(lake.documentId));
  if (plan.map && coords) {
    return (
      <DetailPhotoFillTile>
        <MiniMap tile lat={coords.lat} lng={coords.lng} href={lakeHref('map', routes.lakeMap(lake.documentId))} name={lake.name} />
      </DetailPhotoFillTile>
    );
  }
  if (plan.quiet) return <DetailPhotoFillTile quiet />;
  return plan.photos.map((p, i) => (
    <DetailPhotoFillTile key={`${p.src}-${i}`}>
      <span className="group/fill absolute inset-0 block">
        <Image src={p.src} alt="" fill sizes="(min-width: 768px) 33vw, 1px" className="object-cover transition-[filter] duration-(--duration-fast) ease-fast group-hover/fill:brightness-90" />
        {gallery ? (
          <Link
            href={gallery}
            aria-label={`Captură: ${p.alt} — deschide galeria`}
            className="absolute inset-0 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent"
          />
        ) : null}
      </span>
    </DetailPhotoFillTile>
  ));
}

/** Locație & contact once the catches read says whether the photo grid already shows the map (from 768). */
async function StreamedContactBody({
  lake,
  catches: read,
  coords,
}: {
  lake: LakeDetail;
  catches: Promise<Settled<LakeCatchPhotos>>;
  coords: { lat: number; lng: number };
}) {
  const inHero = heroFillPlan(lake.images.length, await dynamicOnFailure(read), true).map;
  return <ContactBody lake={lake} coords={coords} mapFromMd={!inHero} />;
}

/**
 * Locație & contact (c28, c29, c31): the mini map, Direcții, the address / phone / website rows and
 * the Administrator card. From 1280 (owner rule 1, Airbnb «Unde vei fi») two columns — the map
 * left (taller), the rows and the card right; without a map there the rows keep a reading measure
 * instead of spanning the ~1200px card. The map is not shown a second time where the hero is the
 * map, nor from 768 where the photo grid already carries it (`mapFromMd`).
 */
function ContactBody({
  lake,
  coords,
  mapOnPhone = true,
  mapFromMd,
}: {
  lake: LakeDetail;
  coords: { lat: number; lng: number } | null;
  mapOnPhone?: boolean;
  mapFromMd: boolean;
}) {
  const wide = !!coords && mapFromMd;
  const map = coords && (mapOnPhone || mapFromMd);
  return (
    <div className={cn('flex flex-col gap-3.5', wide && 'xl:grid xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] xl:items-start xl:gap-x-8')}>
      {coords ? (
        // From 1024 the column holds the map only (Direcții is the summary card's there).
        <div className={cn('flex flex-col gap-3.5', !mapFromMd && 'min-[1024px]:hidden')}>
          {map ? (
            <div className={cn(!mapFromMd && 'md:hidden', !mapOnPhone && 'max-md:hidden')}>
              <MiniMap lat={coords.lat} lng={coords.lng} href={lakeHref('map', routes.lakeMap(lake.documentId))} name={lake.name} className="xl:h-72" />
            </div>
          ) : null}
          {/* fish shows Direcții whenever there are coordinates (c31). Below 1024 only: from there the
              sticky summary card carries it — one entry point per page (owner). */}
          <DialogTrigger
            dialog="directions"
            className={buttonClass({ variant: 'secondary', className: 'self-start min-[1024px]:hidden [&>svg]:size-5' })}
          >
            <PaperAirplaneIcon aria-hidden />
            Direcții
          </DialogTrigger>
        </div>
      ) : null}
      <div className={cn('flex min-w-0 flex-col gap-3.5', !wide && 'xl:max-w-140')}>
        <ContactRows lake={lake} />
        <div className="mt-2 flex flex-col gap-2">
          <h3 className={H3_CLASS}>Administrator</h3>
          <OwnerCard lake={lake} />
        </div>
      </div>
    </div>
  );
}

/**
 * The hero of a lake with no photo of its own but coordinates (owner rule 4): its map, at the
 * one-photo hero's height at every width (the skeleton's), with the main action and the gallery
 * pill on it as on a photo. The whole tile opens the map page.
 */
function MapHero({ lake, coords, cta, pill }: { lake: LakeDetail; coords: { lat: number; lng: number }; cta: ReactNode; pill: ReactNode }) {
  return (
    <div data-t3="photo" data-hero="map" className="relative max-md:-order-1 md:mx-6 md:mb-6 xl:mx-8">
      <div className={cn('overflow-hidden md:rounded-card', photoHeroHeight(1))}>
        <MiniMap tile lat={coords.lat} lng={coords.lng} href={lakeHref('map', routes.lakeMap(lake.documentId))} name={lake.name} />
      </div>
      <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center justify-between gap-3 *:pointer-events-auto">
        {cta ? (
          <div className="md:hidden" data-phone-cta>
            {cta}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-2">{pill}</div>
      </div>
    </div>
  );
}

/** No hero (no photo, no coordinates), from 768: the gallery link in the title row — the community catches (c7). */
async function GalleryAction({ lake, catches: read }: { lake: LakeDetail; catches: Promise<Settled<LakeCatchPhotos>> }) {
  const catches = await dynamicOnFailure(read);
  const count = lake.images.length + (catches.ok ? catches.value.total : 0);
  const href = lakeHref('gallery', routes.lakeGallery(lake.documentId));
  if (count <= 0 || !href) return null;
  return (
    <Link href={href} className={buttonClass({ variant: 'secondary', className: '[&>svg]:size-5' })}>
      <PhotoIcon aria-hidden />
      Vezi fotografiile ({count})
    </Link>
  );
}

async function Partide({ lakeId, community }: { lakeId: string; community: Promise<Settled<CommunityLakeSectionDTO>> }) {
  // Seeded when the server read succeeded; otherwise the browser reads (and polls) on its own —
  // rendered per request then (an unseeded query stamps the clock, which a prerender must not).
  const read = await dynamicOnFailure(community);
  if (!read.ok) return <PartideSection lakeId={lakeId} />;
  return (
    <HydrateQueries queries={t => [communityVenueSectionQuery(t, { kind: 'lake', id: lakeId })]}>
      <PartideSection lakeId={lakeId} />
    </HydrateQueries>
  );
}

/** The Partide tile's badge (c14): the same seeded / browser-read query as the section. */
async function PartideBadge({ lakeId, community }: { lakeId: string; community: Promise<Settled<CommunityLakeSectionDTO>> }) {
  const read = await dynamicOnFailure(community);
  if (!read.ok) return <PartideActiveBadge lakeId={lakeId} />;
  return (
    <HydrateQueries queries={t => [communityVenueSectionQuery(t, { kind: 'lake', id: lakeId })]}>
      <PartideActiveBadge lakeId={lakeId} />
    </HydrateQueries>
  );
}

/** The Concursuri tile's badge (c14, fish: the live count): nothing when none is live or the list failed (rule 4). */
async function LiveCompetitionsBadge({ competitions }: { competitions: Promise<LakeCompetitions> }) {
  const { live } = await competitions;
  // A failed list renders per request, never into the static page (see load.ts).
  if (!live.ok) await connection();
  const n = live.ok ? live.value.length : 0;
  return n > 0 ? <QuickActionBadge count={n} label={`${formatCount(n, 'concurs live', 'concursuri live')}`} /> : null;
}

async function Competitions({ lakeId, competitions: read }: { lakeId: string; competitions: Promise<LakeCompetitions> }) {
  const competitions = await read;
  const { live, upcoming } = competitions;
  // A failed list renders per request, never into the static page (see load.ts).
  if (!live.ok || !upcoming.ok) await connection();
  if (live.ok && upcoming.ok && live.value.length + upcoming.value.length === 0) return null;
  // One «Vezi tot» for the section (owner: never one per rail beside it): the lake's competitions,
  // on the tab of the one rail shown, or the whole page when both show (or one failed).
  const onlyLive = live.ok && upcoming.ok && upcoming.value.length === 0;
  const onlyUpcoming = live.ok && upcoming.ok && live.value.length === 0;
  const all = lakeHref('competitions', routes.lakeCompetitions(lakeId, onlyLive ? 'live' : onlyUpcoming ? 'viitoare' : undefined));
  return (
    <DetailSection id="concursuri" title="Concursuri" action={all ? <SectionAction href={all}>Vezi tot</SectionAction> : undefined}>
      <CompetitionsBlock live={live} upcoming={upcoming} />
      {live.ok && upcoming.ok ? <FocusAfterRetry retry="concursuri" target="concursuri-titlu" /> : null}
    </DetailSection>
  );
}

async function LatestReviews({ reviews: read }: { reviews: LakeSections['reviews'] }) {
  const reviews = await dynamicOnFailure(read);
  if (!reviews.ok) return <ErrorState title="Recenziile nu au putut fi încărcate." action={<SectionRetry section="recenzii" />} />;
  if (!reviews.value.length) return null;
  return (
    <div className={REVIEWS_GRID}>
      {reviews.value.map(r => (
        <ReviewCard key={r.documentId} review={r} />
      ))}
      <FocusAfterRetry retry="recenzii" target="recenzii-titlu" />
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Summary card (from 1024, the right column — owner rule 1, Airbnb's booking card)
 * ---------------------------------------------------------------------------------------------- */

/** «de la» still being read (the booking quote, priceFrom.ts): a quiet bone, never a guess (rule 4). */
type From = PriceFromValue | null | 'loading';

async function PricedSummaryCard({
  priceFrom,
  community,
  competitions,
  ...props
}: {
  lake: LakeDetail;
  hasCoordinates: boolean;
  priceFrom: Promise<PriceFromValue | null>;
  community: Promise<Settled<CommunityLakeSectionDTO>>;
  competitions: Promise<LakeCompetitions>;
}) {
  const [from, partide, { live, upcoming }] = await Promise.all([priceFrom, community, competitions]);
  // The Competitions section's own rule: gone only when both lists say 0.
  const competitionsSection = !(live.ok && upcoming.ok && live.value.length + upcoming.value.length === 0);
  return <SummaryCard {...props} from={from} partideSection={partideVisible(partide)} competitionsSection={competitionsSection} />;
}

async function PricedPhoneActionBar({ lake, priceFrom }: { lake: LakeDetail; priceFrom: Promise<PriceFromValue | null> }) {
  return <PhoneActionBar lake={lake} from={await priceFrom} />;
}

/**
 * Price from, the booking state, the same «Rezervă acum» as the hero and the header (c16) — one
 * treatment per state at every width and session — then the way to reach the lake (call,
 * directions) and its key facts. While the booking flow is not on the web the button leads to
 * «Rezervă din aplicația Bluvi», and the card says so under it.
 */
function SummaryCard({
  lake,
  hasCoordinates,
  from,
  partideSection = false,
  competitionsSection = true,
}: {
  lake: LakeDetail;
  hasCoordinates: boolean;
  from: From;
  /** The Partide section is on the page (its «Vezi tot» is the way in): no second link here. */
  partideSection?: boolean;
  /** The Concursuri section is on the page (its «Vezi tot» is the way in): no second link here. */
  competitionsSection?: boolean;
}) {
  const state = lakeBookingState(lake);
  const online = state === 'enabled';
  const appOnly = online && !lakeHref('booking', routes.lakeBooking(lake.documentId));
  const stands = from ? null : bookableStands(lake);
  const phone = lakePhone(lake);
  const control = hasBookingControl({ bookingState: state, phone, website: lake.website });
  // Pages the tiles reached below 1024 that no section links to: Partide / Concursuri only while
  // their section (with its own «Vezi tot») is not on the page — a lake with no live or upcoming
  // competition keeps the way to its past results (Trecute, c14).
  const more = [
    ...(partideSection ? [] : [{ key: 'partide', label: 'Partide', icon: <UsersIcon aria-hidden />, href: lakeHref('partide', routes.lakePartide(lake.documentId)) }]),
    { key: 'statistici', label: 'Statistici', icon: <ChartBarIcon aria-hidden />, href: lakeHref('stats', routes.lakeStats(lake.documentId)) },
    ...(competitionsSection
      ? []
      : [{ key: 'concursuri', label: 'Concursuri', icon: <TrophyIcon aria-hidden />, href: lakeHref('competitions', routes.lakeCompetitions(lake.documentId, 'trecute')) }]),
  ].filter((l): l is typeof l & { href: string } => !!l.href);
  const call = phone ? (
    <PhoneLink phone={phone} className={buttonClass({ variant: online ? 'secondary' : 'primary', block: true, className: '[&>svg]:size-5' })}>
      <PhoneIcon aria-hidden />
      Sună
    </PhoneLink>
  ) : null;
  const directions = hasCoordinates ? (
    <DialogTrigger dialog="directions" className={buttonClass({ variant: 'secondary', block: true, className: '[&>svg]:size-5' })}>
      <PaperAirplaneIcon aria-hidden />
      Direcții
    </DialogTrigger>
  ) : null;
  // One stand count (lakeStandCount): when the headline (no «de la») or the footnote (not app-only)
  // states the bookable stands, the facts do not repeat it; otherwise (a price headline + the app
  // footnote) the facts row is where the card says it.
  const standsStated = online && lake.stands.length > 0 && (!from || !appOnly);
  const facts = [
    ...lakeFacts(lake).filter(f => !(standsStated && f.key === 'seats')),
    ...(lake.fishSpecies.length ? [{ key: 'specii', label: 'Specii', value: formatInt(lake.fishSpecies.length), icon: <FishOutlineIcon /> }] : []),
    ...(lake.facility.length ? [{ key: 'facilitati', label: 'Facilități', value: formatInt(lake.facility.length), icon: <HomeModernIcon /> }] : []),
  ];
  return (
    <DetailSummaryCard
      headline={
        from === 'loading' ? (
          // The t-display line's box, a bone in it: the price lands without a jump.
          <span aria-hidden className="flex items-center t-display">
            <span className={cn(BONE, 'h-[0.75lh] w-44 rounded-full')} />
          </span>
        ) : from ? (
          // The map card's signature number (rules 1, 7, 10): one PriceFrom, so the two never drift.
          <PriceFrom price={from.price} note={from.note} testId="summary-price" />
        ) : stands ? (
          <>
            <span className="t-title2 tabular-nums">{bookableLabel(stands)}</span>
            {/* Its own line: never an orphan «·» where the 352px card wraps. */}
            <span className="basis-full t-body text-muted">Alege standul și intervalul</span>
          </>
        ) : undefined
      }
      badges={
        <>
          {state === 'enabled' ? (
            <StatusPill tone="success">Rezervare online</StatusPill>
          ) : state === 'legacy_phone' ? (
            <StatusPill tone="neutral">Rezervare telefonică</StatusPill>
          ) : (
            <StatusPill tone="neutral">Fără rezervări online</StatusPill>
          )}
          {state === 'enabled' && lake.confirmationMode === 'instant' ? <Badge color="indigo">Confirmare instant</Badge> : null}
          {state === 'enabled' && lake.paymentMode === 'offline' ? <Badge color="gray">Plata la baltă</Badge> : null}
        </>
      }
      actions={
        online ? (
          <>
            <BookingCta source="quick_action" block />
            {call || directions ? (
              <div className={cn('grid gap-2', call && directions && 'grid-cols-2')}>
                {call}
                {directions}
              </div>
            ) : null}
          </>
        ) : (
          // No online booking (the pill says so, once): the call is the main action; the fish demand
          // signal stays as a secondary «Vreau să rezerv online». A phone-booking lake's booking IS
          // the call — without a phone number there is nothing to book through (owner rule 4):
          // BookingCta is «Contactează balta» (the website) or nothing, as on the hero and the bar.
          call || control || directions ? (
            <>
              {call}
              {control && (state === 'none' || !call) ? <BookingCta source="quick_action" block variant={call ? 'secondary' : 'primary'} /> : null}
              {directions}
            </>
          ) : undefined
        )
      }
      footnote={
        appOnly
          ? 'Rezervarea online e în curând pe web; până atunci rezervă din aplicația Bluvi.'
          : online && lake.stands.length && !stands
            ? `Alege standul și intervalul — ${bookableLabel(lake.stands.length)}.`
            : undefined
      }
    >
      {facts.length ? <DetailFacts facts={facts} layout="list" /> : null}
      {more.length ? (
        <ul aria-label="Mai multe despre baltă" className="flex flex-wrap gap-2">
          {more.map(l => (
            <li key={l.key}>
              <Link href={l.href} className={buttonClass({ variant: 'secondary', size: 'compact', className: '[&>svg]:size-5' })}>
                {/* Three links fit the 312px row only as labels: one row, so the card still fits the window (sticky). */}
                {more.length > 2 ? null : l.icon}
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </DetailSummaryCard>
  );
}

const lakePhone = (lake: LakeDetail) => lake.contact.find(c => c.phone)?.phone ?? null;

/** The stands one can book online — named so, never confused with the CMS «N locuri» (numberOfSeats). */
const bookableLabel = bookableStandsLabel;

/**
 * The headline when there is no «de la» at all (priceFrom.ts: the booking server quoted no tour
 * and no legacy row has a price) on a lake that books online: the card leads with what IS known,
 * the stands one can book. Rule 4 (ROADMAP §4b): nothing known → nothing shown; never the lake's
 * name again.
 */
function bookableStands(lake: LakeDetail): number | null {
  return lakeBookingState(lake) === 'enabled' && lake.stands.length > 0 ? lake.stands.length : null;
}

/**
 * Phone only (below 768; from 1024 the summary card does this, between them the header CTA): the
 * Airbnb bottom bar — «de la 45 RON · Permis 24h» / «de la 50 RON · tura de 12 ore» (else «Rezervare online · 21 standuri rezervabile», else the
 * action alone — never the name the pinned row shows) left, the main action right, the same rule as
 * the card: «Rezervă acum» with online booking, else «Sună» when there is a phone. It slides in
 * once the hero (with its own «Rezervă acum») has scrolled away (PhoneBar).
 */
function PhoneActionBar({ lake, from }: { lake: LakeDetail; from: From }) {
  const state = lakeBookingState(lake);
  const online = state === 'enabled';
  const phone = lakePhone(lake);
  // No main action at all (a phone-booking lake with no phone, no website): no bar (rule 4).
  if (!hasBookingControl({ bookingState: state, phone, website: lake.website })) return null;
  const stands = from ? null : bookableStands(lake);
  return (
    <PhoneBar
      label="Rezervare"
      summary={
        from === 'loading' ? (
          <span aria-hidden className={cn(BONE, 'h-5 w-28 rounded-full')} />
        ) : from ? (
          <p className="flex min-w-0 flex-col">
            <span className="flex items-baseline gap-1">
              <span className="t-caption text-muted">de la</span>
              <span className="t-body-strong tabular-nums">{formatInt(from.price)} RON</span>
            </span>
            {from.note ? <span className="truncate t-caption text-muted">{from.note}</span> : null}
          </p>
        ) : stands ? (
          // Not the name + rating: the pinned title row at the top already shows them (rule 4).
          <p className="flex min-w-0 flex-col">
            <span className="truncate t-body-strong">Rezervare online</span>
            <span className="truncate t-caption text-muted tabular-nums">{bookableLabel(stands)}</span>
          </p>
        ) : null
      }
    >
      {online || !phone ? (
        <BookingCta source="hero_cta" />
      ) : (
        <PhoneLink phone={phone} className={buttonClass({ variant: 'primary', className: '[&>svg]:size-5' })}>
          <PhoneIcon aria-hidden />
          Sună
        </PhoneLink>
      )}
    </PhoneBar>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Section-shaped placeholders (c32)
 * ---------------------------------------------------------------------------------------------- */

const BONE = 'block animate-shimmer';

/**
 * Concursuri while its two lists are read, shaped like what usually lands (one rail: a sub-heading
 * and CompetitionCards at their real height — banner + body), so the section does not jump when
 * the cards replace it. The common 0 + 0 case still removes the section; it sits below the fold.
 */
function CompetitionBones() {
  return (
    <DetailSection id="concursuri" title="Concursuri">
      <span aria-hidden className="flex flex-col gap-2.5">
        <span className={cn(BONE, 'h-5.5 w-20 rounded-full')} />
        <span className="flex gap-3 py-1 md:grid md:grid-cols-[repeat(auto-fill,minmax(--spacing(64),1fr))]">
          {[0, 1].map(i => (
            <span key={i} className={cn('flex w-64 shrink-0 flex-col overflow-hidden rounded-card shadow-e0 md:w-auto', i > 0 && 'max-md:hidden')}>
              <span className={cn(BONE, 'aspect-video w-full')} />
              <span className="flex flex-col gap-2 p-3.5">
                <span className={cn(BONE, 'h-4 w-3/4 rounded-full')} />
                <span className={cn(BONE, 'h-3.5 w-1/2 rounded-full')} />
                <span className={cn(BONE, 'h-3.5 w-2/3 rounded-full')} />
              </span>
            </span>
          ))}
        </span>
      </span>
      <span role="status" className="sr-only">
        Se încarcă…
      </span>
    </DetailSection>
  );
}

/** Shaped like the ReviewCards it stands for (header, three score rows, a comment line), one per
 * review the lake read says will come (at most two), so nothing shifts when they land. */
function ReviewBones({ count }: { count: number }) {
  return (
    <div aria-hidden className={REVIEWS_GRID}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="flex flex-col gap-3 rounded-card p-3.5 shadow-e0">
          <span className="flex items-center gap-2">
            <span className={cn(BONE, 'size-8 shrink-0 rounded-full')} />
            <span className="flex flex-1 flex-col gap-1.5">
              <span className={cn(BONE, 'h-3.5 w-28 rounded-full')} />
              <span className={cn(BONE, 'h-3 w-16 rounded-full')} />
            </span>
            <span className={cn(BONE, 'h-6 w-24 rounded-full')} />
          </span>
          <span className="flex flex-col gap-1">
            {[0, 1, 2].map(r => (
              <span key={r} className="flex h-5 items-center justify-between gap-3">
                <span className={cn(BONE, 'h-3 w-16 rounded-full')} />
                <span className={cn(BONE, 'h-4 w-22 rounded-full')} />
              </span>
            ))}
          </span>
          <span className={cn(BONE, 'h-3.5 w-3/4 rounded-full')} />
        </span>
      ))}
    </div>
  );
}
