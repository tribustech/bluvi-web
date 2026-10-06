'use client';

import { Fragment, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { InformationCircleIcon, TrophyIcon } from '@heroicons/react/24/outline';
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
import { sectorFill } from '@/components/ranking/sector';
import { IconButton } from '@/components/nav/IconButton';
import { ResponsiveSurface } from '@/components/surfaces/ResponsiveSurface';
import { EmptyState } from '@/components/surfaces/StateCard';
import { ChoiceChips, type Choice } from '@/components/templates/T1';
import { DetailSectionState } from '@/components/templates/T3';
import { StatusPill } from '@/components/ui/StatusPill';
import { cn } from '@/components/ui/cn';
import {
  PlaceCell,
  RANK_PIN,
  RANK_PIN_EDGE,
  RANK_TD,
  RANK_TD_BASE,
  RANK_TH,
  RANK_TH_BASE,
  RANK_TH_PIN,
  RANK_TH_ROW2,
  RANK_TH_SURFACE_BASE,
  RankingCard,
  RankingFrame,
  RankingGrid,
  SeatLabel,
  pinSurface,
} from './rankingShell';

/*
 * Feeder on legs («manșe», FIPS) — fish components/competition/CompetitionRanking.tsx
 * (FeederLegTabs, FeederFutureLeg) + features/competitions/feeder-rounds/FeederRankingTable.tsx +
 * FeederHelpSheet.tsx, on the core view model (core/competitions/domain/feeder.ts).
 *
 *  - General: Loc · Participant (Echipă on team events) · Total (Puncte, Kg) · one group per leg
 *    (Stand, Kg, Puncte) — fish's own column order; the place is the kit table's plain number, the
 *    podium (1–3 with fish) adds the trophy.
 *  - A leg: one row group per sector (its dot and the 4px edge), «Nu au pescuit în această manșă»
 *    last; the sector winner(s) carry a trophy and bold name instead of fish's 16% row tint
 *    (Fundații: a sector colour is never a fill under text).
 *
 * TODO(kit): a grouped-column / row-group ranking table (ROADMAP §8 «a feeder ranking table»);
 * until then the table is composed from the shared shell (./rankingShell.tsx: the kit table's
 * tokens). Wider than its card it scrolls sideways with Loc and the name pinned (a leg: Stand and
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

/** fish FeederLegTabs: General | Manșa 1 … Manșa N, and the «?» that explains the scoring. */
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
  const options: Choice<string>[] = [
    { value: 'general', label: 'General' },
    ...Array.from({ length: legs }, (_, i) => ({
      value: String(i + 1),
      label: `Manșa ${i + 1}`,
    })),
  ];
  return (
    // The «?» sits right after the last leg chip (it explains them), never pushed to the far edge.
    <div className="flex min-w-0 items-center gap-2">
      <div className="-ml-1 min-w-0 shrink overflow-hidden pl-1">
        <ChoiceChips
          name="feeder-leg"
          label="Manșa clasamentului"
          scroll
          options={options}
          value={String(value)}
          onChange={v => onChange(v === 'general' ? 'general' : Number(v))}
        />
      </div>
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

/** Loc's track (w-14): the name's left offset when pinned. */
const PLACE_W = 'w-14 min-w-14';

function GeneralTable({ data, caption, nameTitle, me }: { data: FeederData; caption: string; nameTitle: string; me?: FeederMe }) {
  const { legs, rows } = useMemo(() => feederGeneralModel(data.rankings, feederLegCount(data.rankings)), [data.rankings]);
  // The Total group is a group like the legs: the page-grey header with its left rule (indigo in a
  // row is the viewer's own row or a win, never a whole column).
  const group = cn(RANK_TH, 'h-8 border-l border-hairline text-center text-ink');
  return (
    <RankingGrid caption={caption}>
      <thead>
        <tr>
          <th scope="col" rowSpan={2} className={cn(RANK_TH, RANK_TH_PIN, PLACE_W, 'left-0 pl-3 text-left')}>
            Loc
          </th>
          <th scope="col" rowSpan={2} className={cn(RANK_TH, RANK_TH_PIN, RANK_PIN_EDGE, 'left-14 min-w-36 text-left')}>
            {nameTitle}
          </th>
          <th scope="colgroup" colSpan={2} className={group}>
            Total
          </th>
          {legs.map(leg => (
            <th key={leg} scope="colgroup" colSpan={3} className={group}>
              Manșa {leg}
            </th>
          ))}
        </tr>
        <tr>
          <th scope="col" className={cn(RANK_TH, RANK_TH_ROW2, 'h-8 border-l border-hairline text-right')}>
            Puncte
          </th>
          <th scope="col" className={cn(RANK_TH, RANK_TH_ROW2, 'h-8 text-right')}>
            Kg
          </th>
          {legs.map(leg => (
            <Fragment key={leg}>
              <th scope="col" className={cn(RANK_TH, RANK_TH_ROW2, 'h-8 border-l border-hairline text-left')}>
                <span className="sr-only">Manșa {leg}, </span>Stand
              </th>
              <th scope="col" className={cn(RANK_TH, RANK_TH_ROW2, 'h-8 text-right')}>
                <span className="sr-only">Manșa {leg}, </span>Kg
              </th>
              <th scope="col" className={cn(RANK_TH, RANK_TH_ROW2, 'h-8 pr-3.5 text-right')}>
                <span className="sr-only">Manșa {leg}, </span>Puncte
              </th>
            </Fragment>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => {
          const mine = isMe(me, r);
          return (
            <tr key={r.registrationId} data-registration={r.registrationId} className={cn('text-ink', mine && 'bg-accent-tint')}>
              <th scope="row" className={cn(RANK_TD, RANK_PIN, pinSurface(mine), PLACE_W, 'left-0 pl-3 text-left')}>
                <PlaceCell value={r.position} winner={r.podium} onTint={mine} />
              </th>
              <td className={cn(RANK_TD, RANK_PIN, RANK_PIN_EDGE, pinSurface(mine), 'left-14 max-w-60 font-bold whitespace-normal')}>
                <span className="line-clamp-2 min-w-32 max-md:min-w-28">
                  {mine ? 'Tu · ' : null}
                  {r.name}
                </span>
              </td>
              <td className={cn(RANK_TD, 'border-l text-right font-extrabold text-ink')}>{roNum(r.totalPoints)}</td>
              <td className={cn(RANK_TD, 'text-right')}>{roNum(r.totalKg)}</td>
              {r.legs.map((cell, i) => (
                <Fragment key={legs[i]}>
                  <td className={cn(RANK_TD, 'border-l text-left text-ink-2')}>
                    <SeatLabel seat={cell.seat} />
                  </td>
                  <td className={cn(RANK_TD, 'text-right')}>{roNum(cell.kg)}</td>
                  <td className={cn(RANK_TD, 'pr-3.5 text-right font-extrabold')}>{roNum(cell.points)}</td>
                </Fragment>
              ))}
            </tr>
          );
        })}
      </tbody>
    </RankingGrid>
  );
}

/**
 * A leg's numbers: tight below 1280, so the columns fit a 343px card (fish: «must fit without a
 * sideways scroll»); from 1280, in a sector card of its own, the desktop room.
 */
const LEG_NUM = 'px-1 text-right xl:px-3';
/** A number cell's width from 1280 (Puncte a step less). */
const LEG_NUM_W = 'xl:min-w-16';
/** Below 768 Buc and C.M.M.C leave the columns (a caption line under the name says them). */
const LEG_WIDE = 'max-md:hidden';
/** Stand's track (w-12): the name's left offset when pinned. */
const SEAT_W = 'w-12 min-w-12';

type LegSection = ReturnType<typeof feederLegModel>['sections'][number];
type LegRow = LegSection['rows'][number];

const sectorTitle = (sector: string | null) => (sector ? `Sector ${sector}` : 'Nu au pescuit în această manșă');

/**
 * A leg: one row group per sector. Below 1280 one table (one card, under the controls); from 1280
 * the sectors are independent rankings side by side, one card each with its own head (the sector as
 * the card's title, then the column heads). Both are in the HTML (one is display: none), so the
 * server's render is the final shape at any width. Nobody seated in the leg: a state naming them.
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
      <RankingGrid caption={caption}>
        <LegHead nameTitle={nameTitle} />
        {sections.map(section => (
          <LegSectionBody
            key={section.sector ?? 'none'}
            section={section}
            labelledBy={`feeder-leg-${leg}-${section.sector ?? 'none'}-s`}
            groupRow
            me={me}
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
        'grid grid-cols-2 items-start gap-4 outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-accent max-xl:hidden',
        full && 'max-h-full overflow-auto',
      )}
    >
      {sections.map(section => {
        const titleId = `feeder-leg-${leg}-${section.sector ?? 'none'}-g`;
        const fill = section.sector ? sectorFill(section.sector, 'var(--color-muted)') : null;
        return (
          <section key={section.sector ?? 'none'} aria-labelledby={titleId} className="overflow-clip rounded-card bg-surface shadow-e0">
            <h3 id={titleId} className="flex items-center gap-2 px-4 pt-3.5 pb-3 t-heading text-ink">
              {fill ? <span aria-hidden className={cn('size-2.5 rounded-full', fill.className)} style={fill.style} /> : null}
              {sectorTitle(section.sector)}
            </h3>
            {section.sector ? (
              <RankingFrame caption={`${caption}, ${sectorTitle(section.sector)}`} region={false} embedded>
                <RankingGrid caption={`${caption}, ${sectorTitle(section.sector)}`}>
                  <LegHead nameTitle={nameTitle} surface />
                  <LegSectionBody section={section} labelledBy={titleId} groupRow={false} me={me} />
                </RankingGrid>
              </RankingFrame>
            ) : (
              // Not seated: only the names (every number of theirs is a dash).
              <ul className="border-t border-hairline">
                {section.rows.map(r => (
                  <li
                    key={r.registrationId}
                    className={cn(
                      'flex min-h-13 items-center border-t border-hairline px-4 py-2 t-table font-bold text-ink first:border-t-0',
                      isMe(me, r) && 'bg-accent-tint',
                    )}
                  >
                    {isMe(me, r) ? 'Tu · ' : null}
                    {r.name}
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
    <RankingCard toolbar={toolbar} after={grid}>
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
 * The leg's column heads. Below 1280 the kit's page-grey band with fish's short heads (Kg / Buc);
 * in a sector card from 1280 (`surface`) the card's own surface and the full heads.
 */
function LegHead({ nameTitle, surface = false }: { nameTitle: string; surface?: boolean }) {
  const th = surface ? RANK_TH_SURFACE_BASE : RANK_TH_BASE;
  return (
    <thead>
      <tr>
        <th scope="col" className={cn(th, RANK_TH_PIN, SEAT_W, 'left-0 h-10 pr-1 pl-3 text-left')}>
          Stand
        </th>
        <th scope="col" className={cn(th, RANK_TH_PIN, RANK_PIN_EDGE, 'left-12 h-10 w-full px-1.5 text-left')}>
          {nameTitle}
        </th>
        {/* Below 1280 fish's short heads (Kg / Buc); the full names are what a screen reader says. */}
        <th scope="col" aria-label="Cantitate, kg" className={cn(th, LEG_NUM, LEG_NUM_W, 'h-10')}>
          <span className="xl:hidden">Kg</span>
          <span className="max-xl:hidden">Cantitate</span>
        </th>
        <th scope="col" aria-label="Număr de bucăți" className={cn(th, LEG_NUM, LEG_NUM_W, LEG_WIDE, 'h-10')}>
          <span className="xl:hidden">Buc</span>
          <span className="max-xl:hidden">Nr. buc</span>
        </th>
        <th scope="col" aria-label="Cea mai mare captură" className={cn(th, LEG_NUM, LEG_NUM_W, LEG_WIDE, 'h-10')}>
          C.M.M.C
        </th>
        <th scope="col" className={cn(th, LEG_NUM, 'h-10 pr-2.5 xl:min-w-14 xl:pr-4')}>
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
}: {
  section: LegSection;
  labelledBy: string;
  groupRow: boolean;
  me?: FeederMe;
}) {
  const fill = section.sector ? sectorFill(section.sector, 'var(--color-muted)') : null;
  return (
    <tbody aria-labelledby={labelledBy}>
      {groupRow ? (
        <tr>
          <th id={labelledBy} scope="rowgroup" colSpan={6} className="h-9 border-t border-hairline bg-page p-0 text-left t-label text-ink">
            {/* The label stays at the left edge while the leg scrolls sideways. */}
            <span className="sticky left-0 flex w-max items-center gap-2 px-3">
              {fill ? <span aria-hidden className={cn('size-2.5 rounded-full', fill.className)} style={fill.style} /> : null}
              {sectorTitle(section.sector)}
            </span>
          </th>
        </tr>
      ) : null}
      {section.rows.map(r => {
        const mine = isMe(me, r);
        const caption = legCaption(r);
        return (
          <tr key={r.registrationId} data-registration={r.registrationId} className={cn('text-ink', mine && 'bg-accent-tint')}>
            <th scope="row" className={cn(RANK_TD_BASE, RANK_PIN, pinSurface(mine), SEAT_W, 'left-0 pr-1 pl-3 text-left font-bold')}>
              {/* The sector's 4px edge, inside the pinned cell. */}
              {fill ? <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', fill.className)} style={fill.style} /> : null}
              {r.seat === '-' ? '–' : r.seat}
            </th>
            <td className={cn(RANK_TD_BASE, RANK_PIN, RANK_PIN_EDGE, pinSurface(mine), 'left-12 px-1.5 py-1.5 whitespace-normal')}>
              <span className="flex min-w-20 items-center gap-1.5">
                {r.sectorWinner ? (
                  <>
                    <TrophyIcon aria-hidden className="size-4 shrink-0 text-accent-ink" />
                    <span className="sr-only">Câștigător de sector: </span>
                  </>
                ) : null}
                <span className="flex min-w-0 flex-col">
                  <span className={cn('line-clamp-2 break-words', r.sectorWinner ? 'font-extrabold' : 'font-bold')}>
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
            <td className={cn(RANK_TD_BASE, LEG_NUM, LEG_NUM_W)}>{roNum(r.kg)}</td>
            <td className={cn(RANK_TD_BASE, LEG_NUM, LEG_NUM_W, LEG_WIDE)}>{roNum(r.catchCount)}</td>
            <td className={cn(RANK_TD_BASE, LEG_NUM, LEG_NUM_W, LEG_WIDE)}>{roNum(r.biggestFish)}</td>
            <td className={cn(RANK_TD_BASE, LEG_NUM, 'pr-2.5 font-extrabold text-ink xl:min-w-14 xl:pr-4')}>{roNum(r.points)}</td>
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
