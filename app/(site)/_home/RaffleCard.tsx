import Image from 'next/image';
import Link from 'next/link';
import { GiftIcon, TrophyIcon } from '@heroicons/react/24/solid';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import type { RafflePrizeDto, RaffleState } from '@/core/organizer';
import { cn } from '@/components/ui/cn';
import { RaffleCountdown } from './RaffleCountdown';
import { homeLinks } from './links';
import logoBluvi from './assets/raffle-logo-bluvi.png';
import logoPescarmania from './assets/raffle-logo-pescarmania.png';

// fish constants/raffleCopy.ts (dashboard)
const BON_FISCAL =
  'Cumpără de minim 150 lei de la PescarMania, înscrie bonul fiscal și primești 2 șanse în plus la tragerea la sorți.';
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

/**
 * fish components/raffle/RaffleDashboardCard.tsx — the active raffle session (hidden when none).
 * White header with the two partner logos (CMS overrides, else the bundled Bluvi / PescarMania),
 * indigo body: title, subtitle, participants, countdown to the end, the prizes with their type and
 * registrations, the bon-fiscal pitch, the previous winner announcement, then the status row.
 *
 * fish makes the whole card one Pressable; here the status pill is the link (the prize rows expand,
 * and interactive content cannot nest inside a link). Destinations as fish `handlePress`: ended with
 * winners → câștigători (public); ended without → nothing; guest → sign-in (fish `dismissTo(/sign-in)`, no return path); joined → confirmare;
 * else → înscriere. The decorative motion (snake border, pulses) is left out.
 */
