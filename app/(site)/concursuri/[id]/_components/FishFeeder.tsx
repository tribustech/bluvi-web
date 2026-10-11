'use client';

import { Fragment, useMemo, type CSSProperties, type ReactNode } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import { feederGeneralModel, feederLegCount, feederLegModel, feederTabCount, futureLegMessage, type FeederTab } from '@/core/competitions';
import { KgText } from '@/components/ranking/shell';
import { RankingFace } from '@/components/ranking/RankingFace';
import { sectorVar } from '@/components/ranking/sector';
import { cn } from '@/components/ui/cn';
import { roNum, type FeederData } from './FeederRanking';
import { FISH_TABLE_BLEED, FishPills } from './FishTable';
import { useRankingFaces, type RankingFaces } from './rankingFaces';

/*
 * The feeder ranking: fish CompetitionRanking FeederLegTabs + FeederFutureLeg +
 * features/competitions/feeder-rounds/FeederRankingTable.tsx (the «screen» variant), as fish draws
 * them (owner 2026-10-10, ROADMAP §4b.25). The table at every width (owner 2026-10-11): from 768
 * `wide` — the same groups, colours and rows on desktop proportions (48px rows, 14px cells, the
 * name column sized to the longest name with the face beside it, ROADMAP §4b.13), only as wide as
 * its columns (§4b.16), in the screen's ranking card (the leg tabs on its band, FeederRanking.tsx).
 *
 *  - General: Loc frozen (40px), then in one sideways scroll the name (at least 132px, else what
 *    the numbers leave of the screen), Total (Puncte 48, Kg 60) and one group per leg (Stand 44,
 *    Kg 60, Puncte 48); 44px rows, a 24px group head over a 26px sub head; zebra rows, the podium
 *    row #EEF5FF with 🎖️ before its place.
 *  - A leg: no frozen column, Stand 46 · name (at least 120, else what is left of the screen) ·
 *    Kg 60 · Buc 38 · C.M.M.C 56 · Puncte 50 under a 34px head; one 28px solid band per sector,
 *    the sector's 4px edge on every row, the sector winner on its 16% tint.
 *  - fish's values keep the page's shared formats (decimal comma, «–» + «Fără capturi»).
 */

const ROW = 'h-11';
const WIDE_ROW = 'h-12';
/** fish Cell: 6px sides, a 1px right and bottom line (#E3E6EE), 12/16 text. */
const CELL = 'box-border border-r border-b border-rank-line px-1.5 align-middle t-caption';
const WIDE_CELL = 'box-border border-r border-b border-rank-line px-2.5 align-middle t-table';
/** fish HeaderCell: 2px sides, centred 11px (600; 700 on a group head), one line. */
const HEAD = 'box-border border-r border-b border-rank-line px-0.5 text-center align-middle t-fish-11 whitespace-nowrap';
const WIDE_HEAD = 'box-border border-r border-b border-rank-line px-1.5 text-center align-middle t-caption whitespace-nowrap';
const PLAIN_HEAD = 'bg-rank-plain-head text-rank-plain-head-ink';
const W = {
  place: 40,
  nameMin: 132,
  legNameMin: 120,
  points: 48,
  seat: 44,
  kg: 60,
  legSeat: 46,
  legKg: 60,
  legCount: 38,
  legBiggest: 56,
  legPoints: 50,
};
/** `wide` (from 768): the desktop widths; the name sized to the longest name (+ the face). */
const WW: typeof W = {
  place: 56,
  nameMin: 180,
  legNameMin: 180,
  points: 72,
  seat: 60,
  kg: 84,
  legSeat: 64,
  legKg: 84,
  legCount: 56,
  legBiggest: 84,
  legPoints: 72,
};
const WIDE_NAME_MAX = 320;
/** 7px a character, the cell's sides, the 32px face and its gap. */
const wideNameWidth = (names: string[], min: number) =>
  Math.min(Math.max(Math.max(0, ...names.map(n => n.length)) * 7 + 20 + 40, min), WIDE_NAME_MAX);
const px = (w: number | string): CSSProperties => ({ width: w, minWidth: w, maxWidth: w });

/**
 * `wide`: the table fills its card — fixed tracks for every number (a <colgroup>), the name column
 * takes the rest, never under its measured width (`min`).
 */
