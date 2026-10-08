import { useId } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDownIcon, GiftIcon, TrophyIcon } from '@heroicons/react/24/outline';
import type { RafflePrizeDto, RaffleState } from '@/core/organizer';
import { Tag, type TagTone } from '@/components/cards';
import { ICON_TILE, TONE_SQUARE } from '@/components/templates/T5';
import { ButtonLink } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { formatCount } from '@/core/realtime/chat/format';
import { ON_DARK_FOCUS } from './PartidaCta';
import { RaffleCountdown } from './RaffleCountdown';
import { homeLinks } from './links';
import logoBluvi from './assets/raffle-logo-bluvi.png';
import logoPescarmania from './assets/raffle-logo-pescarmania.png';
import lakePhoto from './assets/lake-request.jpeg';
import logoBluviSquare from './assets/logo_bluvi.png';

// fish constants/raffleCopy.ts (dashboard)
const BON_FISCAL = 'Cumpără de minim 150 lei de la PescarMania, înscrie bonul fiscal și primești 2 șanse în plus la tragerea la sorți.';
const COPY = {
  statusAvailable: 'Înscrie-te la tombolă',
  statusJoined: 'Vezi șansele tale',
  statusEndedNoWinners: 'Tombola încheiată – câștigătorii vor fi anunțați',
  ctaSeeWinners: 'Vezi câștigători',
  yourChances: 'șanse',
  registeredCount: (n: number) => `${n} participanți`,
  addBonFiscalPrompt: `Mărește-ți șansele! ${BON_FISCAL}`,
  itemsCount: (n: number) => (n === 1 ? '1 produs' : `${n} produse`),
};

/** fish constants/raffleCopy.ts `rafflePrizes`: shown while the session has no prizes of its own. */
const FALLBACK_PRIZES: RafflePrizeDto[] = [
  { title: 'Echipament premium de pescuit', priceLei: 500, count: 2, typeKey: 'crap', image: { url: lakePhoto.src } },
  { title: 'Merchandise Bluvi', priceLei: 150, count: 5, typeKey: 'feeder', image: { url: logoBluviSquare.src } },
  { title: 'Premii speciale expoziție', priceLei: 300, count: 3, typeKey: 'rapitor', image: { url: lakePhoto.src } },
];

/**
 * The prize type (Crap / Feeder / Răpitor) is an attribute, so it is the kit attribute badge (Tag,
 * radius 2) on its light pair, never the CMS's raw colour (`badgeColor` is a CSS colour name such
 * as «blue», painted as is by fish). The name picks the nearest Tag tone; the type key backs it up
 * for types without one; anything else is gray. Only the pairs that read at AA (4.5:1) at 12px:
 * the kit green (2.1:1) and yellow (2.9:1) tints do not, so green / yellow names fall back to gray
 * and orange to the danger pair.
 */
const BADGE_BY_CMS_COLOR: Record<string, TagTone> = {
  blue: 'indigo',
  indigo: 'indigo',
  purple: 'indigo',
  orange: 'red',
  red: 'red',
};
const BADGE_BY_TYPE: Record<string, TagTone> = { crap: 'indigo', feeder: 'gray', rapitor: 'red' };

function typeBadgeColor(cmsColor: string | null, typeKey: string | null | undefined): TagTone {
  return BADGE_BY_CMS_COLOR[(cmsColor ?? '').trim().toLowerCase()] ?? BADGE_BY_TYPE[typeKey ?? ''] ?? 'gray';
}

/**
 * fish components/raffle/RaffleDashboardCard.tsx — the active raffle session (hidden when none).
 * White header with the two partner logos (CMS overrides, else the bundled Bluvi / PescarMania),
 * indigo body: title, subtitle, participants, countdown to the end, the prizes with their type and
 * registrations, the bon-fiscal pitch, the previous winner announcement, then the status row.
 *
 * fish makes the whole card one Pressable; here the status pill is the link (the prize rows expand,
 * and interactive content cannot nest inside a link). Destinations as fish `handlePress`: ended with
 * winners → câștigători (public); ended without → nothing; guest → sign-in and back to /tombola (fish `dismissTo(/sign-in)` has no return path); joined → confirmare;
 * else → înscriere. The decorative motion (snake border, pulses) is left out.
 */
