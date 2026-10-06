import type { ReactNode } from 'react';
import Image from 'next/image';
import { MapPinIcon } from '@heroicons/react/20/solid';
import type { CompetitionCard } from '@/core/competitions';
import { CardShell, CardTitle, Pill, Tag, formatDecimal, plural } from '@/components/cards';
import { FishIcon, ScaleIcon } from '@/components/icons/brand';
import { FaceStack } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import { routes } from '@/lib/routes';

/**
 * fish features/competitions/components/cards/preview/CompetitionRailCard.tsx — the card of the
 * Acasă rails. The kit CompetitionCard has no live-totals / upcoming footer, so this composes the
 * kit parts (CardShell, CardTitle, Pill, Tag, FaceStack) into the rail variant.
 *
 * Every card in a row is the same height: the title reserves two lines, the footer is 56px, and
 * the row stretches its cards (flex/grid) so a wrapped badge row never makes the row ragged.
 */
/**
 * The rail card's height per breakpoint (poster 120, 144 from 1280 + two-line title + one row of
 * tags + 56px footer; the type steps change at 1280). The skeleton is drawn at it; the card holds
 * it as a minimum (a second row of tags may add to it, and the row then stretches its neighbours).
 */
export const COMPETITION_CARD_HEIGHT = 'h-76.5 xl:h-82.5';
const COMPETITION_CARD_MIN_HEIGHT = 'min-h-76.5 xl:min-h-82.5';

/**
 * From 768 the rail's tracks share the column (HorizontalRail): a track never reaches 4⁄3 of the
 * 224 slot, so the poster frame (120 / 144 high) stays near the phone's 224×120 and a portrait
 * poster is never a thin strip inside a wide blur band.
 */
const POSTER_SIZES = '(min-width: 768px) 304px, 224px';

export function CompetitionRailCard({
  competition: c,
  eager = false,
}: {
  competition: CompetitionCard;
  /** The first card of an above-the-fold rail: the poster is the LCP candidate. */
  eager?: boolean;
}) {
  const href = routes.competition(c.documentId);
  const media = c.banner ?? c.lake?.image ?? null;
  const poster = media?.smallUrl ?? media?.url ?? null;
  const isLive = c.status === 'started';
  const isTeam = c.format.kind === 'team';

  return (
    <CardShell elevated interactive className={cn('h-full', COMPETITION_CARD_MIN_HEIGHT)}>
      {/* Posters are mostly A4 portrait with the details written on them: `contain` keeps all of
          it, the blurred copy behind fills the frame instead of grey bars (fish). */}
      <div className="relative h-30 shrink-0 overflow-hidden bg-soft-fill xl:h-36">
        {poster ? (
          <>
            {/* Same `sizes` for both copies: one download serves the blur and the poster. */}
            <Image
              src={poster}
              alt=""
              fill
              sizes={POSTER_SIZES}
              loading={eager ? 'eager' : undefined}
              className="scale-110 object-cover blur-xl"
              aria-hidden
            />
            <Image
              src={poster}
              alt=""
              fill
              sizes={POSTER_SIZES}
              loading={eager ? 'eager' : undefined}
              fetchPriority={eager ? 'high' : undefined}
              className="object-contain"
            />
          </>
        ) : null}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {isLive ? <Pill tone="live">LIVE</Pill> : null}
          <Pill tone="scrim">{c.viewers === 1 ? '1 urmăritor' : `${c.viewers} urmăritori`}</Pill>
        </div>
      </div>

      {/* The title takes its natural height (never a reserved second line between it and the lake);
          the card's spare height lands after the tags, above the footer, as breathing room. */}
      <div className="flex flex-1 flex-col gap-1 px-3 py-2.5">
        <p className={cn('truncate t-eyebrow uppercase', isLive ? 'text-live' : 'text-accent-ink')}>{withHours(c)}</p>
        <CardTitle href={href} className="line-clamp-2 t-heading text-ink">
          {c.name}
        </CardTitle>
        <p className="flex min-h-4.5 min-w-0 items-center gap-1 t-label text-accent-ink">
          {c.lake ? (
            <>
              <MapPinIcon aria-hidden className="size-3.5 shrink-0 text-accent" />
              <span className="truncate">{c.lake.name}</span>
            </>
          ) : null}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {/* The kit attribute badge, text only (it has no icon slot; §05 never shrinks an outline). */}
          <Tag tone="indigo" title={c.rankingLabel}>
            {c.rankingLabel}
          </Tag>
          <Tag tone="gray">{isTeam ? 'Echipe' : 'Individual'}</Tag>
        </div>
      </div>

      <div className="flex h-14 shrink-0 items-center border-t border-hairline px-3">
        {isLive ? <LiveFooter c={c} /> : <UpcomingFooter c={c} />}
      </div>
    </CardShell>
  );
}