const fillTable = (wide: boolean) => (wide ? 'w-full table-fixed' : 'w-max table-fixed');
/** The name cell's width: fixed on the phone, at least `w` (the flexible track) when wide. */
const nameStyle = (wide: boolean, w: number | string): CSSProperties => (wide ? { minWidth: w } : px(w));

/** The table's parts, phone or `wide`. */
const parts = (wide: boolean) => ({
  w: wide ? WW : W,
  row: wide ? WIDE_ROW : ROW,
  cell: wide ? WIDE_CELL : CELL,
  head: wide ? WIDE_HEAD : HEAD,
});

/** `wide`: the name with the registration's face before it (ROADMAP §4b.13). */
function NameText({ name, registrationId, faces }: { name: string; registrationId: string; faces: RankingFaces | null }) {
  const text = (
    <span data-rank-name="" className="line-clamp-2 break-words">
      {name}
    </span>
  );
  if (!faces) return text;
  return (
    <span className="flex min-w-0 items-center gap-2">
      <RankingFace name={name} face={faces.byRegistration.get(registrationId) ?? null} />
      {text}
    </span>
  );
}

/** fish TOTAL_COLOR and LEG_COLORS (#1E88E5, #00897B, #8E24AA). */
type Tone = { head: string; sub: string; text: string; rule: string };
const TOTAL: Tone = {
  head: 'bg-rank-total text-rank-on-dark',
  sub: 'bg-rank-total-tint text-rank-total',
  text: 'text-rank-total',
  rule: 'border-l-2 border-l-rank-total',
};
const LEGS: Tone[] = [
  {
    head: 'bg-fish-rk-leg-1 text-rank-on-dark',
    sub: 'bg-fish-rk-leg-1-tint text-fish-rk-leg-1',
    text: 'text-fish-rk-leg-1',
    rule: 'border-l-2 border-l-fish-rk-leg-1',
  },
  {
    head: 'bg-fish-rk-leg-2 text-rank-on-dark',
    sub: 'bg-fish-rk-leg-2-tint text-fish-rk-leg-2',
    text: 'text-fish-rk-leg-2',
    rule: 'border-l-2 border-l-fish-rk-leg-2',
  },
  {
    head: 'bg-rank-leg-3 text-rank-on-dark',
    sub: 'bg-rank-leg-3-tint text-rank-leg-3',
    text: 'text-rank-leg-3',
    rule: 'border-l-2 border-l-rank-leg-3',
  },
];
const legTone = (leg: number) => LEGS[(leg - 1) % LEGS.length];
const zebra = (i: number) => (i % 2 === 1 ? 'bg-rank-zebra' : 'bg-rank-base');

/** fish FeederLegTabs: General | Manșa 1 … N (wrapping), the «?» at the right end. */
export function FishFeederLegTabs({
  data,
  value,
  onChange,
  onHelp,
}: {
  data: FeederData;
  value: FeederTab;
  onChange: (tab: FeederTab) => void;
  onHelp: () => void;
}) {
  const legs = feederTabCount(data.rankings, data.roundsCount);
  const options = [
    { value: 'general', label: 'General', active: 'bg-fish-slate' },
    ...Array.from({ length: legs }, (_, i) => ({ value: String(i + 1), label: `Manșa ${i + 1}`, active: 'bg-fish-slate' })),
  ];
  return (
    <div className="mb-2 flex items-center gap-2">
      <FishPills
        name="feeder-leg"
        label="Manșa clasamentului"
        options={options}
        value={String(value)}
        onChange={v => onChange(v === 'general' ? 'general' : Number(v))}
        size={13}
        wrap
        className="min-w-0 flex-1"
      />
      <button
        type="button"
        aria-label="Cum se calculează clasamentul"
        title="Cum se calculează clasamentul"
        onClick={onHelp}
        // fish: a bare 24px icon with a 10px hit slop.
        className="-m-2.5 flex size-11 shrink-0 items-center justify-center rounded-full text-fish-rk-help active:opacity-60 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent"
      >
        <InformationCircleIcon aria-hidden className="size-6" />
      </button>
    </div>
  );
}

