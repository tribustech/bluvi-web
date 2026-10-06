import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLongDownIcon,
  ArrowsPointingOutIcon,
  ArrowTopRightOnSquareIcon,
  CalendarDaysIcon,
  FlagIcon,
  GlobeAltIcon,
  MapPinIcon,
  PhoneIcon,
  Squares2X2Icon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon, StarIcon } from '@heroicons/react/20/solid';
import { CompetitionCard } from '@/components/cards/CompetitionCard';
import { formatDecimal, formatInt, plural } from '@/components/cards/format';
import { FishOutlineIcon } from '@/components/nav/brand';
import { EmptyState } from '@/components/surfaces/StateCard';
import { DetailUnavailable, DetailUnavailableButton, H3_CLASS, PHOTO_PILL, PRESENCE_ICON, SURFACE_PILL, type DetailFact } from '@/components/templates/T3';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { StatusPill } from '@/components/ui/StatusPill';
import { formatReviewsCount, getLakeRatingDisplay, type LakeDetail, type Review, type ReviewMeta } from '@/core/lakes';
import type { CommunityLakeSectionDTO } from '@/core/partide';
import { routes } from '@/lib/routes';
import { competitionDateLabel } from '../../../(site)/concursuri/[id]/_components/dates';
import type { LakeCompetition } from './data';
import { LiveDot } from '@/components/templates/LiveDot';

/*
 * The lake page's section contents for the T3 demo — fish features/lakes/detail/* and
 * features/partide/components/community/VenuePartideSection. Demo-only: the lake page (M1) will
 * own these; the template only lays them out.
 */

/** fish lakeDetailLogic#hasPartideActivity — mirrors the section's own no-activity gate. */
export function hasPartideActivity(d: CommunityLakeSectionDTO | null | undefined): boolean {
  if (!d) return false;
  const { activeNow, catchesThisMonth, recordKg } = d.stats;
  if (activeNow > 0 || catchesThisMonth > 0 || recordKg != null) return true;
  return d.monthlyActivity.some(m => m.count > 0);
}

/** The session as the lake page reads it: signed in, signed out, or not known (the read timed out). */
export type Session = 'in' | 'out' | 'unknown';

/** fish lakeDetail `bookingState`: the three reservation modes behind one affordance. */
export function bookingState(lake: LakeDetail): 'enabled' | 'legacy_phone' | 'none' {
  return lake.bookingEnabled ? 'enabled' : lake.acceptsReservations ? 'legacy_phone' : 'none';
}

/* ------------------------------------------------------------------------------------------------
 * Rating (title aside, pinned row)
 * ---------------------------------------------------------------------------------------------- */

/**
 * fish title block: ★ 4,33 · 1 recenzie, a link to the Recenzii section. The star is the solid
 * presence icon at the size of the bodyStrong score beside it (PRESENCE_ICON.strong); with no
 * rating yet the star is faint — nothing to mark — next to «Fără recenzii».
 */
export function RatingLink({ meta }: { meta: ReviewMeta | null }) {
  const r = getLakeRatingDisplay(meta);
  return (
    <a
      href="#recenzii"
      aria-label={`${r.accessibilityLabel}. Mergi la recenzii`}
      className="-m-1 flex items-center gap-1.25 rounded-control p-1 whitespace-nowrap hover:bg-soft-fill"
    >
      <StarIcon aria-hidden className={cn(PRESENCE_ICON.strong, r.scoreLabel ? 'text-rating' : 'text-faint')} />
      {r.scoreLabel ? <span className="t-body-strong">{r.scoreLabel}</span> : null}
      <span className="t-caption text-muted">{r.reviewsLabel}</span>
    </a>
  );
}