export function RaffleCard({
  raffle,
  signedIn,
  participationFailed = false,
}: {
  raffle: RaffleState;
  signedIn: boolean;
  /** The viewer's participation could not be read: neither «joined» nor «not joined» is known. */
  participationFailed?: boolean;
}) {
  const { isEnded, hasWinners, joined } = raffle;
  // Unknown participation (signed in, read failed, raffle running): no join CTA, no receipt prompt,
  // no chances and no status row at all — never folded into «not registered», and never «we could
  // not check» copy either (owner rule 4, ROADMAP §4b: when we don't know, we don't show).
  const unknown = participationFailed && signedIn && !isEnded;
  const prompt = joined && !raffle.receiptUploaded && !isEnded;
  // Mounted in both compositions (one is display:none): a per-instance id.
  const headingId = useId();
  const prizes = raffle.sessionPrizes.length > 0 ? raffle.sessionPrizes : FALLBACK_PRIZES;
  const cta = unknown
    ? null
    : isEnded
    ? hasWinners
      ? { href: homeLinks.raffleWinners, label: COPY.ctaSeeWinners }
      : null
    : !signedIn
      ? { href: homeLinks.raffleSignIn, label: 'Intră ca să participi' }
      : joined
        ? null
        : { href: homeLinks.raffle, label: COPY.statusAvailable };

  return (
    // A container: the prize rows lay out by the card's own width (the phone's column, the
    // tablet's, the 1280+ main column), not the window's. The banner shape of the column's other
    // coloured blocks (PartidaCta BANNER: radius 20, no elevation — e1 is for photo cards).
    <section aria-labelledby={headingId} className="@container overflow-hidden rounded-bento bg-accent-ink text-on-accent">
      <div className="flex items-center justify-center gap-5 bg-surface px-5 py-3">
        <LogoImage url={raffle.headerLogoLeftUrl} fallback={logoBluvi} alt="Bluvi" className="h-9 w-25" />
        <LogoImage url={raffle.headerLogoRightUrl} fallback={logoPescarmania} alt="PescarMania" className="h-11 w-27" />
      </div>
      {/* fish HeaderWave: the white header bows into the indigo body. */}
      <svg aria-hidden viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-5 w-full fill-surface @xl:h-7">
        <path d="M0 0 L100 0 Q50 20 0 0 Z" />
      </svg>

      {/* From a 576px card (@xl: the tablet's stacked column) two columns — the heading and the
          countdown on the left, centred against the prizes on the right — over a full-width footer
          (the pitch and the actions, centred on the card). Narrower cards stack. */}
      <div className="flex flex-col gap-3.5 px-5 pb-2 @xl:grid @xl:grid-cols-2 @xl:items-center @xl:gap-x-6 @xl:gap-y-4 @xl:pt-2">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 id={headingId} className="t-heading">
            {raffle.dashboardTitle?.trim() || 'Tragere la sorți'}
          </h2>
          {raffle.dashboardSubtitle?.trim() ? <p className="t-caption">{raffle.dashboardSubtitle}</p> : null}
          <p className="t-label">{COPY.registeredCount(raffle.registeredCount)}</p>
          {!isEnded && raffle.countdownEnd ? <RaffleCountdown end={raffle.countdownEnd.toISOString()} /> : null}
        </div>

        {prizes.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Premii">
            {prizes.map((p, i) => {
              const type = raffle.types.find((t) => t.key === p.typeKey);
              return (
                <li key={i}>
                  <PrizeRow
                    prize={p}
                    typeLabel={type?.label ?? p.typeKey ?? ''}
                    typeColor={typeBadgeColor(type?.badgeColor ?? null, p.typeKey)}
                    registrations={raffle.registrationsByType[p.typeKey ?? ''] ?? 0}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="flex flex-col items-center gap-3.5 @xl:col-span-2">
          {!isEnded && !joined && !unknown ? <p className="max-w-md px-1 text-center t-caption">{BON_FISCAL}</p> : null}
          {raffle.previousWinnerAnnouncement ? (
            <p className="max-w-md px-1 text-center t-caption">{raffle.previousWinnerAnnouncement}</p>
          ) : null}

          {prompt ? (
            <p className="flex w-full max-w-lg items-center gap-2.5 rounded-control bg-surface p-3 t-caption text-ink-2 shadow-e0">
              {/* The T5 icon tile: a 24 outline glyph at its own size (§05). */}
              <span aria-hidden className={cn(ICON_TILE, TONE_SQUARE.indigo)}>
                <GiftIcon />
              </span>
              {COPY.addBonFiscalPrompt}
            </p>
          ) : null}

          <div
            className={cn(
              'flex w-full items-center gap-2.5 border-t border-on-accent/20 pt-3.5 pb-1.5',
              unknown && 'hidden',
              isEnded && !hasWinners ? 'justify-center' : joined || isEnded ? 'justify-between' : 'justify-center'
            )}
          >
            {isEnded && !hasWinners ? <p className="flex-1 text-center t-body-strong">{COPY.statusEndedNoWinners}</p> : null}
            {!isEnded && joined ? (
              <Link
                href={homeLinks.raffleConfirmation}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-control t-body-strong underline-offset-2 hover:underline',
                  ON_DARK_FOCUS
                )}
              >
                {COPY.statusJoined}
              </Link>
            ) : null}
            {cta ? (
              <ButtonLink href={cta.href} variant="outline" icon={<GiftIcon />} className={ON_DARK_FOCUS}>
                {cta.label}
              </ButtonLink>
            ) : null}
            {!isEnded && joined ? (
              <span className="flex items-center gap-2 t-body-strong">
                {raffle.entriesCount} {COPY.yourChances}
                <TrophyIcon aria-hidden className="size-6 text-yellow-5" />
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoImage({ url, fallback, alt, className }: { url: string | null; fallback: typeof logoBluvi; alt: string; className: string }) {
  return (
    <span className={cn('relative block', className)}>
      {url ? (
        <Image src={url} alt={alt} fill sizes="146px" className="object-contain" />
      ) : (
        <Image src={fallback} alt={alt} fill sizes="146px" className="object-contain" />
      )}
    </span>
  );
}

/**
 * fish ExpandablePrizeRow (variant dashboard): image, title, «desc · N LEI × count», registrations
 * for the type and the type badge; the kit's products expand under it.
 *
 * From a 320px card (@xs: phone, 1440) the registrations and the badge trail the text in their own
 * column, as fish. Under it (the 264px column at 1280) that column would squeeze the title to a
 * word, so the two move under the subtitle as one inline row and the text takes the full width.
 */
function PrizeRow({
  prize,
  typeLabel,
  typeColor,
  registrations,
}: {
  prize: RafflePrizeDto;
  typeLabel: string;
  typeColor: TagTone;
  registrations: number;
}) {
  const subtitle =
    prize.priceLei != null
      ? `${prize.description ? `${prize.description} · ` : ''}${prize.priceLei} LEI × ${prize.count}`
      : (prize.description ?? null);
  const items = prize.items ?? [];
  const registered = <span className="t-caption">{formatCount(registrations, 'înscris', 'înscriși')}</span>;
  // The Tag pairs are tints made for a light ground: a surface box under it (radius 2, the
  // badge's own) keeps its contrast on the indigo row, and lets each layout place it.
  const badge = typeLabel ? (
    <span className="flex rounded-badge bg-surface">
      <Tag tone={typeColor}>{typeLabel}</Tag>
    </span>
  ) : null;
  const head = (
    <div className="flex items-start gap-2.5 rounded-control bg-on-accent/15 px-2.5 py-2 @xs:items-center">
      <span className="relative size-10 shrink-0 overflow-hidden rounded-avatar bg-accent-tint">
        {prize.image?.url ? (
          <Image src={prize.image.url} alt="" fill sizes="40px" className="object-cover" />
        ) : (
          <GiftIcon aria-hidden className="m-auto size-6 h-full text-accent" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="line-clamp-2 t-body-strong">{prize.title}</span>
        {subtitle ? <span className="t-caption">{subtitle}</span> : null}
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 @xs:hidden">
          {badge}
          {registered}
        </span>
        {items.length > 0 ? (
          <span className="flex items-center gap-1 t-caption">
            {COPY.itemsCount(items.length)}
            <ChevronDownIcon aria-hidden className="size-6 transition-transform group-open:rotate-180" />
          </span>
        ) : null}
      </span>
      <span className="hidden shrink-0 flex-col items-end gap-1 @xs:flex">
        {registered}
        {badge}
      </span>
    </div>
  );
  if (items.length === 0) return head;
  return (
    // One open at a time (fish ExpandablePrizeRow): an exclusive accordion by `name`.
    <details name="acasa-tombola-premii" className="group">
      <summary className={cn('cursor-pointer list-none rounded-control [&::-webkit-details-marker]:hidden', ON_DARK_FOCUS)}>{head}</summary>
      <ul className="mt-1.5 flex flex-col gap-2 rounded-control bg-on-accent/10 py-1 pr-2 pl-15">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2.5">
            {item.image?.url ? (
              <span className="relative size-8 shrink-0 overflow-hidden rounded-avatar">
                <Image src={item.image.url} alt="" fill sizes="32px" className="object-cover" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 t-body-strong">{item.label}</span>
              {item.description ? <span className="line-clamp-2 t-caption">{item.description}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