/** The leg tab's table (or what fish says instead), full bleed as fish's `marginHorizontal={-20}`. */
export function FishFeederTable({
  data,
  tab,
  isTeam,
  caption,
  wide = false,
}: {
  data: FeederData;
  tab: FeederTab;
  isTeam: boolean;
  caption: string;
  /** From 768: the desktop proportions, no bleed (the screen's card holds it). */
  wide?: boolean;
}) {
  const faces = useRankingFaces();
  const message = futureLegMessage(tab, data.currentRound, data.roundStatus, feederLegCount(data.rankings));
  // fish FeederFutureLeg: a leg before it starts.
  if (message) return <FutureLeg title={message.title} detail={message.detail} />;
  if (data.rankings.length === 0) return <NoData />;
  const nameTitle = isTeam ? 'Echipă' : 'Participant';
  const table =
    tab === 'general' ? (
      <GeneralTable data={data} caption={caption} nameTitle={nameTitle} wide={wide} faces={wide ? faces : null} />
    ) : (
      <LegTable data={data} leg={tab} caption={caption} nameTitle={nameTitle} wide={wide} faces={wide ? faces : null} />
    );
  if (wide) return table;
  return (
    <div className={FISH_TABLE_BLEED}>
      <div className="-ml-1 w-full">{table}</div>
    </div>
  );
}

function FutureLeg({ title, detail }: { title: string; detail: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-8 text-center">
      <h3 className="t-heading text-ink">{title}</h3>
      <p className="t-body text-muted">{detail}</p>
    </div>
  );
}

/** fish: «Nu există date de afișat» (body, 600, 16px sides). */
function NoData() {
  return <p className="px-4 t-body text-ink md:py-4">Nu există date de afișat</p>;
}

/** The sideways ScrollView (no scrollbar, no bounce), named by the table's caption. */
function SideScroll({ caption, wide, children }: { caption: string; wide: boolean; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      data-fish-colours=""
      className={cn(
        'w-full overflow-x-auto overscroll-x-none bg-rank-base outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-solid focus-visible:outline-accent',
        // fish: no scrollbar; wide: the mouse needs it.
        wide ? '[scrollbar-width:thin]' : '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
      )}
    >
      {children}
    </div>
  );
}

type TableProps = { data: FeederData; caption: string; nameTitle: string; wide: boolean; faces: RankingFaces | null };

