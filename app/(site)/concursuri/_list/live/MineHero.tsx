import Link from 'next/link';
import { ArrowRightIcon, ArrowTrendingUpIcon, MapPinIcon, TrophyIcon } from '@heroicons/react/20/solid';
import { LiveDot } from '@/components/templates/LiveDot';
import { bentoSurface } from '@/components/ui/BentoTile';
import { buttonClass } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { InlineNumber, SignatureNumber } from '@/components/ui/SignatureNumber';
import { PosterThumb } from './parts';
import s from './live.module.css';

/*
 * «Concursul tău» (prototype app/dev/hub Live.tsx MineHero): shown only when the signed-in viewer is
 * registered in a competition that is live now — the navy signature tile with my place over the
 * field, my value, my sector place and the gap to the leader, and the way into the competition.
 * Drawn from a plain model (./useMyLive builds it from my-competition-cards + /ranking +
 * /registrations; the signed-out preview passes ./placeholders' fake one). A figure we do not know
 * is left out, never guessed (ROADMAP §4b.4).
 */

export type HeroModel = {
  competitionId: string;
  name: string;
  poster: string | null;
  /** «Balta X · Ilfov · Cantitate». */
  where: string;
  stand: string | null;
  place: number | null;
  of: number | null;
  value: string | null;
  unit: string | null;
  /** Under the value: «kg total · 4 capturi». */
  valueCaption: string | null;
  /** «Locul 2 în sectorul A». */
  sectorLine: string | null;
  gap: { value: string; unit: string } | null;
  leads: boolean;
  href: string;
};

export function MineHero({ m }: { m: HeroModel }) {
  return (
    <section aria-label="Concursul tău" className={cn(bentoSurface('signature'), s.rise, 'rounded-bento p-5 xl:p-8')}>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)] xl:items-center xl:gap-10">
        <div className="flex min-w-0 items-center gap-4">
          <PosterThumb src={m.poster} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="flex items-center gap-2 t-eyebrow text-lavender uppercase">
              <LiveDot tone="on-accent" /> Concursul tău{m.stand ? ` · Stand ${m.stand}` : ''}
            </span>
            <span className="line-clamp-2 t-title1 text-on-bento-indigo">{m.name}</span>
            <span className="flex min-w-0 items-center gap-1.5 t-caption text-lavender-2">
              <MapPinIcon aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">{m.where}</span>
            </span>
          </div>
        </div>

        {m.place != null || m.value != null ? (
          <div className="flex flex-wrap items-end gap-8">
            {m.place != null ? (
              <SignatureNumber
                value={m.place}
                unit={m.of ? `/${m.of}` : undefined}
                size="tile"
                tone="lavender"
                unitTone="lavender"
                caption={<span className="text-lavender-2">Locul tău general</span>}
              />
            ) : null}
            {m.value != null ? (
              <SignatureNumber
                value={m.value}
                unit={m.unit ?? undefined}
                size="stat"
                tone="lavender"
                unitTone="lavender"
                caption={m.valueCaption ? <span className="text-lavender-2">{m.valueCaption}</span> : undefined}
              />
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {m.sectorLine || m.gap || m.leads ? (
            <ul className="flex flex-col gap-2 t-body text-lavender">
              {m.sectorLine ? (
                <li className="flex items-center gap-2">
                  <ArrowTrendingUpIcon className="size-4 shrink-0 text-lavender-2" aria-hidden />
                  {m.sectorLine}
                </li>
              ) : null}
              {m.leads ? (
                <li className="flex items-center gap-2">
                  <TrophyIcon className="size-4 shrink-0 text-lavender-2" aria-hidden />
                  Ești pe primul loc
                </li>
              ) : m.gap ? (
                <li className="flex items-center gap-2">
                  <TrophyIcon className="size-4 shrink-0 text-lavender-2" aria-hidden />
                  <InlineNumber value={m.gap.value} unit={m.gap.unit} valueClassName="t-body-strong text-lavender" unitClassName="text-lavender-2" />
                  până la lider
                </li>
              ) : null}
            </ul>
          ) : null}
          <Link href={m.href} className={buttonClass({ variant: 'primary', className: 'self-start' })}>
            Deschide concursul <ArrowRightIcon className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** The hero's bones while my standing reads (only once we know I am in a live competition). */
export function MineHeroSkeleton() {
  return (
    <div role="status" className={cn(bentoSurface('signature'), 'rounded-bento p-5 xl:p-8')}>
      <span className="sr-only">Se încarcă concursul tău…</span>
      <span aria-hidden className="flex items-center gap-4">
        <span className="size-20 shrink-0 rounded-card bg-on-bento-indigo/10 xl:size-24" />
        <span className="flex flex-1 flex-col gap-2.5">
          <span className="h-3 w-40 rounded-full bg-on-bento-indigo/10" />
          <span className="h-6 w-2/3 rounded-full bg-on-bento-indigo/10" />
          <span className="h-3 w-48 rounded-full bg-on-bento-indigo/10" />
        </span>
      </span>
    </div>
  );
}
