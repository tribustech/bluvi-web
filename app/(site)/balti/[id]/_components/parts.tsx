import type { ReactNode } from 'react';
import {
  ArrowLongDownIcon,
  ArrowsPointingOutIcon,
  BanknotesIcon,
  FlagIcon,
  GlobeAltIcon,
  MapPinIcon,
  PhoneIcon,
  Squares2X2Icon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { CheckBadgeIcon, StarIcon } from '@heroicons/react/20/solid';
import { CompetitionCard } from '@/components/cards/CompetitionCard';
import { formatInt } from '@/components/cards/format';
import { FishOutlineIcon } from '@/components/nav/brand';
import { ErrorState } from '@/components/surfaces/StateCard';
import { H3_CLASS, PRESENCE_ICON, type DetailFact } from '@/components/templates/T3';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { getRankingTypeLabel, type CompetitionListItem } from '@/core/competitions';
import { buildLakeStats, formatReviewsCount, getLakeRatingDisplay, type LakeDetail, type LakeStatKey, type ReviewMeta } from '@/core/lakes';
import { routes } from '@/lib/routes';
import { competitionDateLabel } from '../../../concursuri/[id]/_components/dates';
import { facilityIcon } from '../../../_home/facilityIcon';
import { lakeHref } from './availability';
import { bookableStandsLabel, lakeStandCount } from './standCount';
import type { LakeCompetitions, Settled } from './load';
import { ClaimTrigger, DialogTrigger, OwnerLink, PhoneLink } from './LakeActions';
import { SectionRetry } from './RetryFocus';
import { JumpLink, SectionAction } from './SectionLink';

/*
 * The lake page's section contents — fish features/lakes/detail/* (LakeCharacteristics,
 * LakeFacilities, LakePricesSection, LakeCompetitionsSection, LakeReviewsPreview,
 * LakeContactSection) and the title block / owner card of [lakeId].tsx. Server components; the
 * interactive bits are the client triggers of ./LakeActions.
 */

/* ------------------------------------------------------------------------------------------------
 * Rating (title block, pinned row) — lakes.detail.c8 / c12
 * ---------------------------------------------------------------------------------------------- */

/** ★ 4,33 · 1 recenzie, to the right of the name; activating it goes to Recenzii. */
export function RatingLink({ meta, className }: { meta: ReviewMeta | null; className?: string }) {
  const r = getLakeRatingDisplay(meta);
  return (
    <JumpLink
      to="recenzii"
      aria-label={r.accessibilityLabel}
      className={cn('-m-1 flex items-center gap-1.25 rounded-control p-1 whitespace-nowrap hover:bg-soft-fill', className)}
    >
      <StarIcon aria-hidden className={cn(PRESENCE_ICON.strong, r.scoreLabel ? 'text-rating' : 'text-faint')} />
      {r.scoreLabel ? <span className="t-body-strong">{r.scoreLabel}</span> : null}
      {/* From 768 the count is body-sized beside the 32px title (a caption reads as a footnote there). */}
      <span className="t-caption text-muted md:t-body">{r.reviewsLabel}</span>
    </JumpLink>
  );
}

/** The pinned row's meta «★ 4,33 · 1 recenzie» — a link to Recenzii too (fish onMetaPress). */
export function RatingMeta({ meta }: { meta: ReviewMeta | null }) {
  const r = getLakeRatingDisplay(meta);
  return (
    <JumpLink to="recenzii" aria-label={r.accessibilityLabel} className="flex items-center gap-1 rounded-badge hover:underline">
      <StarIcon aria-hidden className={cn(PRESENCE_ICON.meta, r.scoreLabel ? 'text-rating' : 'text-faint')} />
      {r.label}
    </JumpLink>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Caracteristici — fish LakeCharacteristics (c17)
 * ---------------------------------------------------------------------------------------------- */

const STAT_ICON: Record<LakeStatKey, ReactNode> = {
  surface: <ArrowsPointingOutIcon />,
  depth: <ArrowLongDownIcon />,
  seats: <Squares2X2Icon />,
  regime: <FishOutlineIcon />,
  fishingType: <FlagIcon />,
  fishingSpotTypes: <MapPinIcon />,
};

/**
 * The characteristics. The stand count is lakeStandCount's: a lake that books online states its
 * bookable stands («21 de standuri rezervabile»), never the CMS «50 de locuri» beside them.
 */
export function lakeFacts(lake: LakeDetail): DetailFact[] {
  const stands = lakeStandCount(lake);
  return buildLakeStats(lake).map(s => ({
    key: s.key,
    label: s.label,
    value: s.key === 'seats' && stands?.bookable ? bookableStandsLabel(stands.count) : s.value,
    icon: STAT_ICON[s.key],
  }));
}

/* ------------------------------------------------------------------------------------------------
 * Facilități, Pești (c18, c19)
 * ---------------------------------------------------------------------------------------------- */

/** fish LakeFacilities: every facility with its icon, two columns (three from 1280 in the wide card). */
export function FacilitiesList({ facilities }: { facilities: LakeDetail['facility'] }) {
  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3">
      {facilities.map(f => {
        const Icon = facilityIcon(f.name);
        return (
          <li key={f.id} className="flex min-w-0 items-start gap-2 t-body text-ink-2">
            <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
            <span className="min-w-0">{f.name}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** fish FishSpeciesList: the lake's species (fish draws a picture per species; the web names them). */
export function FishList({ species }: { species: LakeDetail['fishSpecies'] }) {
  return (
    <ul aria-label="Specii de pești" className="flex flex-wrap gap-2">
      {species.map(s => (
        <li key={s.id} className="flex items-center gap-1.5 rounded-full bg-page px-3 py-1.5 t-label text-ink">
          <FishOutlineIcon aria-hidden className="size-4 text-accent" />
          {s.fish.Name}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Prețuri — fish LakePricesSection (c23)
 * ---------------------------------------------------------------------------------------------- */

export function PricesList({ prices }: { prices: LakeDetail['price'] }) {
  return (
    <ul className="grid gap-2 md:grid-cols-[repeat(auto-fill,minmax(--spacing(72),1fr))]">
      {prices.map(p => (
        <li key={p.id} className="flex items-center gap-2.5 rounded-control p-3 shadow-e0">
          <BanknotesIcon aria-hidden className="size-5 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="t-body text-ink">{p.header}</p>
            {p.description ? <p className="mt-0.5 t-caption text-muted">{p.description}</p> : null}
          </div>
          {p.price != null ? <p className="shrink-0 t-body-strong tabular-nums">{formatInt(p.price)} RON</p> : null}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Concursuri — fish LakeCompetitionsSection + HorizontalCompetitionsList (c24)
 * ---------------------------------------------------------------------------------------------- */

/** Live, then Viitoare: each list hidden when empty, and failing on its own (fish: one query, one
 * error + «Încearcă din nou» per list). */
export function CompetitionsBlock({ live, upcoming }: LakeCompetitions) {
  return (
    <div className="flex flex-col gap-5">
      <CompetitionRailRead title="Live" read={live} live />
      <CompetitionRailRead title="Viitoare" read={upcoming} />
    </div>
  );
}

function CompetitionRailRead({ title, read, live = false }: { title: string; read: Settled<CompetitionListItem[]>; live?: boolean }) {
  if (!read.ok) {
    return (
      <div className="flex flex-col gap-2.5" data-testid={`competitions-error-${live ? 'live' : 'upcoming'}`}>
        <h3 className={H3_CLASS}>{title}</h3>
        <ErrorState title="A apărut o eroare la încărcarea datelor." action={<SectionRetry section="concursuri" />} />
      </div>
    );
  }
  return read.value.length ? <CompetitionRail title={title} items={read.value} live={live} /> : null;
}

/**
 * fish HorizontalCompetitionsList, without its own «Vezi tot»: the section header holds the one link
 * to the lake's competitions (owner: one «Vezi tot» per section, never one per rail beside it).
 */
function CompetitionRail({ title, items, live = false }: { title: string; items: CompetitionListItem[]; live?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3 className={H3_CLASS}>{title}</h3>
      {/* Phone: a sideways rail (fish horizontal list); from 768 an auto-fill grid of cards. */}
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 py-1 [scrollbar-width:none] md:mx-0 md:grid md:scroll-px-0 md:grid-cols-[repeat(auto-fill,minmax(--spacing(64),1fr))] md:overflow-visible md:px-0">
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
              capacity={c.participantsLimit || 21}
              badges={[
                { label: c.competitionType === 'team' ? 'Echipe' : 'Individual', tone: 'indigo' },
                ...(getRankingTypeLabel(c) ? [{ label: getRankingTypeLabel(c), tone: 'yellow' as const }] : []),
              ]}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Recenzii — fish LakeReviewsPreview (c25 – c27)
 * ---------------------------------------------------------------------------------------------- */

const SUB_SCORES = [
  { key: 'quality', label: 'Pescuit' },
  { key: 'facilities', label: 'Facilități' },
  { key: 'atmosphere', label: 'Atmosferă' },
] as const;

const comma = (n: number, d: number) => n.toFixed(d).replace('.', ',');

/** The score summary (from the lake read) and the explainer link — the left half of Recenzii from 768. */
export function ReviewsSummary({ meta, className }: { meta: ReviewMeta | null; className?: string }) {
  const count = meta?.count ?? 0;
  return (
    <div className={cn('flex min-w-0 flex-col gap-4', className)}>
      {meta && count > 0 ? (
        <div className="flex items-center gap-4.5">
          <div className="flex shrink-0 flex-col items-center">
            <span className="t-display">{comma(meta.overall ?? 0, 2)}</span>
            <span className="mt-0.5 flex items-center gap-1 t-label text-muted">
              <StarIcon aria-hidden className={cn(PRESENCE_ICON.meta, 'text-rating')} />
              {formatReviewsCount(count)}
            </span>
          </div>
          <dl className="flex flex-1 flex-col gap-2">
            {SUB_SCORES.map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <dt className="w-16 shrink-0 t-label text-muted">{label}</dt>
                <dd className="flex flex-1 items-center gap-2">
                  <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-accent-tint">
                    <span className="block h-full bg-accent" style={{ width: `${Math.min(100, (meta[key] / 5) * 100)}%` }} />
                  </span>
                  <span className="w-6.5 text-right t-label tabular-nums">{comma(meta[key], 1)}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="t-body text-muted">Această baltă nu are încă recenzii.</p>
      )}
      <DialogTrigger dialog="reviews-info" className="self-start rounded-badge t-caption text-ink-2 underline underline-offset-2 hover:text-ink">
        Vezi cum funcționează recenziile
      </DialogTrigger>
    </div>
  );
}

/** «Scrie prima recenzie» / «Vezi recenzia» / «Vezi toate cele N recenzii» → the reviews page, as the
 * section's header action (like Partide and Concursuri). */
export function ReviewsMoreAction({ lakeId, count }: { lakeId: string; count: number }) {
  const label = count === 0 ? 'Scrie prima recenzie' : count === 1 ? 'Vezi recenzia' : `Vezi toate cele ${formatReviewsCount(count)}`;
  return <SectionAction href={lakeHref('reviews', routes.lakeReviews(lakeId))}>{label}</SectionAction>;
}

/* ------------------------------------------------------------------------------------------------
 * Locație & contact — fish LakeContactSection (c28) + the Administrator card (c29, c30)
 * ---------------------------------------------------------------------------------------------- */

export function ContactRows({ lake }: { lake: LakeDetail }) {
  const rows: { key: string; icon: ReactNode; label: string; value: ReactNode }[] = [];
  if (lake.address) rows.push({ key: 'address', icon: <MapPinIcon />, label: 'Adresă', value: <span className="text-ink">{lake.address}</span> });
  for (const c of lake.contact) {
    if (!c.phone) continue;
    rows.push({
      key: `phone-${c.id}`,
      icon: <PhoneIcon />,
      label: c.header || 'Telefon',
      value: (
        <PhoneLink phone={c.phone} className="text-accent-ink hover:underline">
          {c.name ? `${c.name} · ${c.phone}` : c.phone}
        </PhoneLink>
      ),
    });
  }
  if (lake.website) {
    rows.push({
      key: 'website',
      icon: <GlobeAltIcon />,
      label: 'Website',
      value: (
        <a href={lake.website} target="_blank" rel="noopener noreferrer" title={websiteLabel(lake.website, false)} className="block truncate text-accent-ink hover:underline">
          {websiteLabel(lake.website)}
          <span className="sr-only"> (se deschide într-o filă nouă)</span>
        </a>
      ),
    });
  }
  if (!rows.length) return null;
  return (
    <dl className="flex flex-col">
      {rows.map(r => (
        <div key={r.key} className="border-b border-hairline py-2.5 last:border-b-0">
          {/* A <dl> group holds only dt / dd: the icon rides in the dt, the value is indented under it. */}
          <dt className="flex items-center gap-3 t-label text-muted">
            <span aria-hidden className="flex size-5 shrink-0 [&>svg]:size-5">
              {r.icon}
            </span>
            {r.label}
          </dt>
          <dd className="mt-0.5 pl-8 t-body">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A website as people read it: decoded («Bölöni», not «B%C3%B6l…»), no protocol / www / trailing
 * slash (`short`); the full decoded address for the hover title. */
export function websiteLabel(url: string, short = true): string {
  let text = url.trim();
  try {
    text = decodeURI(text);
  } catch {
    // A malformed escape: show it as stored.
  }
  return short ? text.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '') : text;
}

const OWNER_BOX = 'flex items-center gap-2.5 rounded-card p-3.5 shadow-e0';

/**
 * The operator (trimmed name, initial avatar, «Administrează această baltă în Bluvi»), linked to
 * their profile only when the DTO has `ownerDocumentId` AND the profile page is on the web
 * (availability.ts `angler` — never a link to a 404); or, without an operator, the take-over entry
 * (fish [lakeId].tsx owner card).
 */
export function OwnerCard({ lake }: { lake: LakeDetail }) {
  const name = lake.ownerName?.trim() || null;
  const ownerId = lake.ownerDocumentId?.trim() || null;
  const href = ownerId ? lakeHref('angler', routes.angler(ownerId)) : undefined;
  if (!name) {
    return (
      <div className="flex flex-col gap-2.5 rounded-card p-3.5 shadow-e0">
        <p className="t-body text-muted">Această baltă nu are încă un administrator în Bluvi.</p>
        <ClaimTrigger className="self-start rounded-badge t-body-strong text-accent-ink underline-offset-2 hover:underline">
          Ești administratorul acestei bălți?
        </ClaimTrigger>
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
      {href ? <UserCircleIcon aria-hidden className="size-6 text-muted" /> : null}
    </>
  );
  return href ? (
    <OwnerLink href={href} name={name} className={cn(OWNER_BOX, 'transition-colors hover:bg-soft-fill')}>
      {body}
    </OwnerLink>
  ) : (
    <div className={OWNER_BOX} data-testid="lake-owner-static">
      {body}
    </div>
  );
}

/** «Verificată»: the neutral badge (AA) with the green check (fish green lives in the icon). */
export function VerifiedBadge({ children }: { children: ReactNode }) {
  return (
    <Badge color="gray" icon={<CheckBadgeIcon aria-hidden className="text-status-success-fg" />}>
      {children}
    </Badge>
  );
}