function GeneralTable({ data, caption, nameTitle, wide, faces }: TableProps) {
  const { legs, rows } = useMemo(() => feederGeneralModel(data.rankings, feederLegCount(data.rankings)), [data.rankings]);
  const { w: W, row: ROW, cell: CELL, head: HEAD } = parts(wide);
  const totalW = W.points + W.kg;
  const legW = W.seat + W.kg + W.points;
  const numbersW = totalW + legs.length * legW;
  // fish: the name takes what the numbers leave of the screen, never under 132. Wide: as long as
  // the longest name (the table only as wide as its columns, ROADMAP §4b.16).
  const nameW = wide
    ? wideNameWidth(
        rows.map(r => r.name),
        W.nameMin,
      )
    : `max(${W.nameMin}px, calc(100vw - ${W.place + numbersW}px))`;
  const headRow = wide ? 'h-8' : 'h-6';
  const subRow = wide ? 'h-8' : 'h-6.5';
  const headTall = wide ? 'h-16' : 'h-[50px]';
  return (
    <SideScroll caption={caption} wide={wide}>
      <table
        className={cn(fillTable(wide), 'border-separate border-spacing-0 text-rank-ink')}
        style={wide ? { minWidth: W.place + Number(nameW) + numbersW } : undefined}
      >
        <caption className="sr-only">{caption}</caption>
        {wide ? (
          <colgroup>
            <col style={{ width: W.place }} />
            <col />
            <col style={{ width: W.points }} />
            <col style={{ width: W.kg }} />
            {legs.map(leg => (
              <Fragment key={leg}>
                <col style={{ width: W.seat }} />
                <col style={{ width: W.kg }} />
                <col style={{ width: W.points }} />
              </Fragment>
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr className={headRow}>
            {/* fish: Loc frozen, its column closed by a 1px line. */}
            <th
              scope="col"
              rowSpan={2}
              style={px(W.place)}
              className={cn(HEAD, PLAIN_HEAD, 'sticky left-0 z-above', headTall, 'font-semibold!')}
            >
              Loc
            </th>
            <th scope="col" rowSpan={2} style={nameStyle(wide, nameW)} className={cn(HEAD, PLAIN_HEAD, headTall, wide && 'pl-2.5 text-left', 'font-semibold!')}>
              {nameTitle}
            </th>
            <th scope="colgroup" colSpan={2} className={cn(HEAD, TOTAL.head, TOTAL.rule, headRow, 'font-bold!')}>
              Total
            </th>
            {legs.map(leg => (
              <th key={leg} scope="colgroup" colSpan={3} className={cn(HEAD, legTone(leg).head, legTone(leg).rule, headRow, 'font-bold!')}>
                Manșa {leg}
              </th>
            ))}
          </tr>
          <tr className={subRow}>
            <th scope="col" style={px(W.points)} className={cn(HEAD, TOTAL.sub, TOTAL.rule, 'font-semibold!')}>
              Puncte
            </th>
            <th scope="col" style={px(W.kg)} className={cn(HEAD, TOTAL.sub, 'font-semibold!')}>
              Kg
            </th>
            {legs.map(leg => {
              const tone = legTone(leg);
              return (
                <Fragment key={leg}>
                  <th scope="col" style={px(W.seat)} className={cn(HEAD, tone.sub, tone.rule, 'font-semibold!')}>
                    <span className="sr-only">Manșa {leg}, </span>Stand
                  </th>
                  <th scope="col" style={px(W.kg)} className={cn(HEAD, tone.sub, 'font-semibold!')}>
                    <span className="sr-only">Manșa {leg}, </span>Kg
                  </th>
                  <th scope="col" style={px(W.points)} className={cn(HEAD, tone.sub, 'font-semibold!')}>
                    <span className="sr-only">Manșa {leg}, </span>Puncte
                  </th>
                </Fragment>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const bg = r.podium ? 'bg-rank-podium' : zebra(i);
            return (
              <tr key={r.registrationId} data-registration={r.registrationId} data-podium={r.podium || undefined} className={cn(ROW, bg)}>
                <th scope="row" style={px(W.place)} className={cn(CELL, bg, 'sticky left-0 z-above px-0 text-center font-bold!')}>
                  {r.podium ? (
                    <span aria-hidden data-mark="podium">
                      🎖️
                    </span>
                  ) : null}
                  <span className="sr-only">Locul </span>
                  {r.position}
                </th>
                <td style={nameStyle(wide, nameW)} className={cn(CELL, 'text-left', r.podium ? 'font-bold!' : 'font-semibold!')}>
                  <NameText name={r.name} registrationId={r.registrationId} faces={faces} />
                </td>
                <td className={cn(CELL, TOTAL.rule, TOTAL.text, 'text-center font-bold!')}>{roNum(r.totalPoints)}</td>
                <td className={cn(CELL, 'text-center font-medium!')}>
                  <KgText kg={r.totalKg} />
                </td>
                {r.legs.map((cell, li) => {
                  const tone = legTone(legs[li]);
                  return (
                    <Fragment key={legs[li]}>
                      <td className={cn(CELL, tone.rule, 'text-center font-medium! text-rank-plain-head-ink')}>
                        {cell.seat === '-' ? '–' : cell.seat}
                      </td>
                      <td className={cn(CELL, 'text-center font-medium!')}>
                        <KgText kg={cell.kg} />
                      </td>
                      <td className={cn(CELL, tone.text, 'text-center font-semibold!')}>{roNum(cell.points)}</td>
                    </Fragment>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </SideScroll>
  );
}

function LegTable({ data, leg, caption, nameTitle, wide, faces }: TableProps & { leg: number }) {
  const { sections } = useMemo(() => feederLegModel(data.rankings, leg), [data.rankings, leg]);
  const { w: W, row: ROW, cell: CELL, head: HEAD } = parts(wide);
  if (!sections.length) return <NoData />;
  if (sections.every(s => !s.sector)) {
    // Web: nobody was seated in this leg — the names it is about, not a table of dashes.
    const names = sections.flatMap(s => s.rows.map(r => r.name));
    return (
      <div className="flex flex-col items-center gap-1.5 px-6 py-8 text-center">
        <h3 className="t-heading text-ink">{`Nimeni nu a pescuit în manșa ${leg}`}</h3>
        <p className="t-body text-muted">
          <span className="block">Nu au pescuit în această manșă:</span>
          <span className="block">{names.join(' · ')}</span>
        </p>
      </div>
    );
  }
  const fixed = W.legSeat + W.legKg + W.legCount + W.legBiggest + W.legPoints;
  // fish: the leg table has no frozen column and fits the screen (the name takes what is left).
  // Wide: as long as the longest name.
  const nameW = wide
    ? wideNameWidth(
        sections.flatMap(s => s.rows.map(r => r.name)),
        W.legNameMin,
      )
    : `max(${W.legNameMin}px, calc(100vw - ${fixed}px))`;
  const headH = wide ? 'h-10' : 'h-8.5';
  const heads: [string, number | string, string?][] = [
    ['Stand', W.legSeat],
    [nameTitle, nameW],
    ['Kg', W.legKg],
    ['Buc', W.legCount, 'Număr de bucăți'],
    ['C.M.M.C', W.legBiggest],
    ['Puncte', W.legPoints],
  ];
  return (
    <SideScroll caption={caption} wide={wide}>
      <table
        className={cn(fillTable(wide), 'border-separate border-spacing-0 text-rank-ink')}
        style={wide ? { minWidth: fixed + Number(nameW) } : undefined}
      >
        <caption className="sr-only">{caption}</caption>
        {wide ? (
          <colgroup>
            {heads.map(([title, w]) => (
              <col key={title} style={title === nameTitle ? undefined : { width: w }} />
            ))}
          </colgroup>
        ) : null}
        <thead>
          <tr className={headH}>
            {heads.map(([title, w, full]) => (
              <th
                key={title}
                scope="col"
                title={full}
                style={title === nameTitle ? nameStyle(wide, w) : px(w)}
                className={cn(HEAD, PLAIN_HEAD, headH, wide && title === nameTitle && 'pl-2.5 text-left', 'font-semibold!')}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        {sections.map(section => {
          const style = section.sector
            ? (sectorVar(section.sector) as CSSProperties)
            : ({ '--sector': 'var(--color-rank-no-sector)' } as CSSProperties);
          return (
            <tbody key={section.sector ?? 'none'} style={style} data-sector={section.sector ?? 'none'}>
              <tr className={wide ? 'h-8' : 'h-7'}>
                {/* fish: the sector's solid band, its title 12 bold white, 10px sides. */}
                <th scope="rowgroup" colSpan={6} className="rank-sector-solid px-2.5 text-left t-caption font-bold! text-rank-on-dark">
                  {section.sector ? `Sector ${section.sector}` : 'Nu au pescuit în această manșă'}
                </th>
              </tr>
              {section.rows.map((r, i) => {
                const bg = r.sectorWinner ? 'rank-sector-soft' : zebra(i);
                return (
                  <tr
                    key={r.registrationId}
                    data-registration={r.registrationId}
                    data-sector-winner={r.sectorWinner || undefined}
                    className={cn(ROW, bg)}
                  >
                    {/* fish LegRow: the sector's 4px edge opens the row (Stand 46 − 4). */}
                    <td className={cn(CELL, 'border-l-4 border-l-[var(--sector)] text-center font-medium! text-rank-plain-head-ink')}>
                      {r.seat === '-' ? '–' : r.seat}
                    </td>
                    <td className={cn(CELL, 'text-left', r.sectorWinner ? 'font-bold!' : 'font-semibold!')}>
                      <NameText name={r.name} registrationId={r.registrationId} faces={faces} />
                    </td>
                    <td className={cn(CELL, 'text-center font-medium!')}>
                      <KgText kg={r.kg} />
                    </td>
                    <td className={cn(CELL, 'text-center font-medium!')}>{r.catchCount === '-' ? '–' : r.catchCount}</td>
                    <td className={cn(CELL, 'text-center font-medium!')}>
                      <KgText kg={r.biggestFish} />
                    </td>
                    <td className={cn(CELL, 'text-center font-bold!')}>{roNum(r.points)}</td>
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </SideScroll>
  );
}