/** fish CompetitionRailCard `withHours`: «SÂM, 27 SEPT. · 07:00–15:00» for a one-day competition. */
const withHours = (c: CompetitionCard) => (c.hoursLabel ? `${c.dateLabel} · ${c.hoursLabel}` : c.dateLabel);

/**
 * Live totals as one line — catches and weighed kilos (fish LiveFooter). Without results (the
 * totals did not load) only the faces: fish's «Statisticile nu sunt disponibile.» is dropped by
 * owner rule 4 (ROADMAP §4b — when we don't know, we don't show).
 */
function LiveFooter({ c }: { c: CompetitionCard }) {
  const results = c.results;
  if (!results?.hasCatches) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <FaceStack people={c.participantFaces.slice(0, 3).map((src, i) => ({ name: `Participant ${i + 1}`, src }))} size={24} />
        {results ? <p className="line-clamp-2 min-w-0 t-caption text-muted">Încă nu sunt capturi</p> : null}
      </div>
    );
  }
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3.5">
      <LiveStat icon={<FishIcon size={14} />} value={String(results.catchCount)} unit={results.catchCount === 1 ? 'captură' : 'capturi'} />
      {results.totalKg !== null ? <LiveStat icon={<ScaleIcon size={14} />} value={formatDecimal(results.totalKg, 0, 1)} unit="kg" /> : null}
    </div>
  );
}

function LiveStat({ icon, value, unit }: { icon: ReactNode; value: string; unit: string }) {
  return (
    <p className="flex min-w-0 items-center gap-1.5">
      <span aria-hidden className="text-accent-ink">
        {icon}
      </span>
      <span className="shrink-0 t-body-strong text-ink tabular-nums">{value}</span>
      <span className="truncate t-caption text-muted">{unit}</span>
    </p>
  );
}

/** fish UpcomingFooter: «38/48 pescari» + «10 locuri libere» (or «N în așteptare»). */
function UpcomingFooter({ c }: { c: CompetitionCard }) {
  const one = c.format.kind === 'team' ? 'echipă' : 'pescar';
  const count = c.capacity !== null ? `${c.joinedCount}/${c.capacity} ${c.format.unit}` : plural(c.joinedCount, one, c.format.unit);
  const sub =
    c.placesLeft !== null && c.placesLeft > 0
      ? { text: plural(c.placesLeft, 'loc liber', 'locuri libere'), className: 'text-success' }
      : c.pendingCount > 0
        ? { text: `${c.pendingCount} în așteptare`, className: 'text-muted' }
        : null;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <FaceStack people={c.participantFaces.slice(0, 3).map((src, i) => ({ name: `Participant ${i + 1}`, src }))} size={24} />
      <div className="min-w-0 flex-1">
        <p className="truncate t-label text-ink">{count}</p>
        {sub ? <p className={cn('truncate t-micro-strong', sub.className)}>{sub.text}</p> : null}
      </div>
    </div>
  );
}