export function RaffleCard({ raffle, signedIn }: { raffle: RaffleState; signedIn: boolean }) {
  const { isEnded, hasWinners, joined } = raffle;
  const prompt = joined && !raffle.receiptUploaded && !isEnded;
  const cta = isEnded
    ? hasWinners
      ? { href: homeLinks.raffleWinners, label: COPY.ctaSeeWinners }
      : null
    : !signedIn
      ? { href: homeLinks.signIn, label: 'Intră în cont' }
      : joined
        ? null
        : { href: homeLinks.raffle, label: COPY.statusAvailable };

  return (
    <section aria-labelledby="acasa-tombola" className="overflow-hidden rounded-card bg-accent text-on-accent shadow-e2">
      <div className="flex items-center justify-center gap-5 bg-surface px-5 py-4">
        <LogoImage url={raffle.headerLogoLeftUrl} fallback={logoBluvi} alt="Bluvi" className="h-[46px] w-[126px]" />
        <LogoImage url={raffle.headerLogoRightUrl} fallback={logoPescarmania} alt="PescarMania" className="h-[60px] w-[146px]" />
      </div>
      {/* fish HeaderWave: the white header bows into the indigo body. */}
      <svg aria-hidden viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-7 w-full fill-surface">
        <path d="M0 0 L100 0 Q50 20 0 0 Z" />
      </svg>

      <div className="flex flex-col gap-3.5 px-5 pb-2">
        <div className="flex flex-col items-center gap-1 text-center">
          <h2 id="acasa-tombola" className="t-heading">
            {raffle.dashboardTitle?.trim() || 'Tragere la sorți'}
          </h2>
          {raffle.dashboardSubtitle?.trim() ? <p className="t-caption">{raffle.dashboardSubtitle}</p> : null}
          <p className="t-label">{COPY.registeredCount(raffle.registeredCount)}</p>
          {!isEnded && raffle.countdownEnd ? <RaffleCountdown end={raffle.countdownEnd.toISOString()} /> : null}
        </div>

        {raffle.sessionPrizes.length > 0 ? (
          <ul className="flex flex-col gap-2" aria-label="Premii">
            {raffle.sessionPrizes.map((p, i) => {
              const type = raffle.types.find((t) => t.key === p.typeKey);
              return (
                <li key={i}>
                  <PrizeRow
                    prize={p}
                    typeLabel={type?.label ?? p.typeKey ?? ''}
                    typeColor={type?.badgeColor ?? null}
                    registrations={raffle.registrationsByType[p.typeKey ?? ''] ?? 0}
                  />
                </li>
              );
            })}
          </ul>
        ) : null}

        {!isEnded && !joined ? <p className="px-1 text-center t-caption">{BON_FISCAL}</p> : null}
        {raffle.previousWinnerAnnouncement ? (
          <p className="px-1 text-center t-caption">{raffle.previousWinnerAnnouncement}</p>
        ) : null}

        {prompt ? (
          <p className="flex items-center gap-2.5 rounded-[12px] bg-surface p-3 t-caption text-ink-2 shadow-e0">
            <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <GiftIcon className="size-[18px]" />
            </span>
            {COPY.addBonFiscalPrompt}
          </p>
        ) : null}

        <div
          className={cn(
            'flex items-center gap-2.5 border-t border-on-accent/20 pt-3.5 pb-1.5',
            isEnded && !hasWinners ? 'justify-center' : joined || isEnded ? 'justify-between' : 'justify-center'
          )}
        >
          {isEnded && !hasWinners ? <p className="flex-1 text-center t-body-strong">{COPY.statusEndedNoWinners}</p> : null}
          {!isEnded && joined ? (
            <Link href={homeLinks.raffleConfirmation} className="t-body-strong underline-offset-2 hover:underline">
              {COPY.statusJoined}
            </Link>
          ) : null}
          <div className="flex items-center gap-2.5">
            {cta ? (
              <Link href={cta.href} className="rounded-full bg-surface px-6 py-2.5 t-heading text-accent-ink shadow-e1 hover:bg-accent-tint">
                {cta.label}
              </Link>
            ) : null}
            {!isEnded && joined ? (
              <span className="t-body-strong">
                {raffle.entriesCount} {COPY.yourChances}
              </span>
            ) : null}
            <GiftIcon aria-hidden className="size-[22px]" />
            {!isEnded && joined ? <TrophyIcon aria-hidden className="size-[22px] text-yellow-5" /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function LogoImage({
  url,
  fallback,
  alt,
  className,
}: {
  url: string | null;
  fallback: typeof logoBluvi;
  alt: string;
  className: string;
}) {
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
 */
function PrizeRow({
  prize,
  typeLabel,
  typeColor,
  registrations,
}: {
  prize: RafflePrizeDto;
  typeLabel: string;
  typeColor: string | null;
  registrations: number;
}) {
  const subtitle =
    prize.priceLei != null
      ? `${prize.description ? `${prize.description} · ` : ''}${prize.priceLei} LEI × ${prize.count}`
      : (prize.description ?? null);
  const items = prize.items ?? [];
  const head = (
    <div className="flex items-center gap-2.5 rounded-[12px] bg-on-accent/15 px-2.5 py-2">
      <span className="relative size-[38px] shrink-0 overflow-hidden rounded-lg bg-accent-tint">
        {prize.image?.url ? (
          <Image src={prize.image.url} alt="" fill sizes="38px" className="object-cover" />
        ) : (
          <GiftIcon aria-hidden className="m-auto size-6 h-full text-accent" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="truncate t-body-strong">{prize.title}</span>
        {subtitle ? <span className="t-caption">{subtitle}</span> : null}
        {items.length > 0 ? (
          <span className="flex items-center gap-1 t-caption">
            {COPY.itemsCount(items.length)}
            <ChevronDownIcon aria-hidden className="size-4 transition-transform group-open:rotate-180" />
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="t-caption">{registrations} înscriși</span>
        {typeLabel ? (
          <span className="flex items-center gap-1 rounded-lg bg-on-accent/20 px-2 py-0.5 t-caption">
            {/* The type's colour comes from the CMS (fish badge background). */}
            {typeColor ? <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: typeColor }} /> : null}
            {typeLabel}
          </span>
        ) : null}
      </span>
    </div>
  );
  if (items.length === 0) return head;
  return (
    <details className="group">
      <summary className="cursor-pointer list-none rounded-[12px] [&::-webkit-details-marker]:hidden">{head}</summary>
      <ul className="mt-1.5 flex flex-col gap-2 rounded-[10px] bg-on-accent/10 py-1 pr-2 pl-14">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2.5">
            {item.image?.url ? (
              <span className="relative size-8 shrink-0 overflow-hidden rounded-lg">
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
