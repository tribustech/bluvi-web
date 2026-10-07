import { CheckBadgeIcon } from '@heroicons/react/20/solid';
import { ArrowTrendingUpIcon, CameraIcon, FireIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { BENTO_ART_CLEAR, BentoArt, BentoTile, FactTile } from '@/components/ui/BentoTile';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import { cn } from '@/components/ui/cn';
import { fmtProfileKg, trophyTiers, type AnglerProfile } from '@/core/social';

/*
 * fish components/profile/StatStrip.tsx (parity account.angler-profile c9) — Capturi, Partide,
 * Concursuri and C.M.M.C (the biggest catch, «12,4 kg» or «–»; a verified badge after it when it
 * was weighed at a competition).
 *  - StatStrip: the phone's (and tablet's) four columns with thin dividers, as fish draws it. The
 *    unit is its own smaller muted word after a space (owner rule 10).
 *  - StatBento: ≥1280, in the identity card — the same four facts as small Apple-style bento tiles
 *    (owner rules 9, 19): the record on the wide navy signature tile first (the headline
 *    number), then — only when the angler made a podium — the «Podiumuri» tile (the medals with
 *    their counts, the tiers above zero as fish TrophyRow c8; the phone keeps the inline row), then
 *    three tinted fact tiles — tiles of different sizes, never a grid of equal cards.
 */

const MEDAL = {
  first: { emoji: '🥇', spoken: 'locul 1' },
  second: { emoji: '🥈', spoken: 'locul 2' },
  third: { emoji: '🥉', spoken: 'locul 3' },
} as const;

/** ≥1280: the podiums as their own soft amber tile — the angler's most prestigious fact. */
function PodiumTile({ podium }: { podium: AnglerProfile['podium'] }) {
  const tiers = trophyTiers(podium);
  if (!tiers.length) return null;
  return (
    <BentoTile tone="amber" className="col-span-2 min-h-0! justify-start! gap-2 py-4">
      <BentoArt>
        <TrophyIcon />
      </BentoArt>
      <p className="t-label font-semibold" id="podium-tile-label">
        Podiumuri
      </p>
      <ul aria-labelledby="podium-tile-label" className="flex flex-wrap items-center gap-x-5 gap-y-1" data-testid="podium-tile">
        {tiers.map(t => (
          <li key={t.key} className="flex items-center gap-1.5" data-tier={t.key}>
            <span aria-hidden className="t-title2 leading-none">
              {MEDAL[t.key].emoji}
            </span>
            <SignatureNumber size="fact" tone="ink" value={t.count} />
            <span className="sr-only">{` × ${MEDAL[t.key].spoken}`}</span>
          </li>
        ))}
      </ul>
    </BentoTile>
  );
}

const VERIFIED = 'Cântărită la concurs';

function Cmmc({ profile }: { profile: AnglerProfile }) {
  const big = profile.biggestCatch;
  if (!big) return <span data-testid="cmmc-value">–</span>;
  return (
    <span className="inline-flex items-baseline" data-testid="cmmc-value">
      {fmtProfileKg(big.kg)}
      <span className="ms-0.5 t-caption text-muted">{' '}kg</span>
    </span>
  );
}

function Verified({ className }: { className?: string }) {
  return (
    <span className={className} data-testid="cmmc-verified" title={VERIFIED}>
      <CheckBadgeIcon aria-hidden className="size-3.5 text-accent" />
      <span className="sr-only">{VERIFIED}</span>
    </span>
  );
}

export function StatStrip({ profile }: { profile: AnglerProfile }) {
  const { counts, biggestCatch } = profile;
  const cells = [
    { label: 'Capturi', value: <span>{counts.catches}</span> },
    { label: 'Partide', value: <span>{counts.sessions}</span> },
    { label: 'Concursuri', value: <span>{counts.competitions}</span> },
    { label: 'C.M.M.C', value: <Cmmc profile={profile} />, verified: biggestCatch?.source === 'competition' },
  ];
  return (
    <dl className="mt-3.5 flex w-full items-center" data-testid="stat-strip">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={cn(
            'relative flex min-w-0 flex-1 flex-col items-center',
            i > 0 && "before:absolute before:top-1/2 before:left-0 before:h-6 before:w-px before:-translate-y-1/2 before:bg-hairline before:content-['']",
          )}
        >
          <dt className="t-micro text-muted">{c.label}</dt>
          <dd className="order-first flex items-center gap-0.75 t-body-strong text-ink tabular-nums">
            {c.value}
            {c.verified ? <Verified className="flex" /> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function StatBento({ profile }: { profile: AnglerProfile }) {
  const { counts, biggestCatch } = profile;
  return (
    <div className="grid grid-cols-2 gap-2.5" data-testid="stat-bento">
      {/* Sized to its content (BentoTile's own min-h-39 would leave half the tile empty): the
          label, the record, and — when it was weighed at a competition — that fact in words. The
          DTO carries no species/date/venue for the record, so nothing else is claimed (rule 4). */}
      <BentoTile tone="signature" className="col-span-2 min-h-0! justify-start! gap-1 py-4">
        <BentoArt>
          <ArrowTrendingUpIcon />
        </BentoArt>
        <p className="t-label font-semibold text-lavender">C.M.M.C</p>
        <SignatureNumber size="fact" tone="lavender" unitTone="lavender" value={biggestCatch ? fmtProfileKg(biggestCatch.kg) : '–'} unit={biggestCatch ? 'kg' : undefined} />
        {biggestCatch?.source === 'competition' ? (
          <p className={cn('flex items-center gap-1 t-caption text-lavender', BENTO_ART_CLEAR)} data-testid="cmmc-verified-bento">
            <CheckBadgeIcon aria-hidden className="size-4" />
            {VERIFIED}
          </p>
        ) : null}
      </BentoTile>
      <PodiumTile podium={profile.podium} />
      <FactTile tone="sky" label="Capturi" value={counts.catches} icon={<CameraIcon />} />
      <FactTile tone="mint" label="Partide" value={counts.sessions} icon={<FireIcon />} />
      <FactTile tone="lavender" label="Concursuri" value={counts.competitions} icon={<TrophyIcon />} className="col-span-2" />
    </div>
  );
}
