import {
  CalendarDaysIcon,
  ChartBarIcon,
  MapIcon,
  PaperAirplaneIcon,
  PhotoIcon,
  StarIcon,
  TagIcon,
  TrophyIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';
import { MapPinIcon } from '@heroicons/react/20/solid';
import { Suspense, type ReactNode } from 'react';
import { BreadcrumbBand } from '@/components/nav/Breadcrumbs';
import { ErrorState } from '@/components/surfaces/StateCard';
import {
  DetailAsideCard,
  DetailBackButton,
  DetailBand,
  DetailBody,
  DetailFacts,
  DetailHeader,
  DetailPage,
  DetailPhotoHero,
  DetailProse,
  DetailQuickActions,
  DetailRetry,
  DetailSection,
  DetailSectionNav,
  DetailSectionsProvider,
  DetailSectionToc,
  DetailShareButton,
  DetailSignInPrompt,
  H3_CLASS,
  PHOTO_PILL,
  PRESENCE_ICON,
  type DetailQuickAction,
  type DetailSectionItem,
} from '@/components/templates/T3';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { ButtonLink } from '@/components/ui/Button';
import { getLakeLocationSubtitle, type LakeDetail, type Review } from '@/core/lakes';
import type { CommunityLakeSectionDTO } from '@/core/partide';
import { routes } from '@/lib/routes';
import type { LakeCompetitions, LakeScreenData, Settled } from './data';
import type { DemoViewer } from './viewer';
import {
  BookingCard,
  bookingAction,
  ChipList,
  CompetitionsBlock,
  ContactBlock,
  hasPartideActivity,
  HeroBookingCta,
  lakeFacts,
  mapsHref,
  OwnerCard,
  PartideBlock,
  PricesList,
  RatingLink,
  RatingText,
  ReviewItem,
  ReviewsBlock,
  type Session,
  ReviewsMoreAction,
  SectionSoon,
  VerifiedBadge,
} from './lake-parts';
import { LONG_TITLE, type DemoState } from './states';

/*
 * The lake page's first screen on T3 — fish app/(app)/lakes/[lakeId].tsx:
 *  - phone: photo hero (back, share, «Rezervă acum», photo count) → title block (name + rating,
 *    location) → sticky chips (pinned mini title) → white sections on grey: Prezentare
 *    (description, quick actions, characteristics), Facilități, Pești, Partide, Prețuri,
 *    Concursuri, Recenzii, Locație & contact (+ Administrator).
 *  - 768: header first, the photos as a rounded mosaic, the chips stick under the bar.
 *  - ≥1280: left = the section index; centre = the sections; right = booking, characteristics.
 *
 * The session is tri-state: 'unknown' (the read timed out) shows no sign-in gate, no sign-in
 * booking link and no owner link — only what does not depend on the account.
 *
 * Streaming (lakes.detail.c32): the page renders as soon as the LAKE is read. The session and the
 * three secondary reads (Partide, Concursuri, Recenzii) arrive as promises and each part that
 * needs one sits behind its own Suspense: the booking CTAs, the owner link and the Statistici gate
 * wait for the session; each section waits for its own read, its skeleton in its place. The
 * section nav starts from what the lake read knows (Partide / Concursuri shown until their reads
 * say they are empty) and takes the final list when everything has landed.
 */

type Props = { data: LakeScreenData; state: DemoState; viewer: Promise<DemoViewer>; signIn: string };

/** The demo states reshape the real read; everything else is the CMS's answer. */
function shape(data: LakeScreenData, state: DemoState): LakeScreenData {
  const { lake } = data;
  switch (state) {
    case 'empty':
      return {
        lake: {
          ...lake,
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
        community: Promise.resolve({ ok: true, value: { stats: { activeNow: 0, catchesThisMonth: 0, recordKg: null }, activeSessions: [], monthlyActivity: [] } }),
        reviews: Promise.resolve({ ok: true, value: [] }),
        competitions: Promise.resolve({ ok: true, value: { live: [], upcoming: [] } }),
      };
    case 'section-error': {
      const failed = Promise.resolve({ ok: false } as const);
      return { lake, community: failed, reviews: failed, competitions: failed };
    }
    case 'no-photo':
      return { ...data, lake: { ...lake, images: [] } };
    case 'gallery': {
      const extra = ['/images/lake.jpeg', '/images/placeholder-lake.jpg', '/images/competition-placeholder.jpg'].map(url => ({
        url,
        mediumUrl: null,
        smallUrl: null,
        blurhash: null,
      }));
      return { ...data, lake: { ...lake, images: [...lake.images, ...extra] } };
    }
    case 'long-title':
      return { ...data, lake: { ...lake, name: LONG_TITLE } };
    case 'booking-phone':
      // fish bookingState 'legacy_phone': the CTA and the Rezervă tile go to the contact section.
      return { ...data, lake: { ...lake, bookingEnabled: false, acceptsReservations: true } };
    case 'no-coords':
      // No map pin: no Direcții / Hartă tiles, no Google Maps button; the address and phones stay.
      return { ...data, lake: { ...lake, coordinates: null } };
    case 'no-booking':
      // fish bookingState 'none': the demand-signal path (Aș vrea să pot rezerva aici).
      return { ...data, lake: { ...lake, bookingEnabled: false, acceptsReservations: false } };
    case 'no-operator':
      return { ...data, lake: { ...lake, ownerName: null, ownerDocumentId: null, hasOwner: false } };
    case 'owner-no-id':
      // The operator has no public profile id: the card is shown, not linked (lakes.detail.c29).
      return { ...data, lake: { ...lake, ownerName: lake.ownerName ?? 'Administratorul bălții', ownerDocumentId: null, hasOwner: true } };
    default:
      return data;
  }
}

/**
 * fish lakeDetailLogic#buildLakeSectionChips (fish VENUE_SECTION_ORDER / VENUE_SECTION_LABELS).
 * `partide` / `competitions` null: not read yet — the section is shown (fish shows them until the
 * counts arrive); `gatedStats`: the signed-out Statistici gate (only once the session is known).
 */
function sectionsFor(lake: LakeDetail, partide: boolean | null, competitions: Settled<LakeCompetitions> | null, gatedStats: boolean): DetailSectionItem[] {
  // The claim path lives in Contact: a lake without an operator keeps it even with no contact data.
  const contactData = hasContactData(lake);
  // fish: shown until the counts arrive, and whenever they cannot (error); hidden at 0 + 0.
  const competitionCount = competitions?.ok ? competitions.value.live.length + competitions.value.upcoming.length : null;
  // With no description, Prezentare has nothing to show from 1280 (the quick actions and the
  // characteristics move to the side columns): it is xl:hidden, and out of the ≥1280 index.
  const intro = !!lake.description?.length;
  const visible: [string, string, boolean, (string | number)?, boolean?][] = [
    ['prezentare', 'Prezentare', true, undefined, !intro],
    ['facilitati', 'Facilități', lake.facility.length > 0, lake.facility.length],
    ['pesti', 'Pești', lake.fishSpecies.length > 0, lake.fishSpecies.length],
    ['partide', 'Partide', partide ?? true],
    // Demo of the signed-out gate (fish venue stats need an account); not a fish chip.
    ['statistici', 'Statistici', gatedStats],
    ['preturi', 'Prețuri', lake.price.length > 0],
    ['concursuri', 'Concursuri', competitionCount === null || competitionCount > 0, competitionCount ?? undefined],
    ['recenzii', 'Recenzii', true, lake.reviewsMeta?.count || undefined],
    ['contact', contactData ? 'Contact' : 'Administrator', contactData || !lake.hasOwner],
  ];
  return visible.filter(([, , on]) => on).map(([id, label, , hint, hideFromXl]) => ({ id, label, hint, hideFromXl }));
}

const hasContactData = (lake: LakeDetail) => !!(lake.address || lake.website || lake.contact.length > 0 || lake.coordinates);

/** The session as the lake page reads it, from the tri-state viewer. */
const toSession = (v: DemoViewer): Session => (v === 'unknown' ? 'unknown' : v ? 'in' : 'out');

/** A failed Partide read is not «no activity»: the section stays, with its error. */
const showPartide = (c: Settled<CommunityLakeSectionDTO>) => !c.ok || hasPartideActivity(c.value);

export function LakeScreen({ data: raw, state, viewer, signIn }: Props) {
  const data = shape(raw, state);
  const { lake } = data;
  const session = viewer.then(toSession);
  // The nav: first from the lake read alone, then the final list once the session and the reads land.
  const initialSections = sectionsFor(lake, null, null, false);
  const refinedSections = Promise.all([data.community, data.competitions, session]).then(([community, competitions, s]) =>
    sectionsFor(lake, showPartide(community), competitions, s === 'out'),
  );
  const location = getLakeLocationSubtitle(lake);
  const facts = lakeFacts(lake);
  // The original (the largest file the CMS has): the 1280 strip is 1216px wide, the CMS `medium`
  // only 750 — next/image's `sizes` brings it down for the phone.
  const photos = lake.images.map(img => ({ src: img.url || img.mediumUrl || img.smallUrl || '' })).filter(p => p.src);
  const hasPhoto = photos.length > 0;
  const shareText = `Intră în Bluvi să vezi balta ${lake.name}`;
  const photoCount = lake.images.length;

  return (
    <>
      <BreadcrumbBand trail={[{ label: 'Bălți', href: routes.lakes() }, { label: lake.name }]} />
      <DetailSectionsProvider sections={initialSections} refined={refinedSections}>
        <DetailPage phoneGround="page">
          <DetailBand hairline={false}>
            {/*
              The hero first in the DOM: on the phone it leads, and Tab follows what is seen (back,
              share, the hero CTA, then the title and its rating). From 768 `md:order-1` puts it under the title.
              Without a photo the chips sit on the soft-fill placeholder: the `page` ground, not the scrim.
            */}
            <DetailPhotoHero
              className="md:order-1"
              photos={photos}
              label={`Fotografii ${lake.name}`}
              topStart={<DetailBackButton fallbackHref={routes.lakes()} ground={hasPhoto ? 'photo' : 'page'} />}
              topEnd={
                <DetailShareButton look={hasPhoto ? 'photo' : 'chip'} ground={hasPhoto ? undefined : 'page'} title={lake.name} text={shareText} label="Distribuie balta" />
              }
              bottomStart={
                <div className="md:hidden">
                  <WithSession session={session}>
                    {s => <HeroBookingCta lake={lake} session={s} signIn={signIn} onPhoto={hasPhoto} />}
                  </WithSession>
                </div>
              }
              bottomEnd={<PhotoCountPill count={photoCount} />}
            />
            <DetailHeader
              title={lake.name}
              titleId="balta-titlu"
              eyebrow={lake.countyRef?.name ? `Baltă · ${lake.countyRef.name}` : 'Baltă'}
              titleAside={<RatingLink meta={lake.reviewsMeta} />}
              meta={[
                location ? (
                  <span key="loc" className="inline-flex items-center gap-1 t-label">
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
                  <DetailShareButton look="button" title={lake.name} text={shareText} />
                  {/* ≥1280 the booking lives in the right column. 768–1279 the share is icon-only, so the pair fits beside the title. */}
                  <WithSession session={session}>
                    {s => {
                      const booking = bookingAction(lake, s, signIn);
                      return booking.href ? (
                        <ButtonLink href={booking.href} icon={<CalendarDaysIcon />} className="xl:hidden">
                          Rezervă acum
                        </ButtonLink>
                      ) : null;
                    }}
                  </WithSession>
                </>
              }
              className="md:pt-5"
            />
          </DetailBand>

          <DetailSectionNav
            label="Secțiunile bălții"
            pinnedTitle={lake.name}
            pinnedMeta={<RatingText meta={lake.reviewsMeta} />}
            pinnedEnd={<DetailShareButton title={lake.name} text={shareText} label="Distribuie balta" size="size-11" />}
          />

          <DetailBody
            left={<DetailSectionToc title="Pe această pagină" />}
            leftLabel="Cuprins"
            aside={
              <>
                <DetailAsideCard title="Rezervare">
                  <WithSession session={session} fallback={<BookingCardBones />}>
                    {s => <BookingCard lake={lake} session={s} signIn={signIn} />}
                  </WithSession>
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
            <DetailSection id="prezentare" className={lake.description?.length ? undefined : 'xl:hidden'}>
              <div className="flex flex-col gap-5.5">
                {lake.description?.length ? (
                  // The same heading-to-content step as every DetailSection title (12 / 16).
                  <div className="flex flex-col gap-3 xl:gap-4">
                    <h2 className="t-title2">Descriere</h2>
                    <DetailProse blocks={lake.description} collapsed stripLeadingLabel="Descriere" />
                  </div>
                ) : (
                  <h2 className="sr-only">Prezentare</h2>
                )}
                {/* ≥1280 the section index and the booking card already carry these jumps. */}
                <Suspense fallback={<QuickActionsBones />}>
                  <LakeQuickActions lake={lake} data={data} session={session} signIn={signIn} />
                </Suspense>
                {/* ≥1280 the characteristics are in the right column. */}
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
                <ChipList label="Facilități" items={lake.facility.map(f => f.name)} />
              </DetailSection>
            ) : null}

            {lake.fishSpecies.length > 0 ? (
              <DetailSection id="pesti" title="Pești în această zonă">
                <ChipList label="Specii de pești" items={lake.fishSpecies.map(f => f.fish.Name)} />
              </DetailSection>
            ) : null}

            <Suspense fallback={<SectionBones id="partide" title="Partide la această baltă" />}>
              <PartideSection community={data.community} />
            </Suspense>

            <WithSession session={session}>
              {s =>
                s === 'out' ? (
                  <DetailSection id="statistici" title="Statistici">
                    <DetailSignInPrompt message="Trebuie să fii autentificat pentru a vedea statisticile." href={signIn} />
                  </DetailSection>
                ) : null
              }
            </WithSession>

            {lake.price.length > 0 ? (
              <DetailSection id="preturi" title="Prețuri">
                <PricesList prices={lake.price} />
              </DetailSection>
            ) : null}

            <Suspense fallback={<SectionBones id="concursuri" title="Concursuri" />}>
              <CompetitionsSection competitions={data.competitions} />
            </Suspense>

            <DetailSection id="recenzii" title="Recenzii" action={<ReviewsMoreAction count={lake.reviewsMeta?.count ?? 0} />}>
              <ReviewsBlock meta={lake.reviewsMeta}>
                <Suspense fallback={<ReviewBones />}>
                  <LatestReviews reviews={data.reviews} />
                </Suspense>
              </ReviewsBlock>
            </DetailSection>

            {hasContactData(lake) || !lake.hasOwner ? (
              <DetailSection id="contact" title={hasContactData(lake) ? 'Locație & contact' : 'Administrator'}>
                <ContactBlock
                  lake={lake}
                  ownerHeading={hasContactData(lake)}
                  owner={
                    // Until the session is known the card is shown unlinked (as for 'unknown'): same box, no shift.
                    <WithSession session={session} fallback={<OwnerCard lake={lake} session="unknown" signIn={signIn} />}>
                      {s => <OwnerCard lake={lake} session={s} signIn={signIn} />}
                    </WithSession>
                  }
                />
              </DetailSection>
            ) : null}
          </DetailBody>
        </DetailPage>
      </DetailSectionsProvider>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Streamed parts
 * ---------------------------------------------------------------------------------------------- */

/** Renders `children(session)` once the session read answers; `fallback` (default nothing) meanwhile. */
function WithSession({ session, fallback = null, children }: { session: Promise<Session>; fallback?: ReactNode; children: (s: Session) => ReactNode }) {
  return (
    <Suspense fallback={fallback}>
      <SessionResolved session={session}>{children}</SessionResolved>
    </Suspense>
  );
}

async function SessionResolved({ session, children }: { session: Promise<Session>; children: (s: Session) => ReactNode }) {
  return children(await session);
}

/** fish quickActions, in its order. Subpages not on the web yet are shown, not linked. */
async function LakeQuickActions({ lake, data, session: sessionRead, signIn }: { lake: LakeDetail; data: LakeScreenData; session: Promise<Session>; signIn: string }) {
  const [community, competitions, session] = await Promise.all([data.community, data.competitions, sessionRead]);
  const sections = sectionsFor(lake, showPartide(community), competitions, session === 'out');
  const has = (id: string) => sections.some(s => s.id === id);
  const booking = bookingAction(lake, session, signIn);
  const directions = mapsHref(lake);
  const activeNow = community.ok ? community.value.stats.activeNow : 0;
  const liveCount = competitions.ok ? competitions.value.live.length : 0;
  const actions: DetailQuickAction[] = [
    { key: 'rezerva', label: 'Rezervă', icon: <CalendarDaysIcon />, href: booking.href },
    ...(lake.price.length ? [{ key: 'preturi', label: 'Prețuri', icon: <TagIcon />, href: '#preturi' }] : []),
    { key: 'partide', label: 'Partide', icon: <UsersIcon />, badge: activeNow || undefined },
    { key: 'statistici', label: 'Statistici', icon: <ChartBarIcon />, href: has('statistici') ? '#statistici' : undefined },
    { key: 'concursuri', label: 'Concursuri', icon: <TrophyIcon />, badge: liveCount || undefined, href: has('concursuri') ? '#concursuri' : undefined },
    ...(directions
      ? [
          { key: 'directii', label: 'Direcții', icon: <PaperAirplaneIcon />, href: directions, external: true },
          { key: 'harta', label: 'Hartă', icon: <MapIcon /> },
        ]
      : []),
    { key: 'recenzii', label: 'Recenzii', icon: <StarIcon />, href: '#recenzii' },
  ];
  return <DetailQuickActions actions={actions} className="xl:hidden" />;
}

async function PartideSection({ community: read }: { community: Promise<Settled<CommunityLakeSectionDTO>> }) {
  const community = await read;
  if (!showPartide(community)) return null;
  return (
    <DetailSection id="partide" title="Partide la această baltă" action={community.ok ? <SectionSoon>Vezi tot</SectionSoon> : undefined}>
      {community.ok ? (
        <PartideBlock data={community.value} />
      ) : (
        <ErrorState title="Partidele nu au putut fi încărcate." action={<DetailRetry />} />
      )}
    </DetailSection>
  );
}

async function CompetitionsSection({ competitions: read }: { competitions: Promise<Settled<LakeCompetitions>> }) {
  const competitions = await read;
  if (competitions.ok && competitions.value.live.length + competitions.value.upcoming.length === 0) return null;
  return (
    <DetailSection id="concursuri" title="Concursuri">
      {competitions.ok ? (
        <CompetitionsBlock live={competitions.value.live} upcoming={competitions.value.upcoming} />
      ) : (
        // fish LakeCompetitionsSection error copy.
        <ErrorState title="A apărut o eroare la încărcarea datelor." action={<DetailRetry />} />
      )}
    </DetailSection>
  );
}

async function LatestReviews({ reviews: read }: { reviews: Promise<Settled<Review[]>> }) {
  const reviews = await read;
  if (!reviews.ok) return <ErrorState title="Recenziile nu au putut fi încărcate." action={<DetailRetry />} />;
  return reviews.value.map(review => <ReviewItem key={review.documentId} review={review} />);
}

/* ------------------------------------------------------------------------------------------------
 * Section-shaped skeletons (bones on the type steps of what they stand for)
 * ---------------------------------------------------------------------------------------------- */

const BONE = 'block animate-shimmer';

/** A streamed section while its read runs: its real title (the chip still lands on it) and grey lines. */
function SectionBones({ id, title }: { id: string; title: string }) {
  return (
    <DetailSection id={id} title={title}>
      <span aria-hidden className="flex flex-col gap-3">
        <span className={cn(BONE, 'h-16 rounded-card')} />
        <span className={cn(BONE, 'h-3 w-[70%] rounded-full')} />
        <span className={cn(BONE, 'h-3 w-[45%] rounded-full')} />
      </span>
      <span className="sr-only">Se încarcă…</span>
    </DetailSection>
  );
}

/** The latest reviews while they load: one review's shape (avatar, name, date). */
function ReviewBones() {
  return (
    <span aria-hidden className="flex items-center gap-3 border-t border-hairline pt-4">
      <span className={cn(BONE, 'size-10 shrink-0 rounded-full')} />
      <span className="flex flex-1 flex-col gap-2">
        <span className={cn(BONE, 'h-3 w-32 rounded-full')} />
        <span className={cn(BONE, 'h-2.5 w-24 rounded-full')} />
      </span>
    </span>
  );
}

/** The quick actions while the session and the counts load: the heading and the 64px tiles. */
function QuickActionsBones() {
  return (
    <div aria-hidden className="flex flex-col gap-3.5 xl:hidden">
      <span className={cn(BONE, 'h-4 w-32 rounded-full')} />
      <span className="grid grid-cols-[repeat(auto-fill,--spacing(16))] justify-start gap-x-6">
        {[0, 1, 2, 3].map(i => (
          <span key={i} className="flex flex-col items-center gap-2">
            <span className={cn(BONE, 'size-16 rounded-card')} />
            <span className={cn(BONE, 'h-2.5 w-12 rounded-full')} />
          </span>
        ))}
      </span>
    </div>
  );
}

/** The booking card while the session loads: the pill, a line, the button. */
function BookingCardBones() {
  return (
    <span aria-hidden className="flex flex-col gap-3">
      <span className={cn(BONE, 'h-6.5 w-32 rounded-full')} />
      <span className={cn(BONE, 'h-3 w-[90%] rounded-full')} />
      <span className={cn(BONE, 'h-10 rounded-control')} />
    </span>
  );
}

/**
 * The photo count over the hero, only where it says something: on the phone carousel when there is
 * more than one photo to swipe to; from 768, where the mosaic shows three, «+N» for the ones it
 * hides. The gallery is not on the web yet, so it is not a control: the T3 unavailable hint rides
 * with it, visible.
 */
function PhotoCountPill({ count }: { count: number }) {
  const hidden = count - 3;
  if (count <= 1) return null;
  return (
    <>
      <span className={cn(PHOTO_PILL, 'md:hidden')}>
        <PhotoIcon aria-hidden />
        <span className="sr-only">Fotografii:</span>
        {count}
      </span>
      {hidden > 0 ? (
        <span aria-disabled="true" className={cn(PHOTO_PILL, 'max-md:hidden')}>
          <PhotoIcon aria-hidden />
          {`+${hidden} ${hidden === 1 ? 'fotografie' : 'fotografii'}`}
          <span className="t-micro">· galeria în curând</span>
        </span>
      ) : null}
    </>
  );
}
