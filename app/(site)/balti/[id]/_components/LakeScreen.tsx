import Link from 'next/link';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { PaperAirplaneIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { ErrorState } from '@/components/surfaces/StateCard';
import {
  DetailPhotoHero,
  DetailAsideCard,
  DetailBackButton,
  DetailBand,
  DetailBody,
  DetailFacts,
  DetailHeader,
  DetailPage,
  DetailSection,
  DetailSectionNav,
  DetailSectionsProvider,
  DetailSectionToc,
  H3_CLASS,
  PHOTO_PILL,
  PRESENCE_ICON,
  richTextToPlain,
  SURFACE_PILL,
  type DetailSectionItem,
} from '@/components/templates/T3';
import { buttonClass } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
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
import { HydrateQueries } from '@/lib/client/hydration';
import { routes } from '@/lib/routes';
import { SetBreadcrumb } from '../../../_shell/SiteHeader';
import { lakeHref } from './availability';
import { BookingCta, DialogTrigger, LakeActionsProvider, ShareTrigger, type LakeInfo } from './LakeActions';
import { dynamicOnFailure, LATEST_REVIEWS, type LakeCompetitions, type LakeSections, type Settled } from './load';
import { lakeLocationLine } from './location';
import { MiniMap } from './MiniMap';
import { DescriptionPreview } from './DescriptionPreview';
import { PartideSection } from './PartideSection';
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
import { QuickActions } from './QuickActions';
import { ReviewCard } from './ReviewCard';
import { FocusAfterRetry, SectionRetry } from './RetryFocus';
import { SectionAction } from './SectionLink';

/*
 * Baltă — fish app/(app)/lakes/[lakeId].tsx on T3 (parity lakes.detail), one long scroll:
 *  - phone: photo hero (back, share, «Rezervă acum», photo pill) → title block (name + rating,
 *    location) → sticky chips (with the pinned mini title row) → white sections on the grey page:
 *    Prezentare (description, quick actions, characteristics), Facilități, Pești, Partide, Prețuri,
 *    Concursuri, Recenzii, Locație & contact (+ Administrator);
 *  - 768: the header first, the photos as a rounded mosaic, the chips stuck under the bar;
 *  - ≥1280: left the section index, centre the sections, right the booking card and the
 *    characteristics (sticky).
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
    hasPartide: partide,
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
  return ids.map(id => ({ id, label: VENUE_SECTION_LABELS[id], hint: hint[id] }));
}

const partideVisible = (c: Settled<CommunityLakeSectionDTO>) => c.ok && hasPartideActivity(c.value);

/** Longer than this (plain text), the description is previewed with a fade + «Vezi mai mult» —
 * decided here so both are in the first paint (c13). ~5 phone lines. */
const DESCRIPTION_PREVIEW_CHARS = 200;

/** The latest reviews (and their bones): one column, from 768 an auto-fill grid of ≥288px cards. */
const REVIEWS_GRID = 'grid gap-3 md:grid-cols-[repeat(auto-fill,minmax(--spacing(72),1fr))]';

/** Focus clearance under the pinned rows, for every focusable in the page (see DetailPage). */
const FOCUS_CLEARANCE =
  '[&_:is(a,button,input,textarea,select,[tabindex])]:scroll-mt-43 md:[&_:is(a,button,input,textarea,select,[tabindex])]:scroll-mt-34 xl:[&_:is(a,button,input,textarea,select,[tabindex])]:scroll-mt-22';

export function LakeScreen({ lake, sections }: { lake: LakeDetail; sections: LakeSections }) {
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
  };

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
            {/*
              fish LakeHero on the T3 photo hero (c4 – c7). The photos open the gallery once it is on
              the web (TODO(kit): DetailPhotoHero `photoHref`); until then they are pictures. Without
              a photo, the kit's token placeholder and the overlays on the `page` ground.
            */}
            <DetailPhotoHero
              className="md:order-1"
              photos={photos}
              label={`Fotografii ${lake.name}`}
              topStart={<DetailBackButton fallbackHref={routes.lakes()} ground={hasPhoto ? 'photo' : 'page'} />}
              topEnd={hasPhoto ? <ShareTrigger onPhoto /> : <ShareTrigger ground="page" />}
              bottomStart={
                <div className="md:hidden">
                  <BookingCta source="hero_cta" />
                </div>
              }
              bottomEnd={
                <Suspense fallback={null}>
                  <PhotoPill lake={lake} total={sections.catchesTotal} onPhoto={hasPhoto} />
                </Suspense>
              }
            />
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
              actions={
                <>
                  <ShareTrigger look="button" />
                  {/* ≥1280 the booking lives in the right column. */}
                  <BookingCta source="hero_cta" className="xl:hidden" />
                </>
              }
              className="md:pt-5"
            />
          </DetailBand>

          <DetailSectionNav
            label="Secțiunile bălții"
            pinnedTitle={lake.name}
            pinnedMeta={<RatingMeta meta={lake.reviewsMeta} />}
            pinnedEnd={<ShareTrigger size="size-11" />}
          />

          <DetailBody
            left={<DetailSectionToc title="Pe această pagină" />}
            leftLabel="Cuprins"
            aside={
              <>
                <DetailAsideCard title="Rezervare">
                  <BookingCard lake={lake} />
                </DetailAsideCard>
                {facts.length ? (
                  <DetailAsideCard title="Caracteristici">
                    <DetailFacts facts={facts} layout="list" />
                  </DetailAsideCard>
                ) : null}
              </>
            }
            asideLabel="Rezervare și caracteristici"
            asideBelowXl="hidden"
            asideSticky
          >
            {/* With a description the kit's own title names the region (fish «Descriere»). Without
                one the section is the quick actions + characteristics only: a visually hidden h2.
                TODO(kit): a DetailSection `titleHidden` option, then this sr-only h2 goes. */}
            <DetailSection id="prezentare" title={lake.description?.length ? 'Descriere' : undefined}>
              <div className="flex flex-col gap-5.5">
                {lake.description?.length ? (
                  <DescriptionPreview blocks={lake.description} long={richTextToPlain(lake.description).length > DESCRIPTION_PREVIEW_CHARS} />
                ) : (
                  <h2 className="sr-only">Prezentare</h2>
                )}
                {/* ≥1280 the section index, the booking card and Contact carry the same actions. */}
                <QuickActions lakeId={id} hasPrices={lake.price.length > 0} hasCoordinates={!!coords} className="xl:hidden" />
                {facts.length ? (
                  <div className="flex flex-col gap-3 xl:hidden">
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
                <div className="flex flex-col gap-3.5">
                  {coords ? <MiniMap lat={coords.lat} lng={coords.lng} href={lakeHref('map', routes.lakeMap(id))} name={lake.name} /> : null}
                  {/* fish shows Direcții whenever there are coordinates (c31): here at every width —
                      from 1280 the quick-action tiles are hidden and this is the way to it. */}
                  {coords ? (
                    <DialogTrigger dialog="directions" className={buttonClass({ variant: 'secondary', className: 'self-start [&>svg]:size-5' })}>
                      <PaperAirplaneIcon aria-hidden />
                      Direcții
                    </DialogTrigger>
                  ) : null}
                  <ContactRows lake={lake} />
                  <div className="mt-2 flex flex-col gap-2">
                    <h3 className={H3_CLASS}>Administrator</h3>
                    <OwnerCard lake={lake} />
                  </div>
                </div>
              </DetailSection>
            ) : null}
          </DetailBody>
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
 * gallery once that page is on the web; until then it is the count alone.
 */
async function PhotoPill({ lake, total, onPhoto }: { lake: LakeDetail; total: Promise<Settled<number>>; onPhoto: boolean }) {
  const catches = await dynamicOnFailure(total);
  const count = lake.images.length + (catches.ok ? catches.value : 0);
  if (count <= 0) return null;
  const pill = onPhoto ? PHOTO_PILL : SURFACE_PILL;
  const href = lakeHref('gallery', routes.lakeGallery(lake.documentId));
  const label = `${count} ${count === 1 ? 'fotografie' : 'fotografii'}`;
  return href ? (
    <Link href={href} className={cn(pill, 'hover:brightness-110')} aria-label={`Galerie: ${label}`}>
      <PhotoIcon aria-hidden />
      {count}
    </Link>
  ) : (
    <p className={pill} data-testid="lake-photo-count">
      <PhotoIcon aria-hidden />
      <span aria-hidden>{count}</span>
      <span className="sr-only">{label}</span>
    </p>
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

async function Competitions({ lakeId, competitions: read }: { lakeId: string; competitions: Promise<LakeCompetitions> }) {
  const competitions = await read;
  const { live, upcoming } = competitions;
  // A failed list renders per request, never into the static page (see load.ts).
  if (!live.ok || !upcoming.ok) await connection();
  if (live.ok && upcoming.ok && live.value.length + upcoming.value.length === 0) return null;
  return (
    <DetailSection id="concursuri" title="Concursuri" action={<SectionAction href={lakeHref('competitions', routes.lakeCompetitions(lakeId))}>Vezi tot</SectionAction>}>
      <CompetitionsBlock lakeId={lakeId} live={live} upcoming={upcoming} />
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
 * Booking card (≥1280, right column)
 * ---------------------------------------------------------------------------------------------- */

/**
 * The booking state, what it means, and the same «Rezervă acum» as the hero and the header (c16) —
 * one treatment per state at every width and session. While the booking flow is not on the web
 * the button leads to «Rezervă din aplicația Bluvi», and the card says so under it.
 */
function BookingCard({ lake }: { lake: LakeDetail }) {
  const state = lakeBookingState(lake);
  const appOnly = state === 'enabled' && !lakeHref('booking', routes.lakeBooking(lake.documentId));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {state === 'enabled' ? (
          <StatusPill tone="success">Rezervare online</StatusPill>
        ) : state === 'legacy_phone' ? (
          <StatusPill tone="neutral">Rezervare telefonică</StatusPill>
        ) : (
          <StatusPill tone="neutral">Fără rezervări online</StatusPill>
        )}
        {state === 'enabled' && lake.confirmationMode === 'instant' ? <Badge color="indigo">Confirmare instant</Badge> : null}
        {state === 'enabled' && lake.paymentMode === 'offline' ? <Badge color="gray">Plata la baltă</Badge> : null}
      </div>
      <p className="t-body text-ink-2">
        {state === 'enabled'
          ? `Alege standul și intervalul${lake.stands.length ? ` — ${lake.stands.length} ${lake.stands.length === 1 ? 'stand' : 'standuri'}` : ''}.`
          : state === 'legacy_phone'
            ? 'Balta primește rezervări la telefon.'
            : `${lake.name} nu acceptă încă rezervări prin Bluvi.`}
      </p>
      <BookingCta source="quick_action" block />
      {appOnly ? <p className="t-caption text-muted">Rezervarea online e în curând pe web; până atunci rezervă din aplicația Bluvi.</p> : null}
    </div>
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
