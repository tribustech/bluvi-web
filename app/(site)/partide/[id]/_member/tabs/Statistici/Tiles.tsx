'use client';

import type { ReactNode } from 'react';
import { CalendarIcon, ClockIcon, TrophyIcon } from '@heroicons/react/24/outline';
import { FishIcon, ScaleIcon } from '@/components/icons/brand';
import { BENTO_INK, BentoTile, StatTile, type BentoTone } from '@/components/ui/BentoTile';
import { cn } from '@/components/ui/cn';
import { SignatureNumber } from '@/components/ui/SignatureNumber';
import type { ArrivalRecap, TripStats } from '@/core/partide';
import { formatCount } from '@/core/realtime/chat/format';
import { FishHookIcon } from '../Lansete/FishHookIcon';
import { bandTile, kgTile } from './model';

/*
 * The stat tiles of both scopes as an Apple-style bento (owner rules 9, 10, 19): the headline
 * number of the scope is the navy signature tile (fish's indigo «Capturi»; «Partide» across the
 * venue), the other figures their own tinted tiles with the icon large in the corner, every unit
 * spaced apart from its number. Each tile is a labelled group with `data-testid` = its key.
 *
 * Grid (one per scope, in fish's card order so Tab and screen readers follow the phone):
 *  - «Această partidă»: phone — Capturi across, the two weights side by side; from 768 Capturi
 *    takes half the row, the weights a quarter each.
 *  - «Toate partidele»: phone — Partide and a compact Top momeală across, Distanță ideală and Ore
 *    de vârf side by side; from 768 two rows of two (Partide beside Top momeală, the two others
 *    under them); from 1280 one row of four.
 */

const Group = ({ id, label, className, children }: { id: string; label: string; className?: string; children: ReactNode }) => (
  <div role="group" aria-label={label} data-testid={`stat-${id}`} className={cn('flex min-w-0', className)}>
    {children}
  </div>
);

const value = (v: string) => <span data-testid="stat-value">{v}</span>;

/** The navy signature tile: label on top, the 64px number, a caption, the icon in the corner. */
function SignatureTile({ label, figure, caption, art, className }: { label: string; figure: string; caption?: ReactNode; art: ReactNode; className?: string }) {
  return (
    <BentoTile tone="signature" art={art} className={cn('w-full', className)}>
      <div className="t-label text-lavender-2">{label}</div>
      <SignatureNumber size="tile" tone="lavender" value={value(figure)} />
      {caption ? <div className="pe-16 t-caption text-lavender-3">{caption}</div> : <span aria-hidden />}
    </BentoTile>
  );
}

/**
 * A word, not a number. A name («Boilies Squid») takes the 26px step, up to two lines. A range
 * («05:00–08:00», «70–75 m») never wraps — its halves would read as two values — and, like fish
 * (StatisticiScene: value.length > 6 → 17px), steps down to 18px where the tile is half a phone.
 */
function WordTile({ label, word, unit, tone, icon, range = false }: { label: string; word: string; unit?: string; tone: BentoTone; icon: ReactNode; range?: boolean }) {
  const ink = BENTO_INK[tone];
  const long = range && word.length > 6;
  return (
    <BentoTile tone={tone} className="min-h-28! w-full gap-3 p-4!">
      <div className={cn('flex min-w-0 items-center gap-2 t-label', ink.fg)}>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span aria-hidden className="-my-1 -me-1 flex size-8 shrink-0 items-center justify-center [&>svg]:size-7">
          {icon}
        </span>
      </div>
      {range ? (
        <div className="whitespace-nowrap">
          <span className={long ? 't-num-18 md:t-num-26' : 't-num-26'}>
            <span data-number className="text-ink">
              {value(word)}
            </span>
            {unit ? (
              <span data-unit className="ms-0.5 t-body-strong tracking-normal">
                {'\u00a0'}
                {unit}
              </span>
            ) : null}
          </span>
        </div>
      ) : (
        <SignatureNumber size="fact" value={value(word)} unit={unit} tone={ink.number} unitTone={ink.unit} className="line-clamp-2 break-words" />
      )}
    </BentoTile>
  );
}

export function TripTiles({ stats, weighed }: { stats: TripStats; weighed: boolean }) {
  const record = kgTile(stats.recordKg, weighed);
  const total = kgTile(stats.totalKg, weighed);
  return (
    <div data-testid="stats-tiles" className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      <Group id="capturi" label="Capturi" className="col-span-2">
        <SignatureTile label="Capturi" figure={String(stats.captures)} caption="în această partidă" art={<FishIcon />} />
      </Group>
      <Group id="record" label="Cea mai mare">
        <StatTile tone="amber" label="Cea mai mare" icon={<TrophyIcon />} value={value(record.value)} unit={record.unit} className="w-full" />
      </Group>
      <Group id="total" label="Greutate totală">
        <StatTile tone="lavender" label="Greutate totală" icon={<ScaleIcon />} value={value(total.value)} unit={total.unit} className="w-full" />
      </Group>
    </div>
  );
}

export function VenueTiles({ recap, venueWord, readCount }: { recap: ArrivalRecap; venueWord: string; readCount: number }) {
  const band = bandTile(recap.bestBand);
  // The caption says what the figures come from: the viewer's own partide here (c7), and — when
  // the history is longer than the cap — that the patterns come from the most recent ones only.
  const caption =
    readCount < recap.sessionCount ? (
      <>
        <span className="block">ale tale {venueWord}</span>
        <span data-testid="stats-capped" className="block">
          tiparele din ultimele {formatCount(readCount, 'partidă', 'partide')}
        </span>
      </>
    ) : (
      `ale tale ${venueWord}`
    );
  return (
    <div data-testid="stats-tiles" className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      <Group id="partide" label="Partide" className="col-span-2 md:col-span-1">
        <SignatureTile label="Partide" figure={String(recap.sessionCount)} caption={caption} art={<CalendarIcon />} />
      </Group>
      <Group id="momeala" label="Top momeală" className="col-span-2 md:col-span-1">
        <WordTile tone="lavender" label="Top momeală" word={recap.bestBait ?? '—'} icon={<FishHookIcon />} />
      </Group>
      <Group id="distanta" label="Distanță ideală">
        <WordTile tone="amber" label="Distanță ideală" word={band.value} unit={band.unit} icon={<TrophyIcon />} range />
      </Group>
      <Group id="ore" label="Ore de vârf">
        <WordTile tone="sky" label="Ore de vârf" word={recap.bestHours ?? '—'} icon={<ClockIcon />} range />
      </Group>
    </div>
  );
}
