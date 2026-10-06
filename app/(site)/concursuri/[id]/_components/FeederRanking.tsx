'use client';

import { Fragment, useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';
import {
  feederGeneralModel,
  feederLegCount,
  feederLegModel,
  feederProvisionalStatus,
  feederTabCount,
  futureLegMessage,
  type FeederRoundsRanking,
  type FeederRoundStatus,
  type FeederTab,
} from '@/core/competitions';
import { RankingFace } from '@/components/ranking/RankingFace';
import { RankingTabs, type RankingTab } from '@/components/ranking/RankingTabs';
import { sectorInk, sectorVar } from '@/components/ranking/sector';
import { IconButton } from '@/components/nav/IconButton';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { EmptyState } from '@/components/surfaces/StateCard';
import { DetailSectionState } from '@/components/templates/T3';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import {
  KgText,
  PlaceCell,
  RANK_PIN,
  RANK_PIN_EDGE,
  RANK_TH_PIN,
  RANK_TH_ROW2,
  RankingFrame,
  RankingGrid,
  SeatLabel,
  WinnerTrophy,
} from '@/components/ranking/shell';
import { RankingCard } from './rankingShell';
import { useRankingFaces, type RankingFaces } from './rankingFaces';

/*
 * Feeder on legs («manșe», FIPS) — fish components/competition/CompetitionRanking.tsx
 * (FeederLegTabs, FeederFutureLeg) + features/competitions/feeder-rounds/FeederRankingTable.tsx +
 * FeederHelpSheet.tsx, on the core view model (core/competitions/domain/feeder.ts).
 *
 *  - General: Loc · Participant (Echipă on team events) · Total (Puncte, Kg) · one group per leg
 *    (Stand, Kg, Puncte) — fish's own column order; the place is the ranking tables' one idiom (kit
 *    PlaceCell: the plain number, the podium — 1–3 with fish — adds the trophy). A scored leg
 *    without a catch reads «–» in its Kg («Fără capturi» for a screen reader, ROADMAP §4b.11), as
 *    the standard and NC tables; the core model keeps fish's «0.000».
 *  - A leg: one row group per sector under fish's solid sector band, the 4px edge on every row,
 *    «Nu au pescuit în această manșă» last; the sector winner(s) on the sector's 16% tint, bold,
 *    with the sector trophy before their points.
 *  - Both: fish's colours (ROADMAP §4b.15, «fish FeederRankingTable's colours» below), compact
 *    (§4b.16: fish's widths, the card only as wide as the table), and from 768 the avatar beside
 *    each name (§4b.13; the registration's photo, else the initials).
 *
 * TODO(kit): a grouped-column / row-group ranking table (ROADMAP §8 «a feeder ranking table»);
 * until then the table is composed from the kit's shared shell (components/ranking/shell.tsx, the
 * kit RankingTable's parts). Wider than its card it scrolls sideways with Loc and the name pinned (a leg: Stand and
 * the name), as fish's frozen columns; the header row sticks in «Tot ecranul».
 */

/** «50.530» → «50,530», «-» → «–»: the web's decimal comma and no-value dash (kit RankingTable). */
export const roNum = (s: string) => (s === '-' ? '–' : s.replace('.', ','));

export type FeederData = {
  rankings: FeederRoundsRanking[];
  roundsCount: number | null | undefined;
  currentRound: number | null | undefined;
  roundStatus: FeederRoundStatus;
};

/** fish `feederLegEmpty`: the open leg tab has nothing to show (Vezi full is then disabled). */
export function feederLegEmpty(d: FeederData, tab: FeederTab): boolean {
  return !!futureLegMessage(tab, d.currentRound, d.roundStatus, feederLegCount(d.rankings));
}

/** fish FeederLegTabs: General | Manșa 1 … Manșa N (the kit RankingTabs strip), and the «?» that explains the scoring. */
export function FeederLegTabs({
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
  const options: RankingTab<string>[] = [
    { value: 'general', label: 'General' },
    ...Array.from({ length: legs }, (_, i) => ({
      value: String(i + 1),
      label: `Manșa ${i + 1}`,
    })),
  ];
  return (
    // The «?» sits right after the last leg tab (it explains them), never pushed to the far edge.
    // One segmented strip at every width (ROADMAP §4b.20), on the ranking card's band.
    <div className="flex min-w-0 items-center gap-2">
      <RankingTabs
        name="feeder-leg"
        label="Manșa clasamentului"
        options={options}
        value={String(value)}
        onChange={v => onChange(v === 'general' ? 'general' : Number(v))}
        className="shrink"
      />
      <IconButton aria-label="Cum se calculează clasamentul" title="Cum se calculează clasamentul" onClick={onHelp} className="shrink-0">
        <InformationCircleIcon aria-hidden />
      </IconButton>
    </div>
  );
}

/** The viewer's own entry: their current stand (ranking `standId`) or their registration. */
export type FeederMe = {
  standId: string | null;
  registrationId: string | null;
};

const isMe = (me: FeederMe | undefined, r: { standId: string | null; registrationId: string }) =>
  !!me && ((me.standId != null && r.standId === me.standId) || (me.registrationId != null && r.registrationId === me.registrationId));

/** The leg tab's table, or what it says while that leg has nothing to show. */
export function FeederRankingTable({
  data,
  tab,
  isTeam,
  caption,
  me,
  full = false,
  toolbar,
}: {
  data: FeederData;
  tab: FeederTab;
  isTeam: boolean;
  caption: string;
  /** The signed-in viewer's entry: their row gets the kit's own-row tint and «Tu · ». */
  me?: FeederMe;
  /** In «Tot ecranul»: the table scrolls inside the dialog. */
  full?: boolean;
  /** On the page: the card's band of controls (the leg tabs, «?», «Clasament complet»), above the table. */
  toolbar?: ReactNode;
}) {
  // A state goes under the card that carries the controls (the reader can still switch leg).
  const alone = (state: ReactNode) => (toolbar ? <RankingCard toolbar={toolbar} after={state} /> : state);
  // fish FeederFutureLeg first: a leg that has not started, or nothing weighed in it yet — even
  // while the whole ranking is still empty (leg 1 just started).
  const message = futureLegMessage(tab, data.currentRound, data.roundStatus, feederLegCount(data.rankings));
  if (message) return alone(<DetailSectionState heading={message.title} description={message.detail} />);
  // fish: no rows at all → «Nu există date de afișat».
  if (data.rankings.length === 0) return alone(<EmptyState title="Nu există date de afișat" />);
  const nameTitle = isTeam ? 'Echipă' : 'Participant';
  if (tab === 'general') {
    const frame = (
      <RankingFrame caption={caption} full={full} embedded={!!toolbar}>
        <GeneralTable data={data} caption={caption} nameTitle={nameTitle} me={me} />
      </RankingFrame>
    );
    return toolbar ? <RankingCard toolbar={toolbar}>{frame}</RankingCard> : frame;
  }
  return <LegTables data={data} leg={tab} caption={caption} nameTitle={nameTitle} me={me} full={full} toolbar={toolbar} alone={alone} />;
}

/** A row's face by its registration (the page's core); unknown → the name's initials. */
const faceOf = (faces: RankingFaces, registrationId: string) => faces.byRegistration.get(registrationId) ?? null;

/*
 * fish FeederRankingTable's colours (ROADMAP §4b.15; tokens in globals.css «ranking tables»): the
 * plain grey head, TOTAL_COLOR and one colour per leg on the grouped header (white bold on the
 * group, the colour on its 10% sub-header and in its cells, a 2px rule opening each group), zebra
 * rows, the podium row, the #E3E6EE grid lines. A leg: one solid band per sector, the sector's 4px
 * edge on every row, the sector winner on the sector's 16% tint.
 */
const PLAIN_HEAD = 'bg-rank-plain-head text-rank-plain-head-ink';
const LINE = 'border-rank-line';

type GroupTone = { head: string; sub: string; text: string; rule: string };
const TOTAL_TONE: GroupTone = {
  head: 'bg-rank-total text-rank-on-dark',
  sub: 'bg-rank-total-tint text-rank-total',
  text: 'text-rank-total',
  rule: 'border-l-2 border-l-rank-total',
};
/** fish LEG_COLORS, one per leg (cycling past three). */
const LEG_TONES: GroupTone[] = [
  { head: 'bg-rank-leg-1 text-rank-on-dark', sub: 'bg-rank-leg-1-tint text-rank-leg-1', text: 'text-rank-leg-1', rule: 'border-l-2 border-l-rank-leg-1' },
  { head: 'bg-rank-leg-2 text-rank-on-dark', sub: 'bg-rank-leg-2-tint text-rank-leg-2', text: 'text-rank-leg-2', rule: 'border-l-2 border-l-rank-leg-2' },
  { head: 'bg-rank-leg-3 text-rank-on-dark', sub: 'bg-rank-leg-3-tint text-rank-leg-3', text: 'text-rank-leg-3', rule: 'border-l-2 border-l-rank-leg-3' },
];
const legTone = (leg: number) => LEG_TONES[(leg - 1) % LEG_TONES.length];

/** A row's ground: the viewer's own tint, fish's podium blue, else the zebra. Pinned cells paint it too. */
const rowGround = (mine: boolean, podium: boolean, i: number) =>
  mine ? 'bg-accent-tint' : podium ? 'bg-rank-podium' : i % 2 === 1 ? 'bg-rank-zebra' : 'bg-rank-base';

/** The feeder tables' cells: fish's 44px row, 12–14px text, the grid lines. */
const F_TH = 'sticky top-0 z-above t-label whitespace-nowrap';
const F_TD = `h-12 border-t ${LINE}`;

/**
 * The pinned block (Loc + the name) stays under ~55% of a 343px phone card, so the Total and the
 * first leg's colours are on screen without a scroll (ROADMAP §4b.15): below 768 Loc is a 40px
 * track and the name a 112px one (balanced lines, wrapped between words); from 768 fish's 56px Loc
 * and the name at its content's width (at least 144px).
 */
const PLACE_W = 'w-10 min-w-10 max-md:pl-2 md:w-14 md:min-w-14 md:pl-3';
/** The name's left offset when pinned: Loc's track. */
const NAME_LEFT = 'left-10 md:left-14';
const NAME_W = 'max-md:w-28 max-md:max-w-28 max-md:min-w-28 max-md:px-2 md:min-w-36 md:px-2.5';

function GeneralTable({ data, caption, nameTitle, me }: { data: FeederData; caption: string; nameTitle: string; me?: FeederMe }) {
  const { legs, rows } = useMemo(() => feederGeneralModel(data.rankings, feederLegCount(data.rankings)), [data.rankings]);
  const faces = useRankingFaces();
  return (
    <RankingGrid caption={caption} className="text-rank-ink">
      <thead>
        <tr>
          <th scope="col" rowSpan={2} className={cn(F_TH, RANK_TH_PIN, PLAIN_HEAD, PLACE_W, 'left-0 h-16 text-left')}>
            Loc
          </th>
          <th scope="col" rowSpan={2} className={cn(F_TH, RANK_TH_PIN, RANK_PIN_EDGE, PLAIN_HEAD, `border-l ${LINE}`, NAME_LEFT, NAME_W, 'text-left')}>
            {nameTitle}
          </th>
          <th scope="colgroup" colSpan={2} className={cn(F_TH, TOTAL_TONE.head, TOTAL_TONE.rule, 'h-8 px-2 text-center')}>
            Total
          </th>
          {legs.map(leg => (
            <th key={leg} scope="colgroup" colSpan={3} className={cn(F_TH, legTone(leg).head, legTone(leg).rule, 'h-8 px-2 text-center')}>
              Manșa {leg}
            </th>
          ))}
        </tr>
        <tr>
          <th scope="col" className={cn(F_TH, RANK_TH_ROW2, TOTAL_TONE.sub, TOTAL_TONE.rule, 'h-8 w-15 px-2 text-right')}>
            Puncte
          </th>
          <th scope="col" className={cn(F_TH, RANK_TH_ROW2, TOTAL_TONE.sub, 'h-8 w-19 px-2 text-right')}>
            Kg
          </th>
          {legs.map(leg => {
            const tone = legTone(leg);
            return (
              <Fragment key={leg}>
                <th scope="col" className={cn(F_TH, RANK_TH_ROW2, tone.sub, tone.rule, 'h-8 w-14 px-2 text-left')}>
                  <span className="sr-only">Manșa {leg}, </span>Stand
                </th>
                <th scope="col" className={cn(F_TH, RANK_TH_ROW2, tone.sub, 'h-8 w-19 px-2 text-right')}>
                  <span className="sr-only">Manșa {leg}, </span>Kg
                </th>
                <th scope="col" className={cn(F_TH, RANK_TH_ROW2, tone.sub, 'h-8 w-15 px-2 text-right')}>
                  <span className="sr-only">Manșa {leg}, </span>Puncte
                </th>
              </Fragment>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const mine = isMe(me, r);
          const ground = rowGround(mine, r.podium, i);
          return (
            <tr key={r.registrationId} data-registration={r.registrationId} className={ground}>
              <th scope="row" className={cn(F_TD, RANK_PIN, ground, PLACE_W, 'left-0 text-left')}>
                <PlaceCell value={r.position} mark={r.podium ? 'podium' : null} onTint={mine} />
              </th>
              <td className={cn(F_TD, RANK_PIN, RANK_PIN_EDGE, ground, `border-l ${LINE}`, NAME_LEFT, NAME_W, 'py-1 whitespace-normal', r.podium ? 'font-extrabold' : 'font-bold')}>
                <span className="flex items-center gap-2.5">
                  <RankingFace name={r.name} face={faceOf(faces, r.registrationId)} />
                  {/* Balanced lines on the phone, wrapped between words: never a word cut in half,
                      never a name hidden behind «…»; one line from 768. */}
                  <span data-rank-name="" className="text-balance break-normal md:min-w-32 md:whitespace-nowrap">
                    {mine ? 'Tu · ' : null}
                    {r.name}
                  </span>
                </span>
              </td>
              <td className={cn(F_TD, TOTAL_TONE.rule, TOTAL_TONE.text, 'px-2 text-right font-extrabold')}>{roNum(r.totalPoints)}</td>
              <td className={cn(F_TD, 'px-2 text-right')}>
                <KgText kg={r.totalKg} />
              </td>
              {r.legs.map((cell, li) => {
                const tone = legTone(legs[li]);
                return (
                  <Fragment key={legs[li]}>
                    <td className={cn(F_TD, tone.rule, 'px-2 text-left text-rank-plain-head-ink')}>
                      <SeatLabel seat={cell.seat} dot={false} />
                    </td>
                    <td className={cn(F_TD, 'px-2 text-right')}>
                      <KgText kg={cell.kg} />
                    </td>
                    <td className={cn(F_TD, tone.text, 'px-2 text-right font-extrabold')}>{roNum(cell.points)}</td>
                  </Fragment>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </RankingGrid>
  );
}

/**
 * A leg's numbers: tight below 1280, so the columns fit a 343px card (fish: «must fit without a
 * sideways scroll»); from 1280, in a sector card of its own, fish's widths a step wider.
 */
const LEG_NUM = 'px-1 text-right xl:px-2.5';
/** Below 768 Buc and C.M.M.C leave the columns (a caption line under the name says them). */
const LEG_WIDE = 'max-md:hidden';
/** Stand's track (w-12): the name's left offset when pinned. */
const SEAT_W = 'w-12 min-w-12';

type LegSection = ReturnType<typeof feederLegModel>['sections'][number];
type LegRow = LegSection['rows'][number];

const sectorTitle = (sector: string | null) => (sector ? `Sector ${sector}` : 'Nu au pescuit în această manșă');

/** fish's sector band: the sector's solid colour, its title in white or black (sectorInk, AA). */
function bandTone(sector: string | null) {
  return sector ? cn('rank-sector-solid', sectorInk(sector, 'solid')) : 'bg-rank-no-sector text-rank-on-light';
}

/**
 * A leg: one row group per sector, each under fish's solid sector band. Below 1280 one table (one
 * card, under the controls); from 1280 the sectors are independent rankings side by side, one
 * compact card each (the band as its title, then the column heads) on equal 592px tracks. Both
 * are in the HTML (one is display: none), so the server's render is the final shape at any width.
 * Nobody seated in the leg: a state naming them.
 */
function LegTables({
  data,
  leg,
  caption,
  nameTitle,
  me,
  full,
  toolbar,
  alone,
}: {
  data: FeederData;
  leg: number;
  caption: string;
  nameTitle: string;
  me?: FeederMe;
  full: boolean;
  toolbar?: ReactNode;
  alone: (state: ReactNode) => ReactNode;
}) {
  const { sections } = useMemo(() => feederLegModel(data.rankings, leg), [data.rankings, leg]);
  const faces = useRankingFaces();
  if (!sections.length) return alone(<EmptyState title="Nu există date de afișat" />);
  if (sections.every(s => !s.sector)) {
    // Nobody was seated in this leg: not a table of dashes, the names it is about.
    const names = sections.flatMap(s => s.rows.map(r => r.name));
    return alone(
      <DetailSectionState
        heading={`Nimeni nu a pescuit în manșa ${leg}`}
        description={
          <>
            <span className="block">Nu au pescuit în această manșă:</span>
            <span className="block">{names.join(' · ')}</span>
          </>
        }
      />,
    );
  }
  const single = (
    <RankingFrame caption={caption} full={full} embedded={!!toolbar} className="xl:hidden">
      <RankingGrid caption={caption} className="text-rank-ink">
        <LegHead nameTitle={nameTitle} />
        {sections.map(section => (
          <LegSectionBody
            key={section.sector ?? 'none'}
            section={section}
            labelledBy={`feeder-leg-${leg}-${section.sector ?? 'none'}-s`}
            groupRow
            me={me}
            faces={faces}
          />
        ))}
      </RankingGrid>
    </RankingFrame>
  );
  const grid = (
    <div
      role="region"
      aria-label={caption}
      tabIndex={full ? 0 : undefined}
      className={cn(
        // Equal compact tracks (fish's widths): two sectors side by side from 1280, the rest margin.
        'grid grid-cols-[repeat(auto-fill,37rem)] items-start gap-4 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent max-xl:hidden',
        full && 'max-h-full overflow-auto',
      )}
    >
      {sections.map(section => {
        const titleId = `feeder-leg-${leg}-${section.sector ?? 'none'}-g`;
        return (
          <section
            key={section.sector ?? 'none'}
            aria-labelledby={titleId}
            style={section.sector ? (sectorVar(section.sector) as CSSProperties) : undefined}
            className="overflow-clip rounded-card bg-surface shadow-e0"
          >
            <h3 id={titleId} className={cn('flex h-9 items-center px-3 t-label', bandTone(section.sector))}>
              {sectorTitle(section.sector)}
            </h3>
            {section.sector ? (
              <RankingFrame caption={`${caption}, ${sectorTitle(section.sector)}`} region={false} embedded>
                <RankingGrid caption={`${caption}, ${sectorTitle(section.sector)}`} className="text-rank-ink">
                  <LegHead nameTitle={nameTitle} wide />
                  <LegSectionBody section={section} labelledBy={titleId} groupRow={false} me={me} faces={faces} />
                </RankingGrid>
              </RankingFrame>
            ) : (
              // Not seated: only the names (every number of theirs is a dash).
              <ul>
                {section.rows.map((r, i) => (
                  <li
                    key={r.registrationId}
                    className={cn(
                      `flex min-h-12 items-center gap-2.5 border-t ${LINE} px-3 py-1.5 t-table font-bold first:border-t-0`,
                      rowGround(isMe(me, r), false, i),
                    )}
                  >
                    <RankingFace name={r.name} face={faceOf(faces, r.registrationId)} />
                    <span>
                      {isMe(me, r) ? 'Tu · ' : null}
                      {r.name}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
  return toolbar ? (
    // From 1280 the card holds only the band (the leg's sector cards follow under it): it stays a
    // card, so the tabs never sit loose on the page (ROADMAP §4b.20), and it is the grid's header —
    // as wide as the sector cards under it (gridBandWidth), never a stub floating over them.
    <RankingCard toolbar={toolbar} after={grid} className="@container" cardClassName={gridBandWidth(sections.length)}>
      {single}
    </RankingCard>
  ) : (
    <>
      {single}
      {grid}
    </>
  );
}

/**
 * From 1280 the band's card spans the sector grid's occupied tracks (37rem = w-148 each, gap 16px):
 * one track, two once the column holds 2×592+16 = 1200px (75rem), three at 1808px (113rem) — never
 * more tracks than there are sector cards. The column is the container (RankingCard `@container`).
 */
function gridBandWidth(cards: number): string {
  return cn(
    'xl:w-148',
    cards >= 2 && 'xl:@min-[75rem]:w-300',
    cards >= 3 && 'xl:@min-[113rem]:w-452',
  );
}

/**
 * The leg's column heads, fish's plain grey head. Below 1280 fish's short heads (Kg / Buc); in a
 * sector card from 1280 (`wide`) the full heads.
 */
function LegHead({ nameTitle, wide = false }: { nameTitle: string; wide?: boolean }) {
  const th = cn(F_TH, PLAIN_HEAD, 'h-10');
  return (
    <thead>
      <tr>
        <th scope="col" className={cn(th, RANK_TH_PIN, SEAT_W, 'left-0 pr-1 pl-3 text-left')}>
          Stand
        </th>
        {/* The name takes what the numbers leave (in a sector card from 1280 too), so a name only
            wraps when the card has no room for it. */}
        <th scope="col" className={cn(th, RANK_TH_PIN, RANK_PIN_EDGE, 'left-12 w-full px-1.5 text-left', wide && 'min-w-48')}>
          {nameTitle}
        </th>
        {/* The full names are what a screen reader says. */}
        <th scope="col" aria-label="Cantitate, kg" className={cn(th, LEG_NUM, 'xl:w-19')}>
          {wide ? 'Cantitate' : 'Kg'}
        </th>
        <th scope="col" aria-label="Număr de bucăți" className={cn(th, LEG_NUM, LEG_WIDE, 'xl:w-15')}>
          {wide ? 'Nr. buc' : 'Buc'}
        </th>
        <th scope="col" aria-label="Cea mai mare captură" className={cn(th, LEG_NUM, LEG_WIDE, 'xl:w-18')}>
          C.M.M.C
        </th>
        <th scope="col" className={cn(th, LEG_NUM, 'pr-2.5 xl:w-16 xl:pr-3')}>
          Puncte
        </th>
      </tr>
    </thead>
  );
}

/** Below 768: what the hidden columns hold, under the name («6 buc · CMMC 7,725»). */
function legCaption(r: LegRow): string | null {
  if (r.catchCount === '-' && r.biggestFish === '-') return null;
  return `${roNum(r.catchCount)} buc · CMMC ${roNum(r.biggestFish)}`;
}

function LegSectionBody({
  section,
  labelledBy,
  groupRow,
  me,
  faces,
}: {
  section: LegSection;
  labelledBy: string;
  groupRow: boolean;
  me?: FeederMe;
  faces: RankingFaces;
}) {
  const sectorStyle = section.sector ? (sectorVar(section.sector) as CSSProperties) : undefined;
  return (
    <tbody aria-labelledby={labelledBy} style={sectorStyle}>
      {groupRow ? (
        <tr>
          <th id={labelledBy} scope="rowgroup" colSpan={6} className={cn('h-8 p-0 text-left t-label', bandTone(section.sector))}>
            {/* The label stays at the left edge while the leg scrolls sideways. */}
            <span className="sticky left-0 block w-max px-3">{sectorTitle(section.sector)}</span>
          </th>
        </tr>
      ) : null}
      {section.rows.map((r, i) => {
        const mine = isMe(me, r);
        const caption = legCaption(r);
        // fish LegRow: the sector winner on the sector's 16% tint, the others zebra.
        const ground = mine ? 'bg-accent-tint' : r.sectorWinner && section.sector ? 'rank-sector-soft' : i % 2 === 1 ? 'bg-rank-zebra' : 'bg-rank-base';
        return (
          <tr key={r.registrationId} data-registration={r.registrationId} className={ground}>
            <th scope="row" className={cn(F_TD, RANK_PIN, ground, SEAT_W, 'relative left-0 pr-1 pl-3 text-left font-bold text-rank-plain-head-ink')}>
              {/* The sector's 4px edge, inside the pinned cell (fish borderLeftWidth 4). */}
              <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', section.sector ? 'rank-sector-solid' : 'bg-rank-no-sector')} />
              {r.seat === '-' ? '–' : r.seat}
            </th>
            <td className={cn(F_TD, RANK_PIN, RANK_PIN_EDGE, ground, `border-l ${LINE}`, 'left-12 px-1.5 py-1.5 whitespace-normal')}>
              <span className="flex min-w-24 items-center gap-1.5">
                <RankingFace name={r.name} face={faceOf(faces, r.registrationId)} className="mr-1" />
                <span className="flex min-w-0 flex-col">
                  <span data-rank-name="" className={cn('text-balance break-normal', r.sectorWinner ? 'font-extrabold' : 'font-bold')}>
                    {mine ? 'Tu · ' : null}
                    {r.name}
                  </span>
                  {caption ? (
                    <span aria-hidden className="t-caption text-ink-2 md:hidden">
                      {caption}
                    </span>
                  ) : null}
                </span>
              </span>
            </td>
            <td className={cn(F_TD, LEG_NUM, `border-l ${LINE}`)}>
              <KgText kg={r.kg} />
            </td>
            <td className={cn(F_TD, LEG_NUM, LEG_WIDE, `border-l ${LINE}`)}>{roNum(r.catchCount)}</td>
            <td className={cn(F_TD, LEG_NUM, LEG_WIDE, `border-l ${LINE}`)}>{roNum(r.biggestFish)}</td>
            <td className={cn(F_TD, LEG_NUM, `border-l ${LINE}`, 'pr-2.5 font-extrabold whitespace-nowrap xl:pr-3')}>
              {/* The sector winner's trophy before the points, centred on the digits in one flex
                  line (the place idiom, kit PlaceCell align="end"), so the digits stay flush right
                  with every other row's. */}
              <span className="inline-flex items-center justify-end gap-1 align-middle">
                {r.sectorWinner ? <WinnerTrophy mark="sector" inherit srText="Câștigător de sector, " /> : null}
                {roNum(r.points)}
              </span>
            </td>
          </tr>
        );
      })}
    </tbody>
  );
}

/**
 * fish FeederHelpSheet «Cum se calculează» — reading help beside the table it explains: the kit
 * ResponsiveSurface `context` (a sheet on the phone, a dialog 768–1279, from 1280 the docked side
 * panel, so the table stays in view). Rendered where the panel docks (beside the ranking card).
 */
export function FeederHelp({
  open,
  onClose,
  competitionStatus,
  data,
  panelClassName,
}: {
  open: boolean;
  onClose: () => void;
  competitionStatus: string;
  data: FeederData;
  panelClassName?: string;
}) {
  const status = feederProvisionalStatus(competitionStatus, data.currentRound, data.roundStatus);
  // The docked panel is not modal (the kit SidePanel: no focus trap): opening moves focus into it
  // (its «Închide»), so Escape works at once; closing gives focus back to what opened it. The sheet
  // and the dialog do both themselves.
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const box = wrap.current;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    box?.querySelector<HTMLElement>('aside button')?.focus();
    return () => {
      if (back?.isConnected && (document.activeElement === document.body || box?.contains(document.activeElement))) back.focus();
    };
  }, [open]);
  return (
    <div ref={wrap} className="contents">
      <ResponsiveSurface open={open} onClose={onClose} intent="context" title="Cum se calculează" panelClassName={panelClassName}>
        <div className="flex flex-col gap-4">
          {status ? (
            <p>
              <StatusPill tone="info">Clasament provizoriu · {status}</StatusPill>
            </p>
          ) : null}
          <dl className="flex flex-col gap-3">
            <Rule title="Puncte">
              În fiecare manșă primești ca puncte locul din sectorul în care ai pescuit: primul ia 1 punct, al doilea 2… La egalitate se dă
              media locurilor. Cine nu prinde nimic primește media locurilor rămase.
            </Rule>
            <Rule title="Stand">
              Sectorul și standul la care ai pescuit în manșa respectivă: A4 = sectorul A, standul 4. Înaintea fiecărei manșe se trage din
              nou la sorți.
            </Rule>
            <Rule title="General">
              Totalul adună punctele din toate manșele. Cel mai mic total câștigă; la egalitate decide cantitatea totală. Pe tab-ul fiecărei
              manșe vezi clasamentul ei, pe sectoare.
            </Rule>
          </dl>
        </div>
      </ResponsiveSurface>
    </div>
  );
}

function Rule({ title, children }: { title: string; children: string | string[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="t-body-strong text-ink">{title}</dt>
      <dd className="t-body text-ink-2">{children}</dd>
    </div>
  );
}