/** The pinned row's meta (plain text, the row itself is not a link). */
export function RatingText({ meta }: { meta: ReviewMeta | null }) {
  const r = getLakeRatingDisplay(meta);
  return (
    <>
      <StarIcon aria-hidden className={cn(PRESENCE_ICON.meta, r.scoreLabel ? 'text-rating' : 'text-faint')} />
      {r.label}
    </>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Characteristics (fish LakeCharacteristics#buildStats)
 * ---------------------------------------------------------------------------------------------- */

export function lakeFacts(lake: LakeDetail): DetailFact[] {
  const facts: DetailFact[] = [];
  if (lake.surface != null) facts.push({ key: 'surface', icon: <ArrowsPointingOutIcon />, value: `${formatDecimal(lake.surface, 0)} ha`, label: 'Suprafață' });
  if (lake.depth && (lake.depth.min != null || lake.depth.max != null)) {
    facts.push({ key: 'depth', icon: <ArrowLongDownIcon />, value: `${lake.depth.min ?? '?'} – ${lake.depth.max ?? '?'} m`, label: 'Adâncime' });
  }
  if (lake.numberOfSeats != null) facts.push({ key: 'seats', icon: <Squares2X2Icon />, value: `${lake.numberOfSeats} locuri`, label: 'Standuri pescuit' });
  if (lake.regime) facts.push({ key: 'regime', icon: <FishOutlineIcon />, value: lake.regime, label: 'Regim de pescuit' });
  if (lake.fishingType) facts.push({ key: 'fishingType', icon: <FlagIcon />, value: lake.fishingType, label: 'Tip de pescuit' });
  if (lake.fishingSpotTypes) facts.push({ key: 'fishingSpotTypes', icon: <MapPinIcon />, value: lake.fishingSpotTypes, label: 'Loc de pescuit' });
  return facts;
}

/* ------------------------------------------------------------------------------------------------
 * Attribute lists (facilities, fish species)
 * ---------------------------------------------------------------------------------------------- */

/** Facilities and fish species are attributes of the lake: kit Badges (radius 2), not state pills. */
export function ChipList({ items, label }: { items: string[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-wrap gap-1.5">
      {items.map(item => (
        <li key={item} className="flex">
          <Badge color="gray">{item}</Badge>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Partide (fish VenuePartideSection: live card, 7-month activity, «Vezi toate partidele»)
 * ---------------------------------------------------------------------------------------------- */

export function PartideBlock({ data }: { data: CommunityLakeSectionDTO }) {
  const { stats, monthlyActivity } = data;
  const max = Math.max(1, ...monthlyActivity.map(m => m.count));
  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {/* fish LivePartideCard's three numbers, as compact tiles (a BentoTile is 156px tall). */}
      <dl className="grid grid-cols-3 gap-2 md:gap-3">
        <Stat label="Activi acum" value={formatInt(stats.activeNow)} live={stats.activeNow > 0} />
        <Stat label="Capturi/lună" spoken="Capturi luna asta" value={formatInt(stats.catchesThisMonth)} />
        <Stat label="Record" value={stats.recordKg != null ? formatDecimal(stats.recordKg, 0, 2) : '—'} unit={stats.recordKg != null ? 'kg' : undefined} />
      </dl>
      {monthlyActivity.length ? (
        <figure className="flex flex-col gap-2.5 rounded-card bg-page p-3 md:p-4">
          <figcaption className="flex items-baseline justify-between gap-2">
            <span className="t-body-strong">Activitate</span>
            <span className="t-micro text-muted">ultimele {monthlyActivity.length} luni</span>
          </figcaption>
          <ul className="flex h-24 items-end gap-2">
            {monthlyActivity.map(m => (
              <li key={m.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="t-micro-strong text-ink-2 tabular-nums">{m.count || ''}</span>
                <span
                  aria-hidden
                  className={cn('w-full max-w-8 rounded-t-badge', m.count ? 'bg-accent' : 'bg-accent-tint-2')}
                  style={{ height: `${Math.max(6, (m.count / max) * 100)}%` }}
                />
                <span className="t-micro text-muted">
                  <span className="sr-only">{`${m.month}: ${plural(m.count, 'partidă', 'partide')}`}</span>
                  <span aria-hidden>{m.month}</span>
                </span>
              </li>
            ))}
          </ul>
        </figure>
      ) : null}
    </div>
  );
}

/**
 * The house tile pattern (as DetailFacts): the number leads, the caption under it on one line, so
 * the three numbers share a top line whatever the caption's length. `spoken` is the full caption
 * when the visible one is shortened for the 3-up phone row.
 */
function Stat({ label, spoken, value, unit, live = false }: { label: string; spoken?: string; value: string; unit?: string; live?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-card bg-page p-3 md:p-4">
      {/* dt first in the DOM (a valid group), drawn under the value. */}
      <dt className="order-last flex min-w-0 items-center gap-1.5 t-label text-muted" title={spoken}>
        {live ? <LiveDot /> : null}
        <span className="truncate" aria-hidden={spoken ? true : undefined}>
          {label}
        </span>
        {spoken ? <span className="sr-only">{spoken}</span> : null}
      </dt>
      <dd className="flex items-baseline gap-0.5 t-stat">
        {value}
        {unit ? <span className="t-label text-muted">{unit}</span> : null}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Competitions (fish LakeCompetitionsSection: Live, then Viitoare, five each)
 * ---------------------------------------------------------------------------------------------- */

export function CompetitionsBlock({ live, upcoming }: { live: LakeCompetition[]; upcoming: LakeCompetition[] }) {
  return (
    <div className="flex flex-col gap-4">
      {live.length ? <CompetitionRail title="Live" items={live} live /> : null}
      {upcoming.length ? <CompetitionRail title="Viitoare" items={upcoming} /> : null}
    </div>
  );
}

function CompetitionRail({ title, items, live = false }: { title: string; items: LakeCompetition[]; live?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className={H3_CLASS}>{title}</h3>
      {/*
        Phone: a sideways rail (fish HorizontalCompetitionsList); wider: an auto-fill grid. The rail
        pattern: bleed to the screen edge (-mx-4 px-4) and snap with the same scroll padding, so each
        snap lands a card on the 16px shell gutter, never flush with the screen edge. py-1 + the
        ring on the <li>: CardShell clips its title link's own focus ring (overflow-hidden), so the
        card's ring is drawn around it here, outside both clips.
      */}
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:grid md:grid-cols-[repeat(auto-fill,minmax(--spacing(60),1fr))] md:overflow-visible md:px-0">
        {items.map(c => (
          <li
            key={c.documentId}
            className="w-64 shrink-0 snap-start rounded-card has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-accent md:w-auto"
          >
            <CompetitionCard
              title={c.name}
              dateLabel={competitionDateLabel(c.startDate, c.endDate)}
              lakeName={c.lake?.name ?? 'Nedefinit'}
              imageSrc={c.banner?.smallUrl ?? c.banner?.url ?? '/images/competition-placeholder.jpg'}
              href={routes.competition(c.documentId)}
              live={live}
              status={live ? undefined : { label: 'Viitor', tone: 'info' }}
              followersCount={c.viewers}
              registeredCount={c.registrations.filter(r => r.registrationStatus === 'registered').length}
              capacity={c.participantsLimit}
              badges={[{ label: c.competitionType === 'team' ? 'Echipe' : 'Individual', tone: 'indigo' }]}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Reviews (fish LakeReviewsPreview: score + three sub-scores, the latest two, «Vezi…»)
 * ---------------------------------------------------------------------------------------------- */

const SUB_SCORES = [
  { key: 'quality', label: 'Pescuit' },
  { key: 'facilities', label: 'Facilități' },
  { key: 'atmosphere', label: 'Atmosferă' },
] as const;

const score = (n: number, d = 1) => n.toFixed(d).replace('.', ',');

/** The score summary (from the lake read) and, under it, `children`: the latest reviews (streamed). */
export function ReviewsBlock({ meta, children }: { meta: ReviewMeta | null; children: ReactNode }) {
  const count = meta?.count ?? 0;
  return (
    <div className="flex flex-col gap-4">
      {meta && count > 0 ? (
        <div className="flex items-center gap-4.5">
          <div className="flex shrink-0 flex-col items-center">
            <span className="t-display">{score(meta.overall ?? 0, 2)}</span>
            <span className="mt-0.5 flex items-center gap-1 t-label text-muted">
              <StarIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'text-rating')} />
              {formatReviewsCount(count)}
            </span>
          </div>
          {/* Capped from 768: compact ratings next to the score, not page-wide progress bars. */}
          <dl className="flex flex-1 flex-col gap-2 md:max-w-80">
            {SUB_SCORES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <dt className="w-16 shrink-0 t-label text-muted">{label}</dt>
                <dd className="flex flex-1 items-center gap-2">
                  <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent-tint">
                    <span className="block h-full bg-accent" style={{ width: `${Math.min(100, (meta[key] / 5) * 100)}%` }} />
                  </span>
                  <span className="w-6.5 text-right t-label tabular-nums">{score(meta[key])}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <EmptyState title="Această baltă nu are încă recenzii." description="Fii primul care spune cum a fost." />
      )}

      {children}
    </div>
  );
}

/**
 * fish: «Scrie prima recenzie» / «Vezi recenzia» / «Vezi toate» (the count is already in the
 * section). The reviews page is M1, so until then it is the T3 unavailable section action (one
 * line beside the title), the same as the Partide «Vezi tot».
 */
export function ReviewsMoreAction({ count }: { count: number }) {
  return <SectionSoon>{count === 0 ? 'Scrie prima recenzie' : count === 1 ? 'Vezi recenzia' : 'Vezi toate'}</SectionSoon>;
}

/** A section action whose page is not on the web yet: DetailUnavailable on one line, the short hint. */
export function SectionSoon({ children }: { children: ReactNode }) {
  return (
    <DetailUnavailable hint="în curând" className="justify-end text-right">
      {children}
    </DetailUnavailable>
  );
}

const DATE = new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Bucharest' });

export function ReviewItem({ review }: { review: Review }) {
  const name = review.author?.username ?? 'Pescar';
  const overall = (review.quality + review.facilities + review.atmosphere) / 3;
  return (
    <article className="flex flex-col gap-2 border-t border-hairline pt-4">
      <header className="flex items-center gap-3">
        <Avatar name={name} src={review.author?.avatar?.thumbnailUrl ?? review.author?.avatar?.url} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate t-body-strong">{name}</p>
          <p className="t-caption text-muted">
            <time dateTime={review.createdAt}>{DATE.format(new Date(review.createdAt))}</time>
          </p>
        </div>
        <span className="flex items-center gap-1 t-body-strong">
          <StarIcon aria-hidden className={cn(PRESENCE_ICON.strong, 'text-rating')} />
          <span className="sr-only">Nota</span>
          {score(overall)}
        </span>
      </header>
      {review.comment ? <p className="t-body text-ink-2">{review.comment}</p> : null}
      <div className="flex flex-wrap gap-1.5">
        {review.verified ? <VerifiedBadge>Rezervare verificată</VerifiedBadge> : null}
        {review.recommendToOthers ? <Badge color="indigo">Recomandă</Badge> : null}
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Prices (fish LakePricesSection)
 * ---------------------------------------------------------------------------------------------- */

export function PricesList({ prices }: { prices: LakeDetail['price'] }) {
  return (
    <ul className="flex flex-col">
      {prices.map(p => (
        <li key={p.id} className="flex items-start gap-3 border-b border-hairline py-3 first:pt-0 last:border-b-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="t-body-strong">{p.header || 'Tarif'}</p>
            {p.description ? <p className="t-caption text-muted">{p.description}</p> : null}
          </div>
          {p.price != null ? <p className="shrink-0 t-body-strong tabular-nums">{formatInt(p.price)} lei</p> : null}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Contact + Administrator (fish LakeContactSection + the owner card)
 * ---------------------------------------------------------------------------------------------- */

export function mapsHref(lake: LakeDetail): string | null {
  return lake.coordinates ? `https://www.google.com/maps/dir/?api=1&destination=${lake.coordinates.lat},${lake.coordinates.long}` : null;
}

/**
 * `ownerHeading`: the «Administrator» h3 — off when the section itself is titled so (no contact
 * data). `owner`: the <OwnerCard> (it depends on the session, so the page streams it in).
 */
export function ContactBlock({ lake, owner, ownerHeading = true }: { lake: LakeDetail; owner: ReactNode; ownerHeading?: boolean }) {
  const directions = mapsHref(lake);
  const rows: { key: string; icon: ReactNode; label: string; value: ReactNode }[] = [];
  if (lake.address) rows.push({ key: 'address', icon: <MapPinIcon />, label: 'Adresă', value: lake.address });
  for (const c of lake.contact) {
    if (!c.phone) continue;
    rows.push({
      key: `phone-${c.id}`,
      icon: <PhoneIcon />,
      label: c.header || c.name || 'Telefon',
      value: (
        <a href={`tel:${c.phone.replace(/\s+/g, '')}`} className="text-accent-ink hover:underline">
          {c.phone}
        </a>
      ),
    });
  }
  if (lake.website) {
    rows.push({
      key: 'website',
      icon: <GlobeAltIcon />,
      label: 'Site',
      value: (
        <a href={lake.website} target="_blank" rel="noopener noreferrer" className="break-all text-accent-ink hover:underline">
          {lake.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
          <span className="sr-only"> (se deschide într-o filă nouă)</span>
        </a>
      ),
    });
  }
  return (
    <div className="flex flex-col gap-4">
      {rows.length ? (
        <dl className="flex flex-col gap-3">
          {rows.map(r => (
            <div key={r.key} className="flex items-start gap-3">
              {/* The icon is the visible label; the words are for screen readers (a <dl> group holds only dt / dd). */}
              <dt className="flex size-6 shrink-0 items-center justify-center text-accent [&>svg]:size-6">
                {r.icon}
                <span className="sr-only">{r.label}</span>
              </dt>
              <dd className="min-w-0 flex-1 t-body text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {directions ? (
        <ButtonLink
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          variant="secondary"
          block
          icon={<ArrowTopRightOnSquareIcon />}
          className="md:w-auto md:self-start"
        >
          Deschide în Google Maps
          <span className="sr-only"> (se deschide într-o filă nouă)</span>
        </ButtonLink>
      ) : null}
      <div className="flex flex-col gap-2">
        {ownerHeading ? <h3 className={H3_CLASS}>Administrator</h3> : null}
        {owner}
      </div>
    </div>
  );
}

/**
 * fish owner card: the operator (a link to their profile; signed out → sign-in, /feed/anglers/:id
 * 403s anonymously; session unknown → not linked), or the take-over-lake entry when the lake has none.
 */
export function OwnerCard({ lake, session, signIn }: { lake: LakeDetail; session: Session; signIn: string }) {
  const name = lake.ownerName?.trim() || null;
  const ownerId = lake.ownerDocumentId?.trim() || null;
  if (!name) {
    return (
      <div className="flex flex-col gap-2.5 rounded-card p-3.5 shadow-e0">
        <p className="t-body text-muted">Această baltă nu are încă un administrator în Bluvi.</p>
        {/* fish opens lakes.claim; not on the web yet — the T3 unavailable treatment. */}
        <p>
          <DetailUnavailable size="body">Ești administratorul acestei bălți?</DetailUnavailable>
        </p>
      </div>
    );
  }
  const body = (
    <>
      <Avatar name={name} size={40} tone="tint" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate t-body-strong">{name}</span>
        <span className="t-caption text-muted">Administrează această baltă în Bluvi</span>
      </span>
      <UserCircleIcon aria-hidden className="size-6 text-faint" />
    </>
  );
  // e0 (the inset hairline), as every other T3 tile: no border adding 2px to the box.
  const box = 'flex items-center gap-2.5 rounded-card p-3.5 shadow-e0';
  return ownerId && session !== 'unknown' ? (
    <Link
      href={session === 'in' ? routes.angler(ownerId) : signIn}
      aria-label={`${name} — vezi profilul`}
      className={cn(box, 'transition-colors hover:bg-soft-fill')}
    >
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Booking (fish hero «Rezervă acum» + quick action; ≥1280 the right column's card)
 * ---------------------------------------------------------------------------------------------- */

const BOOKING_SOON = 'Până atunci, rezervă din aplicația Bluvi.';
const INTEREST_SOON = 'Din aplicația Bluvi îi poți spune bălții că ai vrea să rezervi.';
const SESSION_UNKNOWN = 'Nu am putut verifica sesiunea. Reîncarcă pagina ca să rezervi.';

/**
 * The booking affordance, by fish `bookingState` (parity lakes.detail.c16): enabled → the booking
 * flow (a guest signs in first); legacy phone → the contact section; none → fish's demand-signal
 * sheet («Aș vrea să pot rezerva aici»). The flow and the sheet are M3, so for now they are shown
 * as unavailable, with the reason (`hint`) visible next to the control. With the session unknown
 * the enabled flow is neither the sign-in link nor «signed in»: unavailable, with that reason.
 */
export function bookingAction(lake: LakeDetail, session: Session, signIn: string): { href?: string; hint?: string; temporary?: boolean } {
  const state = bookingState(lake);
  if (state === 'legacy_phone') return { href: '#contact' };
  if (state === 'enabled') {
    if (session === 'out') return { href: signIn };
    // Session unknown is a real, temporary unavailability (reload fixes it); signed in, the web flow is simply not built yet.
    return session === 'in' ? { hint: BOOKING_SOON } : { hint: SESSION_UNKNOWN, temporary: true };
  }
  return { hint: INTEREST_SOON };
}

/**
 * fish hero CTA «Rezervă acum», bottom-left on the photo, on every lake (lakes.detail.c6): the kit
 * primary Button, the same control the header shows from 768 and the right column from 1280. fish
 * paints it red; the web keeps the one primary colour until the kit sanctions an on-photo CTA.
 * When the booking is not on the web (no href), no disabled button on the photo: one pill
 * («Rezervări · în curând pe web»). `onPhoto` false (no photo, the soft-fill placeholder): the
 * surface pill, not the photo scrim.
 */
export function HeroBookingCta({ lake, session, signIn, onPhoto = true }: { lake: LakeDetail; session: Session; signIn: string; onPhoto?: boolean }) {
  const a = bookingAction(lake, session, signIn);
  if (a.href) {
    return (
      <ButtonLink href={a.href} icon={<CalendarDaysIcon />}>
        Rezervă acum
      </ButtonLink>
    );
  }
  return (
    <p className={onPhoto ? PHOTO_PILL : SURFACE_PILL}>
      <CalendarDaysIcon aria-hidden />
      Rezervări · în curând pe web
    </p>
  );
}

/**
 * ≥1280 right column: the booking card (state, the CTA, how it works). The state pill only promises
 * what the visitor can do: green «Rezervare online» only with a live CTA. While the web flow is not
 * built, the card says where booking works («Rezervări în aplicație», neutral) and names the action
 * in the T3 unavailable treatment — no pale disabled primary that reads as broken. The disabled
 * button is kept for a real, temporary unavailability (the session could not be checked).
 */
export function BookingCard({ lake, session, signIn }: { lake: LakeDetail; session: Session; signIn: string }) {
  const state = bookingState(lake);
  const a = bookingAction(lake, session, signIn);

  if (state === 'none') {
    // fish LakeBookingInterestSheet: the lake takes no bookings; the angler can say they would like to.
    return (
      <div className="flex flex-col gap-3">
        <StatusPill tone="neutral" className="self-start">
          Fără rezervări
        </StatusPill>
        <p className="t-body text-ink-2">{lake.name} nu acceptă încă rezervări prin Bluvi.</p>
        <p>
          <DetailUnavailable size="body" hint="în curând pe web">
            Aș vrea să pot rezerva aici
          </DetailUnavailable>
        </p>
        <p className="t-caption text-muted">{a.hint}</p>
      </div>
    );
  }

  const label = state === 'enabled' && session === 'out' ? 'Intră în cont ca să rezervi' : state === 'legacy_phone' ? 'Rezervă telefonic' : 'Rezervă un stand';
  const pill =
    state === 'legacy_phone' ? (
      <StatusPill tone="neutral">Rezervare telefonică</StatusPill>
    ) : a.href ? (
      <StatusPill tone="success">Rezervare online</StatusPill>
    ) : (
      <StatusPill tone="neutral">Rezervări în aplicație</StatusPill>
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {/* The booking STATE is a pill (radius 999); how it works (instant, pay at the lake) are attributes: Badges. */}
        {pill}
        {state === 'enabled' && lake.confirmationMode === 'instant' ? <Badge color="indigo">Confirmare instant</Badge> : null}
        {state === 'enabled' && lake.paymentMode === 'offline' ? <Badge color="gray">Plata la baltă</Badge> : null}
      </div>
      <p className="t-body text-ink-2">
        {state === 'enabled'
          ? `Alege standul și intervalul — ${plural(lake.stands.length, 'stand', 'standuri')} pe ${lake.name}.`
          : 'Balta primește rezervări doar la telefon.'}
      </p>
      {a.href ? (
        <ButtonLink href={a.href} block icon={<CalendarDaysIcon />}>
          {label}
        </ButtonLink>
      ) : a.temporary ? (
        <>
          <DetailUnavailableButton hintId="rezerva-card-motiv" icon={<CalendarDaysIcon />} block>
            {label}
          </DetailUnavailableButton>
          <p id="rezerva-card-motiv" className="t-caption text-muted">
            {a.hint}
          </p>
        </>
      ) : (
        <>
          <p>
            <DetailUnavailable size="body" hint="în curând pe web">
              {label}
            </DetailUnavailable>
          </p>
          <p className="t-caption text-muted">{a.hint}</p>
        </>
      )}
    </div>
  );
}

/**
 * «Verificată» is an attribute (a kit Badge, radius 2). The kit's green Badge keeps fish green3
 * (2.3:1, under AA), so the label sits on the neutral pair (AA) and the green lives in the icon
 * alone, on the status-success ink (#15803d, AA as a graphic).
 */
export function VerifiedBadge({ children }: { children: ReactNode }) {
  return (
    <Badge color="gray" icon={<CheckBadgeIcon aria-hidden className="text-status-success-fg" />}>
      {children}
    </Badge>
  );
}
